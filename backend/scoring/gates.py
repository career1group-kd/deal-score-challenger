"""
Gate / cap logic.

Gates impose hard ceilings on the final score regardless of how high
the raw component scores are.  The MINIMUM of all triggered caps wins.
"""

from __future__ import annotations
from typing import List, Optional, TYPE_CHECKING

from models.schemas import GateResult, GateConfig

if TYPE_CHECKING:
    from database.db import Deal


def evaluate_gates(
    deal_data: dict,
    gate_config: GateConfig,
    segment: str,
) -> List[GateResult]:
    """Return a list of gate evaluations for a deal."""
    results: List[GateResult] = []

    # --- Deutsch Gate (all segments) ---
    if gate_config.deutsch_gate.enabled:
        niveau = deal_data.get("deutsch_niveau") or ""
        triggered = niveau.upper() in ("A1-A2", "A1", "A2", "B1")
        results.append(GateResult(
            gate_name="deutsch_gate",
            triggered=triggered,
            cap_value=gate_config.deutsch_gate.cap if triggered else None,
            reason=f"Deutsch-Niveau: {niveau}" if triggered else None,
        ))

    # --- PC + Internet Gate (all segments) ---
    if gate_config.pc_internet_gate.enabled:
        pc = deal_data.get("pc_internet") or ""
        triggered = pc == "Nein"
        results.append(GateResult(
            gate_name="pc_internet_gate",
            triggered=triggered,
            cap_value=gate_config.pc_internet_gate.cap if triggered else None,
            reason=f"PC+Internet: {pc}" if triggered else None,
        ))

    # --- JC Ablehnung Gate (only Arbeitsloser) ---
    if gate_config.jc_ablehnung_gate.enabled and segment == "arbeitsloser":
        jc = deal_data.get("jc_ablehnung") or ""
        triggered = jc in ("Ja", "JC lehnt WB ab")
        results.append(GateResult(
            gate_name="jc_ablehnung_gate",
            triggered=triggered,
            cap_value=gate_config.jc_ablehnung_gate.cap if triggered else None,
            reason=f"JC-Ablehnung: {jc}" if triggered else None,
        ))

    return results


def apply_gate_cap(raw_score: float, gate_results: List[GateResult]) -> float:
    """Apply the lowest triggered cap. Returns MIN(raw_score, lowest_cap)."""
    caps = [g.cap_value for g in gate_results if g.triggered and g.cap_value is not None]
    if not caps:
        return raw_score
    lowest_cap = min(caps)
    return min(raw_score, lowest_cap)
