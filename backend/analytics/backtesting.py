"""
Win/Loss backtesting analysis.

Provides win rate by band, precision/recall/F1, confusion matrix,
optimal cutoff finder, ROC curve, and revenue impact analysis.
"""

from __future__ import annotations

from typing import List, Dict, Tuple

import numpy as np

from models.schemas import (
    WinRateByBand, BacktestResult, ConfusionMatrixResult,
    ROCPoint, RevenueImpact,
)


def _classify_band(score: float, hot_min: float = 80, warm_min: float = 60, nurture_min: float = 40) -> str:
    if score >= hot_min:
        return "Hot"
    if score >= warm_min:
        return "Warm"
    if score >= nurture_min:
        return "Nurture"
    return "Cold"


def win_rate_by_band(
    deals: List[dict],
    score_key: str = "computed_score",
    hot_min: float = 80,
    warm_min: float = 60,
    nurture_min: float = 40,
) -> List[WinRateByBand]:
    """Calculate win rate for each band."""
    buckets: Dict[str, dict] = {
        b: {"total": 0, "won": 0, "lost": 0} for b in ("Hot", "Warm", "Nurture", "Cold")
    }
    for d in deals:
        score = d.get(score_key)
        is_closed = d.get("is_closed", False)
        if score is None or not is_closed:
            continue
        band = _classify_band(score, hot_min, warm_min, nurture_min)
        buckets[band]["total"] += 1
        if d.get("is_won"):
            buckets[band]["won"] += 1
        else:
            buckets[band]["lost"] += 1

    results = []
    for band_name in ("Hot", "Warm", "Nurture", "Cold"):
        b = buckets[band_name]
        wr = b["won"] / b["total"] if b["total"] > 0 else 0.0
        results.append(WinRateByBand(
            band=band_name, total=b["total"], won=b["won"],
            lost=b["lost"], win_rate=round(wr, 4),
        ))
    return results


def confusion_matrix(
    deals: List[dict],
    threshold: float = 60.0,
    score_key: str = "computed_score",
) -> ConfusionMatrixResult:
    """
    Binary confusion matrix.
    Predicted positive = score >= threshold.
    Actual positive = is_won.
    Only considers closed deals.
    """
    tp = fp = tn = fn = 0
    for d in deals:
        score = d.get(score_key)
        is_closed = d.get("is_closed", False)
        if score is None or not is_closed:
            continue
        predicted_positive = score >= threshold
        actual_positive = bool(d.get("is_won"))
        if predicted_positive and actual_positive:
            tp += 1
        elif predicted_positive and not actual_positive:
            fp += 1
        elif not predicted_positive and actual_positive:
            fn += 1
        else:
            tn += 1

    total = tp + fp + tn + fn
    accuracy = (tp + tn) / total if total else 0
    precision = tp / (tp + fp) if (tp + fp) else 0
    recall = tp / (tp + fn) if (tp + fn) else 0
    f1 = 2 * precision * recall / (precision + recall) if (precision + recall) else 0

    return ConfusionMatrixResult(
        true_positive=tp, false_positive=fp,
        true_negative=tn, false_negative=fn,
        accuracy=round(accuracy, 4),
        precision=round(precision, 4),
        recall=round(recall, 4),
        f1_score=round(f1, 4),
        threshold=threshold,
    )


def find_optimal_cutoff(
    deals: List[dict],
    score_key: str = "computed_score",
    thresholds: List[float] | None = None,
) -> float:
    """Find threshold that maximises F1 score."""
    if thresholds is None:
        thresholds = [float(t) for t in range(10, 95, 5)]
    best_f1 = 0.0
    best_t = 60.0
    for t in thresholds:
        cm = confusion_matrix(deals, threshold=t, score_key=score_key)
        if cm.f1_score > best_f1:
            best_f1 = cm.f1_score
            best_t = t
    return best_t


def roc_curve(
    deals: List[dict],
    score_key: str = "computed_score",
) -> List[ROCPoint]:
    """Compute ROC curve points."""
    thresholds = [float(t) for t in range(0, 105, 5)]
    points = []
    for t in thresholds:
        tp = fp = tn = fn = 0
        for d in deals:
            score = d.get(score_key)
            is_closed = d.get("is_closed", False)
            if score is None or not is_closed:
                continue
            predicted = score >= t
            actual = bool(d.get("is_won"))
            if predicted and actual:
                tp += 1
            elif predicted and not actual:
                fp += 1
            elif not predicted and actual:
                fn += 1
            else:
                tn += 1
        tpr = tp / (tp + fn) if (tp + fn) else 0
        fpr = fp / (fp + tn) if (fp + tn) else 0
        points.append(ROCPoint(threshold=t, tpr=round(tpr, 4), fpr=round(fpr, 4)))
    return points


def revenue_impact_analysis(
    deals: List[dict],
    score_key: str = "computed_score",
    thresholds: List[float] | None = None,
) -> List[RevenueImpact]:
    """Revenue impact at various thresholds."""
    if thresholds is None:
        thresholds = [30.0, 40.0, 50.0, 60.0, 70.0, 80.0, 90.0]
    results = []
    for t in thresholds:
        above = [d for d in deals if d.get(score_key) is not None and d.get(score_key) >= t and d.get("is_closed")]
        below = [d for d in deals if d.get(score_key) is not None and d.get(score_key) < t and d.get("is_closed")]
        rev_above = sum(d.get("amount", 0) or 0 for d in above if d.get("is_won"))
        rev_below = sum(d.get("amount", 0) or 0 for d in below if d.get("is_won"))
        wr_above = sum(1 for d in above if d.get("is_won")) / len(above) if above else 0
        wr_below = sum(1 for d in below if d.get("is_won")) / len(below) if below else 0
        results.append(RevenueImpact(
            threshold=t,
            deals_above=len(above),
            deals_below=len(below),
            revenue_above=round(rev_above, 2),
            revenue_below=round(rev_below, 2),
            win_rate_above=round(wr_above, 4),
            win_rate_below=round(wr_below, 4),
        ))
    return results


def backtest_scenario(
    deals: List[dict],
    scenario_id: str,
    scenario_name: str,
    score_key: str = "computed_score",
    hot_min: float = 80, warm_min: float = 60, nurture_min: float = 40,
) -> BacktestResult:
    """Full backtest for a scenario."""
    closed_deals = [d for d in deals if d.get("is_closed") and d.get(score_key) is not None]
    wr = win_rate_by_band(closed_deals, score_key, hot_min, warm_min, nurture_min)
    optimal = find_optimal_cutoff(closed_deals, score_key)
    cm = confusion_matrix(closed_deals, threshold=optimal, score_key=score_key)
    rev = revenue_impact_analysis(closed_deals, score_key)
    rev_dict = {str(r.threshold): r.revenue_above for r in rev}

    return BacktestResult(
        scenario_id=scenario_id,
        scenario_name=scenario_name,
        total_deals=len(closed_deals),
        win_rates_by_band=wr,
        precision=cm.precision,
        recall=cm.recall,
        f1_score=cm.f1_score,
        optimal_cutoff=optimal,
        revenue_impact=rev_dict,
    )
