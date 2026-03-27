"""
Analytics endpoints: distribution, win-rate, backtest, compare, roc, revenue-impact, confusion-matrix.
"""

from __future__ import annotations

import logging
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from database.db import Deal, get_db
from models.schemas import (
    AnalyticsResponse, WinRateByBand, BacktestResult,
    ConfusionMatrixResult, ROCPoint, RevenueImpact, CohortComparison,
)
from analytics.distributions import compute_distribution
from analytics.backtesting import (
    win_rate_by_band, backtest_scenario, confusion_matrix,
    roc_curve, revenue_impact_analysis,
)
from analytics.cohort_analysis import compare_scenarios
from scoring.engine import score_deal_simple
from scenarios.manager import get_scenario

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/analytics", tags=["analytics"])


async def _load_deals(db: AsyncSession, segment: str | None = None) -> list[dict]:
    q = select(Deal)
    if segment:
        q = q.where(Deal.segment_neu == segment)
    result = await db.execute(q)
    deals = result.scalars().all()
    return [{c.key: getattr(d, c.key) for c in Deal.__table__.columns} for d in deals]


async def _rescore_deals(db: AsyncSession, deals: list[dict], scenario_id: str):
    """Re-score deals in-place using the given scenario. Returns the scenario."""
    scenario = await get_scenario(db, scenario_id)
    if scenario is None:
        raise HTTPException(status_code=404, detail="Scenario not found")
    simulations = getattr(scenario, "simulations", None)
    for d in deals:
        try:
            score, band = score_deal_simple(
                d,
                weights=scenario.weights,
                gates=scenario.gates,
                bands=scenario.bands,
                lookup_overrides=scenario.lookups or None,
                simulations=simulations,
            )
            d["computed_score"] = score
            d["score_band"] = band
        except Exception:
            pass
    return scenario


@router.get("/distribution", response_model=AnalyticsResponse)
async def get_distribution(
    segment: Optional[str] = Query(None),
    scenario_id: Optional[str] = Query(None),
    bins: int = Query(10, ge=5, le=50),
    db: AsyncSession = Depends(get_db),
):
    deals = await _load_deals(db, segment)

    if scenario_id:
        await _rescore_deals(db, deals, scenario_id)

    scores = [d["computed_score"] for d in deals if d.get("computed_score") is not None]
    return compute_distribution(scores, num_bins=bins)


@router.get("/win-rate", response_model=List[WinRateByBand])
async def get_win_rate(
    segment: Optional[str] = Query(None),
    scenario_id: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db),
):
    deals = await _load_deals(db, segment)

    if scenario_id:
        await _rescore_deals(db, deals, scenario_id)

    return win_rate_by_band(deals)


@router.get("/backtest", response_model=BacktestResult)
async def get_backtest(
    scenario_id: Optional[str] = Query(None),
    segment: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db),
):
    deals = await _load_deals(db, segment)
    sc_id = "baseline"
    sc_name = "Baseline"
    hot_min, warm_min, nurture_min = 80.0, 60.0, 40.0

    if scenario_id:
        scenario = await _rescore_deals(db, deals, scenario_id)
        sc_id = scenario.id
        sc_name = scenario.name
        hot_min = scenario.bands.hot_min
        warm_min = scenario.bands.warm_min
        nurture_min = scenario.bands.nurture_min

    return backtest_scenario(deals, sc_id, sc_name, "computed_score", hot_min, warm_min, nurture_min)


@router.get("/confusion-matrix", response_model=ConfusionMatrixResult)
async def get_confusion_matrix(
    scenario_id: Optional[str] = Query(None),
    threshold: float = Query(60.0),
    segment: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db),
):
    deals = await _load_deals(db, segment)

    if scenario_id:
        await _rescore_deals(db, deals, scenario_id)

    return confusion_matrix(deals, threshold=threshold)


@router.get("/roc", response_model=List[ROCPoint])
async def get_roc(
    scenario_id: Optional[str] = Query(None),
    segment: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db),
):
    deals = await _load_deals(db, segment)

    if scenario_id:
        await _rescore_deals(db, deals, scenario_id)

    return roc_curve(deals)


@router.get("/revenue-impact", response_model=List[RevenueImpact])
async def get_revenue_impact(
    scenario_id: Optional[str] = Query(None),
    segment: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db),
):
    deals = await _load_deals(db, segment)

    if scenario_id:
        await _rescore_deals(db, deals, scenario_id)

    return revenue_impact_analysis(deals)


@router.get("/compare", response_model=CohortComparison)
async def compare(
    scenario_a: str = Query(...),
    scenario_b: str = Query(...),
    db: AsyncSession = Depends(get_db),
):
    sc_a = await get_scenario(db, scenario_a)
    sc_b = await get_scenario(db, scenario_b)
    if sc_a is None or sc_b is None:
        raise HTTPException(status_code=404, detail="Scenario not found")

    deals = await _load_deals(db)

    scores_a = {}
    scores_b = {}
    for d in deals:
        did = d.get("id")
        try:
            sa, _ = score_deal_simple(
                d, weights=sc_a.weights, gates=sc_a.gates,
                bands=sc_a.bands, lookup_overrides=sc_a.lookups or None,
                simulations=getattr(sc_a, "simulations", None),
            )
            scores_a[did] = sa
        except Exception:
            pass
        try:
            sb, _ = score_deal_simple(
                d, weights=sc_b.weights, gates=sc_b.gates,
                bands=sc_b.bands, lookup_overrides=sc_b.lookups or None,
                simulations=getattr(sc_b, "simulations", None),
            )
            scores_b[did] = sb
        except Exception:
            pass

    return compare_scenarios(
        deals, scores_a, scores_b,
        sc_a.id, sc_b.id,
        hot_min=sc_a.bands.hot_min,
        warm_min=sc_a.bands.warm_min,
        nurture_min=sc_a.bands.nurture_min,
    )
