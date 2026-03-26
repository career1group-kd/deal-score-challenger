"""
Complete scoring engine.

Calculates a 0-100 deal score using segment-specific calculators,
lookup tables, custom weights, and gate/cap logic.
"""

from __future__ import annotations

import hashlib
from typing import Dict, Any, List, Optional

from models.schemas import (
    ScenarioWeights, GateConfig, BandThresholds,
    ScoreComponent, GateResult, DealScoreBreakdown,
    FieldSimulations,
)
from scoring.segments import resolve_segment, get_calculator_id
from scoring.gates import evaluate_gates, apply_gate_cap
from scoring.lookups import lookup_value, DEFAULT_LOOKUPS


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _lead_score_normalised(raw: float | None, max_points: float = 22) -> float:
    """Normalise HubSpot lead score (0-100) into the weight bucket."""
    if raw is None:
        return 0.0
    clamped = max(0.0, min(float(raw), 100.0))
    return (clamped / 100.0) * max_points


def _simulate_field_value(deal_id: str, field: str, distribution: dict[str, float]) -> str | None:
    """Deterministically assign a simulated value based on deal_id + field hash."""
    if not distribution:
        return None
    # Create deterministic hash
    h = hashlib.md5(f"{deal_id}:{field}".encode()).hexdigest()
    hash_val = int(h[:8], 16) / 0xFFFFFFFF  # 0.0 - 1.0

    cumulative = 0.0
    for value, probability in distribution.items():
        cumulative += probability
        if hash_val <= cumulative:
            return value
    return list(distribution.keys())[-1]


def _maybe_simulate(deal: dict, field: str, sim_rules: dict[str, dict[str, float]]) -> tuple[str | None, bool]:
    """Return (value, is_simulated). Simulates if None and a rule exists."""
    val = deal.get(field)
    if val is not None:
        return val, False
    if field in sim_rules:
        deal_id = str(deal.get("id", "unknown"))
        simulated = _simulate_field_value(deal_id, field, sim_rules[field])
        return simulated, True
    return None, False


def _component(field: str, label: str, raw_value: str | None,
               lookup_table: str, weight: float,
               overrides: dict | None = None,
               is_simulated: bool = False) -> ScoreComponent:
    lv = lookup_value(lookup_table, raw_value, overrides)
    return ScoreComponent(
        field=field,
        label=label,
        raw_value=raw_value,
        lookup_value=lv,
        weight=weight,
        weighted_score=round(lv * weight, 2),
        is_simulated=is_simulated,
    )


# ---------------------------------------------------------------------------
# Segment calculators
# ---------------------------------------------------------------------------

def _calc_arbeitender(deal: dict, w: ScenarioWeights, overrides: dict | None,
                      sim_rules: dict[str, dict[str, float]] | None = None) -> List[ScoreComponent]:
    """Rechner A: Arbeitender – max 100 pts."""
    sr = sim_rules or {}
    comps = []
    # Lead score (special: numeric normalisation)
    lead_raw = deal.get("lead_score_contact")
    lead_pts = round(_lead_score_normalised(lead_raw, w.a_lead), 2)
    comps.append(ScoreComponent(
        field="lead_score_contact", label="Lead-Score",
        raw_value=str(lead_raw) if lead_raw is not None else None,
        lookup_value=round(lead_pts / w.a_lead, 2) if w.a_lead else 0,
        weight=w.a_lead, weighted_score=lead_pts,
    ))
    comps.append(_component("setter_rating", "Setter-Rating",
                            deal.get("setter_rating"), "setter_rating", w.a_setter, overrides))
    v, s = _maybe_simulate(deal, "finanzierung", sr)
    comps.append(_component("finanzierung", "Finanzierung", v, "finanzierung", w.a_finanzierung, overrides, s))
    v, s = _maybe_simulate(deal, "entscheidungssituation", sr)
    comps.append(_component("entscheidungssituation", "Entscheidung", v, "decision", w.a_decision, overrides, s))
    comps.append(_component("reaktionsgeschwindigkeit", "Reaktion",
                            deal.get("reaktionsgeschwindigkeit"), "reaktion", w.a_reaktion, overrides))
    comps.append(_component("next_step", "Next Step",
                            deal.get("next_step"), "next_step", w.a_next_step, overrides))
    comps.append(_component("aktivitaet", "Aktivitaet",
                            deal.get("aktivitaet"), "aktivitaet", w.a_aktivitaet, overrides))
    comps.append(_component("stage_aging", "Aging",
                            deal.get("stage_aging"), "aging", w.a_aging, overrides))
    v, s = _maybe_simulate(deal, "produktfit", sr)
    comps.append(_component("produktfit", "Produktfit", v, "produktfit", w.a_produkt, overrides, s))
    v, s = _maybe_simulate(deal, "arbeitgeber_fit", sr)
    comps.append(_component("arbeitgeber_fit", "AG-Fit", v, "arbeitgeber_fit", w.a_ag_fit, overrides, s))
    return comps


