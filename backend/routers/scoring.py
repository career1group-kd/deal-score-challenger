"""
Scoring endpoints: calculate and preview.
"""

from __future__ import annotations

from typing import List

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from database.db import Deal, get_db
from models.schemas import (
    ScoringRequest, ScoringPreviewRequest,
    DealScoreBreakdown, ScenarioWeights, GateConfig, BandThresholds,
    FieldSimulations,
)
from scoring.engine import score_deal
from scenarios.manager import get_scenario

router = APIRouter(prefix="/api/scoring", tags=["scoring"])


@router.post("/calculate", response_model=DealScoreBreakdown)
async def calculate_score(req: ScoringRequest, db: AsyncSession = Depends(get_db)):
    """Score a single deal, optionally with a specific scenario."""
    # Get deal data
    if req.deal_data:
        deal_dict = req.deal_data
    elif req.deal_id:
        result = await db.execute(select(Deal).where(Deal.id == req.deal_id))
        deal = result.scalar_one_or_none()
        if deal is None:
            raise HTTPException(status_code=404, detail="Deal not found")
        deal_dict = {c.key: getattr(deal, c.key) for c in Deal.__table__.columns}
    else:
        raise HTTPException(status_code=400, detail="Provide deal_id or deal_data")

    # Get scenario weights if specified
    weights = None
    gates = None
    bands = None
    lookup_overrides = None
    simulations = None
    if req.scenario_id:
        scenario = await get_scenario(db, req.scenario_id)
        if scenario is None:
            raise HTTPException(status_code=404, detail="Scenario not found")
        weights = scenario.weights
        gates = scenario.gates
        bands = scenario.bands
        lookup_overrides = scenario.lookups or None
        simulations = getattr(scenario, "simulations", None)

    return score_deal(deal_dict, weights=weights, gates=gates, bands=bands,
                      lookup_overrides=lookup_overrides, simulations=simulations)


@router.post("/preview", response_model=List[DealScoreBreakdown])
async def preview_scoring(req: ScoringPreviewRequest, db: AsyncSession = Depends(get_db)):
    """Preview scoring for multiple deals with custom scenario config."""
    q = select(Deal)
    if req.deal_ids:
        q = q.where(Deal.id.in_(req.deal_ids))
    q = q.limit(req.limit)
    result = await db.execute(q)
    deals = result.scalars().all()

    weights = req.scenario.weights
    gates = req.scenario.gates
    bands = req.scenario.bands
    lookup_overrides = req.scenario.lookups or None
    simulations = req.scenario.simulations

    breakdowns = []
    for deal in deals:
        deal_dict = {c.key: getattr(deal, c.key) for c in Deal.__table__.columns}
        try:
            bd = score_deal(deal_dict, weights=weights, gates=gates, bands=bands,
                            lookup_overrides=lookup_overrides, simulations=simulations)
            breakdowns.append(bd)
        except Exception:
            continue
    return breakdowns
