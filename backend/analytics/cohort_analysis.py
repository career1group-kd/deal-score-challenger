"""
Cohort comparisons between two scenarios.
"""

from __future__ import annotations

from typing import List, Dict

from models.schemas import CohortComparison


def _classify(score: float, hot_min: float = 80, warm_min: float = 60, nurture_min: float = 40) -> str:
    if score >= hot_min:
        return "Hot"
    if score >= warm_min:
        return "Warm"
    if score >= nurture_min:
        return "Nurture"
    return "Cold"


def compare_scenarios(
    deals: List[dict],
    scores_a: Dict[str, float],  # deal_id -> score
    scores_b: Dict[str, float],  # deal_id -> score
    scenario_a_id: str,
    scenario_b_id: str,
    hot_min: float = 80,
    warm_min: float = 60,
    nurture_min: float = 40,
) -> CohortComparison:
    """
    Compare two scenarios across the same deals.
    Returns score deltas, band migration matrix, and win rate comparison.
    """
    bands = ["Hot", "Warm", "Nurture", "Cold"]

    # Score deltas (mean by segment)
    segment_deltas: Dict[str, List[float]] = {}
    # Band migration: from_band -> to_band -> count
    migration: Dict[str, Dict[str, int]] = {b: {bb: 0 for bb in bands} for b in bands}
    # Win rates by band for each scenario
    wr_a: Dict[str, Dict[str, int]] = {b: {"won": 0, "total": 0} for b in bands}
    wr_b: Dict[str, Dict[str, int]] = {b: {"won": 0, "total": 0} for b in bands}

    for d in deals:
        did = d.get("id")
        if did not in scores_a or did not in scores_b:
            continue
        sa = scores_a[did]
        sb = scores_b[did]
        segment = d.get("segment_neu", "Unknown")

        # Delta
        segment_deltas.setdefault(segment, []).append(sb - sa)

        # Band migration
        band_a = _classify(sa, hot_min, warm_min, nurture_min)
        band_b = _classify(sb, hot_min, warm_min, nurture_min)
        migration[band_a][band_b] += 1

        # Win rates
        if d.get("is_closed") and d.get("is_won") is not None:
            wr_a[band_a]["total"] += 1
            wr_b[band_b]["total"] += 1
            if d.get("is_won"):
                wr_a[band_a]["won"] += 1
                wr_b[band_b]["won"] += 1

    score_deltas = {
        seg: round(sum(deltas) / len(deltas), 2) if deltas else 0.0
        for seg, deltas in segment_deltas.items()
    }

    win_rate_comp: Dict[str, Dict[str, float]] = {}
    for b in bands:
        win_rate_comp[b] = {
            "scenario_a": round(wr_a[b]["won"] / wr_a[b]["total"], 4) if wr_a[b]["total"] else 0,
            "scenario_b": round(wr_b[b]["won"] / wr_b[b]["total"], 4) if wr_b[b]["total"] else 0,
        }

    return CohortComparison(
        scenario_a_id=scenario_a_id,
        scenario_b_id=scenario_b_id,
        score_deltas=score_deltas,
        band_migration=migration,
        win_rate_comparison=win_rate_comp,
    )