def _calc_unternehmer(deal: dict, w: ScenarioWeights, overrides: dict | None,
                      sim_rules: dict[str, dict[str, float]] | None = None) -> List[ScoreComponent]:
    """Rechner B: Unternehmer – max 100 pts."""
    sr = sim_rules or {}
    comps = []
    lead_raw = deal.get("lead_score_contact")
    lead_pts = round(_lead_score_normalised(lead_raw, w.b_lead), 2)
    comps.append(ScoreComponent(
        field="lead_score_contact", label="Lead-Score",
        raw_value=str(lead_raw) if lead_raw is not None else None,
        lookup_value=round(lead_pts / w.b_lead, 2) if w.b_lead else 0,
        weight=w.b_lead, weighted_score=lead_pts,
    ))
    comps.append(_component("setter_rating", "Setter-Rating",
                            deal.get("setter_rating"), "setter_rating", w.b_setter, overrides))
    v, s = _maybe_simulate(deal, "budget_vorhanden", sr)
    comps.append(_component("budget_vorhanden", "Budget", v, "budget", w.b_budget, overrides, s))
    v, s = _maybe_simulate(deal, "roi_erwartung", sr)
    comps.append(_component("roi_erwartung", "ROI", v, "roi", w.b_roi, overrides, s))
    comps.append(_component("reaktionsgeschwindigkeit", "Reaktion",
                            deal.get("reaktionsgeschwindigkeit"), "reaktion", w.b_reaktion, overrides))
    comps.append(_component("next_step", "Next Step",
                            deal.get("next_step"), "next_step", w.b_next_step, overrides))
    comps.append(_component("aktivitaet", "Aktivitaet",
                            deal.get("aktivitaet"), "aktivitaet", w.b_aktivitaet, overrides))
    comps.append(_component("stage_aging", "Aging",
                            deal.get("stage_aging"), "aging", w.b_aging, overrides))
    v, s = _maybe_simulate(deal, "produktfit", sr)
    comps.append(_component("produktfit", "Produktfit", v, "produktfit", w.b_produkt, overrides, s))
    v, s = _maybe_simulate(deal, "unternehmensfit", sr)
    comps.append(_component("unternehmensfit", "Company-Fit", v, "unternehmensfit", w.b_company, overrides, s))
    return comps


