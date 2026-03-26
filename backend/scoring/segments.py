"""
Segment-specific routing.

Determines which calculator (Rechner A/B/C) to use based on the
segment_neu field on the deal.
"""

from __future__ import annotations
from typing import Optional

from hubspot.field_mapping import get_calculator_segment


# Canonical segment keys used by the calculators
VALID_SEGMENTS = {"arbeitender", "unternehmer", "arbeitsloser"}

# For display labels
SEGMENT_LABELS = {
    "arbeitender": "Arbeitender Mensch",
    "unternehmer": "Unternehmer",
    "arbeitsloser": "Arbeitsloser Mensch",
}


def resolve_segment(segment_neu: Optional[str], pipeline: Optional[str] = None) -> str:
    """
    Return the canonical segment key (lowercase).
    First checks if it's already a canonical key, then tries HubSpot mapping.
    Raises ValueError for unknown segments.
    """
    if segment_neu is None:
        raise ValueError("segment_neu is required for scoring")

    seg = segment_neu.strip().lower()

    # Already a canonical key?
    if seg in VALID_SEGMENTS:
        return seg

    # Try mapping from HubSpot value
    mapped = get_calculator_segment(segment_neu.strip(), pipeline)
    if mapped and mapped in VALID_SEGMENTS:
        return mapped

    raise ValueError(f"Unknown segment: {segment_neu}. Expected one of {VALID_SEGMENTS}")


def get_calculator_id(segment: str) -> str:
    """Return 'A', 'B', or 'C'."""
    return {"arbeitender": "A", "unternehmer": "B", "arbeitsloser": "C"}.get(segment, "A")
