"""
Deal endpoints.
"""

from __future__ import annotations

from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select, func, and_
from sqlalchemy.ext.asyncio import AsyncSession

from database.db import Deal, get_db
from models.schemas import DealResponse, DealScoreBreakdown
from scoring.engine import score_deal, score_deal_simple, classify_band
from scenarios.manager import get_scenario

router = APIRouter(prefix="/api/deals", tags=["deals"])


@router.get("", response_model=List[DealResponse])
async def list_deals(
    segment: Optional[str] = Query(None),
    band: Optional[str] = Query(None),
    outcome: Optional[str] = Query(None),
    min_score: Optional[float] = Query(None),
    max_score: Optional[float] = Query(None),
    search: Optional[str] = Query(None),
    scenario_id: Optional[str] = Query(None),
    limit: int = Query(100, le=500),
    offset: int = Query(0),
    db: AsyncSession = Depends(get_db),
):
    # If scenario is given, we re-score deals with that scenario
    scenario = None
    if scenario_id:
        scenario = await get_scenario(db, scenario_id)
        if scenario is None:
            raise HTTPException(status_code=404, detail="Scenario not found")

    # Build base query with filters that work on stored values
    q = select(Deal)
    if segment:
        q = q.where(Deal.segment_neu == segment)
    if outcome == "won":
        q = q.where(and_(Deal.is_closed == True, Deal.is_won == True))
    elif outcome == "lost":
        q = q.where(and_(Deal.is_closed == True, Deal.is_won == False))
    elif outcome == "open":
        q = q.where(Deal.is_closed == False)
    if search:
        q = q.where(Deal.deal_name.ilike(f"%{search}%"))

    if scenario:
        # Load all matching deals, re-score, then apply score/band filters
        q = q.limit(2000)  # reasonable limit for re-scoring
        result = await db.execute(q)
        deals = result.scalars().all()

        simulations = getattr(scenario, "simulations", None)
        scored = []
        for deal in deals:
            deal_dict = {c.key: getattr(deal, c.key) for c in Deal.__table__.columns}
            try:
                score, score_band = score_deal_simple(
                    deal_dict,
                    weights=scenario.weights,
                    gates=scenario.gates,
                    bands=scenario.bands,
                    lookup_overrides=scenario.lookups or None,
                    simulations=simulations,
                )
            except Exception:
                score, score_band = deal.computed_score, deal.score_band

            # Apply score/band filters on re-scored values
            if band and score_band != band:
                continue
            if min_score is not None and (score is None or score < min_score):
                continue
            if max_score is not None and (score is not None and score > max_score):
                continue

            resp = DealResponse.model_validate(deal)
            resp.computed_score = score
            resp.score_band = score_band
            scored.append(resp)

        # Sort by score desc
        scored.sort(key=lambda d: d.computed_score or 0, reverse=True)
        return scored[offset:offset + limit]
    else:
        # No scenario: use stored scores with DB-level filters
        if band:
            q = q.where(Deal.score_band == band)
        if min_score is not None:
            q = q.where(Deal.computed_score >= min_score)
        if max_score is not None:
            q = q.where(Deal.computed_score <= max_score)
        q = q.order_by(Deal.computed_score.desc().nullslast()).offset(offset).limit(limit)
        result = await db.execute(q)
        deals = result.scalars().all()
        return [DealResponse.model_validate(d) for d in deals]


@router.get("/count")
async def deal_count(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(func.count(Deal.id)))
    return {"count": result.scalar()}


@router.get("/field-fill-rates")
async def field_fill_rates(db: AsyncSession = Depends(get_db)):
    """Return fill rate (% non-null) for each scoring-relevant field."""
    fields = [
        "lead_score_contact", "setter_rating", "finanzierung",
        "entscheidungssituation", "reaktionsgeschwindigkeit", "next_step",
        "aktivitaet", "stage_aging", "produktfit", "arbeitgeber_fit",
        "unternehmensfit", "budget_vorhanden", "roi_erwartung",
        "unterlagen", "jc_status", "deutsch_niveau", "pc_internet",
    ]
    total_q = await db.execute(select(func.count(Deal.id)))
    total = total_q.scalar() or 1

    rates = {}
    for field_name in fields:
        col = getattr(Deal, field_name, None)
        if col is None:
            continue
        filled_q = await db.execute(
            select(func.count(Deal.id)).where(col.isnot(None))
        )
        filled = filled_q.scalar() or 0
        rates[field_name] = round(filled / total * 100, 1)

    return {"total_deals": total, "fill_rates": rates}


@router.get("/{deal_id}", response_model=DealResponse)
async def get_deal(deal_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Deal).where(Deal.id == deal_id))
    deal = result.scalar_one_or_none()
    if deal is None:
        raise HTTPException(status_code=404, detail="Deal not found")
    return DealResponse.model_validate(deal)


@router.get("/{deal_id}/score-breakdown", response_model=DealScoreBreakdown)
async def get_score_breakdown(
    deal_id: str,
    scenario_id: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Deal).where(Deal.id == deal_id))
    deal = result.scalar_one_or_none()
    if deal is None:
        raise HTTPException(status_code=404, detail="Deal not found")

    deal_dict = {c.key: getattr(deal, c.key) for c in Deal.__table__.columns}

    kwargs = {}
    if scenario_id:
        scenario = await get_scenario(db, scenario_id)
        if scenario:
            kwargs["weights"] = scenario.weights
            kwargs["gates"] = scenario.gates
            kwargs["bands"] = scenario.bands
            kwargs["lookup_overrides"] = scenario.lookups or None
            kwargs["simulations"] = getattr(scenario, "simulations", None)

    breakdown = score_deal(deal_dict, **kwargs)
    return breakdown