def _calc_arbeitsloser(deal: dict, w: ScenarioWeights, overrides: dict | None,
                       sim_rules: dict[str, dict[str, float]] | None = None) -> List[ScoreComponent]:
    """Rechner C: Arbeitsloser – max 100 pts."""
    sr = sim_rules or {}
    comps = []
    lead_raw = deal.get("lead_score_contact")
    lead_pts = round(_lead_score_normalised(lead_raw, w.c_lead), 2)
    comps.append(ScoreComponent(
        field="lead_score_contact", label="Lead-Score",
        raw_value=str(lead_raw) if lead_raw is not None else None,
        lookup_value=round(lead_pts / w.c_lead, 2) if w.c_lead else 0,
        weight=w.c_lead, weighted_score=lead_pts,
    ))
    comps.append(_component("setter_rating", "Setter-Rating",
                            deal.get("setter_rating"), "setter_rating", w.c_setter, overrides))
    v, s = _maybe_simulate(deal, "finanzierung", sr)
    comps.append(_component("finanzierung", "Amt/Foerderung", v, "finanzierung", w.c_amt, overrides, s))
    comps.append(_component("reaktionsgeschwindigkeit", "Reaktion",
                            deal.get("reaktionsgeschwindigkeit"), "reaktion", w.c_reaktion, overrides))
    comps.append(_component("next_step", "Next Step",
                            deal.get("next_step"), "next_step", w.c_next_step, overrides))
    comps.append(_component("aktivitaet", "Aktivitaet",
                            deal.get("aktivitaet"), "aktivitaet", w.c_aktivitaet, overrides))
    comps.append(_component("stage_aging", "Aging",
                            deal.get("stage_aging"), "aging", w.c_aging, overrides))
    v, s = _maybe_simulate(deal, "produktfit", sr)
    comps.append(_component("produktfit", "Produktfit", v, "produktfit", w.c_produkt, overrides, s))
    v, s = _maybe_simulate(deal, "unterlagen", sr)
    comps.append(_component("unterlagen", "Unterlagen", v, "unterlagen", w.c_unterlagen, overrides, s))
    v, s = _maybe_simulate(deal, "jc_status", sr)
    comps.append(_component("jc_status", "JC-Status", v, "jc_status", w.c_jc, overrides, s))
    return comps


CALCULATORS = {
    "arbeitender": _calc_arbeitender,
    "unternehmer": _calc_unternehmer,
    "arbeitsloser": _calc_arbeitsloser,
}


# ---------------------------------------------------------------------------
# Band classification
# ---------------------------------------------------------------------------

def classify_band(score: float, bands: BandThresholds) -> str:
    if score >= bands.hot_min:
        return "Hot"
    if score >= bands.warm_min:
        return "Warm"
    if score >= bands.nurture_min:
        return "Nurture"
    return "Cold"


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def _build_sim_rules(simulations: FieldSimulations | None) -> dict[str, dict[str, float]]:
    """Convert FieldSimulations to a flat dict keyed by field name."""
    if not simulations or not simulations.rules:
        return {}
    return {rule.field: rule.distribution for rule in simulations.rules}


def score_deal(
    deal_data: dict,
    weights: ScenarioWeights | None = None,
    gates: GateConfig | None = None,
    bands: BandThresholds | None = None,
    lookup_overrides: dict | None = None,
    simulations: FieldSimulations | None = None,
) -> DealScoreBreakdown:
    """
    Score a single deal. Returns full breakdown with components, gates, band.
    """
    weights = weights or ScenarioWeights()
    gates = gates or GateConfig()
    bands = bands or BandThresholds()
    sim_rules = _build_sim_rules(simulations)

    # Use calculator_segment if available (from HubSpot sync), otherwise resolve
    segment = deal_data.get("calculator_segment")
    if not segment:
        segment = resolve_segment(deal_data.get("segment_neu"), deal_data.get("pipeline"))
    calculator = CALCULATORS.get(segment)
    if not calculator:
        raise ValueError(f"No calculator for segment: {segment}")
    components = calculator(deal_data, weights, lookup_overrides, sim_rules=sim_rules)

    raw_score = round(sum(c.weighted_score for c in components), 2)
    raw_score = min(raw_score, 100.0)

    gate_results = evaluate_gates(deal_data, gates, segment)
    final_score = round(apply_gate_cap(raw_score, gate_results), 2)
    band = classify_band(final_score, bands)

    return DealScoreBreakdown(
        deal_id=deal_data.get("id", "unknown"),
        segment=segment,
        raw_score=raw_score,
        gate_caps=gate_results,
        final_score=final_score,
        band=band,
        components=components,
    )


def score_deal_simple(deal_data: dict, **kwargs) -> tuple[float, str]:
    """Convenience: returns (final_score, band)."""
    bd = score_deal(deal_data, **kwargs)
    return bd.final_score, bd.band
