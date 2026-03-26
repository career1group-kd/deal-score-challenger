"""
Score distribution analysis and histogram generation.
"""

from __future__ import annotations

from typing import List, Dict, Optional

import numpy as np

from models.schemas import DistributionBin, AnalyticsResponse


def compute_distribution(
    scores: List[float],
    num_bins: int = 10,
    band_thresholds: Optional[Dict[str, float]] = None,
) -> AnalyticsResponse:
    """Compute histogram bins and summary stats from a list of scores."""
    if not scores:
        return AnalyticsResponse(
            total_deals=0,
            mean_score=0.0,
            median_score=0.0,
            std_dev=0.0,
            distribution=[],
            band_counts={"Hot": 0, "Warm": 0, "Nurture": 0, "Cold": 0},
        )

    arr = np.array(scores, dtype=float)
    thresholds = band_thresholds or {"hot_min": 80, "warm_min": 60, "nurture_min": 40}
    hot_min = thresholds.get("hot_min", 80)
    warm_min = thresholds.get("warm_min", 60)
    nurture_min = thresholds.get("nurture_min", 40)

    # Band counts
    band_counts = {
        "Hot": int(np.sum(arr >= hot_min)),
        "Warm": int(np.sum((arr >= warm_min) & (arr < hot_min))),
        "Nurture": int(np.sum((arr >= nurture_min) & (arr < warm_min))),
        "Cold": int(np.sum(arr < nurture_min)),
    }

    # Histogram
    counts, bin_edges = np.histogram(arr, bins=num_bins, range=(0, 100))
    total = len(scores)
    distribution = []
    for i in range(len(counts)):
        distribution.append(DistributionBin(
            bin_start=round(float(bin_edges[i]), 1),
            bin_end=round(float(bin_edges[i + 1]), 1),
            count=int(counts[i]),
            percentage=round(float(counts[i]) / total * 100, 1) if total else 0,
        ))

    return AnalyticsResponse(
        total_deals=total,
        mean_score=round(float(np.mean(arr)), 2),
        median_score=round(float(np.median(arr)), 2),
        std_dev=round(float(np.std(arr)), 2),
        distribution=distribution,
        band_counts=band_counts,
    )
