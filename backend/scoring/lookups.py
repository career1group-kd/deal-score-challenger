"""
Default lookup tables for scoring.

Each lookup maps a field value (German) to a normalised 0-1 score.
The engine multiplies this by the segment weight.

Keys MUST match the values produced by field_mapping.py derive functions
and actual HubSpot field values.
"""

from typing import Dict, Any

DEFAULT_LOOKUPS: Dict[str, Dict[str, float]] = {
    # ---------------------------------------------------------------
    # Finanzierung / Budget / Amt (covers all segments)
    # ---------------------------------------------------------------
    "finanzierung": {
        "Klar / bestaetigt": 1.0,
        "Klar/bestätigt": 1.0,
        "Teilweise klar": 0.5,
        "Nicht klar": 0.0,
    },

    # ---------------------------------------------------------------
    # Entscheidungssituation / Decision (Arbeitender)
    # ---------------------------------------------------------------
    "decision": {
        "Committed / Freigabe klar": 1.0,
        "Committed/Freigabe klar": 1.0,
        "Bekannt": 0.5,
        "Nicht bekannt": 0.0,
    },

    # ---------------------------------------------------------------
    # Reaktionsgeschwindigkeit (derived from response speed)
    # Keys must match derive_response_speed() output
    # ---------------------------------------------------------------
    "reaktion": {
        "<24h": 1.0,
        "1-2 Tage": 0.75,
        "3-7 Tage": 0.375,
        ">7 Tage / keine Antwort": 0.0,
    },

    # ---------------------------------------------------------------
    # Next-Step / FollowUp (from feedbackgespraech_datum + status)
    # Keys must match derive_next_step_feedback() output
    # ---------------------------------------------------------------
    "next_step": {
        "FollowUp nicht notwendig": 0.8,
        "FollowUp in der Zukunft": 1.0,
        "FollowUp in der Vergangenheit": 0.3,
        "Kein FollowUp gesetzt": 0.0,
    },

    # ---------------------------------------------------------------
    # Aktivitaet (from num_notes count)
    # Keys must match derive_aktivitaet_from_notes() output
    # ---------------------------------------------------------------
    "aktivitaet": {
        ">12": 1.0,
        "6-12": 0.7,
        "3-6": 0.4,
        "<3": 0.0,
    },

    # ---------------------------------------------------------------
    # Aging (derived from stage aging)
    # Keys must match derive_stage_aging() output
    # ---------------------------------------------------------------
    "aging": {
        "<15 Tage / aktiver Fortschritt": 1.0,
        "15-30 Tage": 0.5,
        ">30 Tage ohne Fortschritt": 0.0,
    },

    # ---------------------------------------------------------------
    # Produktfit
    # ---------------------------------------------------------------
    "produktfit": {
        "Sehr passend": 1.0,
        "Passend": 0.6,
        "Unklar": 0.0,
    },

    # ---------------------------------------------------------------
    # Arbeitgeber-Fit (only Arbeitender)
    # ---------------------------------------------------------------
    "arbeitgeber_fit": {
        "Stark": 1.0,
        "Solide": 0.5,
        "Unklar": 0.0,
    },

    # ---------------------------------------------------------------
    # Unternehmensfit (only Unternehmer)
    # ---------------------------------------------------------------
    "unternehmensfit": {
        "Stark": 1.0,
        "Solide": 0.5,
        "Unklar": 0.0,
    },

    # ---------------------------------------------------------------
    # Unterlagen (only Arbeitsloser)
    # ---------------------------------------------------------------
    "unterlagen": {
        "Vollstaendig": 1.0,
        "Vollständig": 1.0,
        "Teilweise vollstaendig": 0.5,
        "Teilweise vollständig": 0.5,
        "Unvollstaendig": 0.0,
        "Unvollständig": 0.0,
    },

    # ---------------------------------------------------------------
    # JC-Status (only Arbeitsloser)
    # ---------------------------------------------------------------
    "jc_status": {
        "JC-Berater stimmt WB zu": 1.0,
        "JC-Berater prueft WB": 0.5,
        "JC-Berater prüft WB": 0.5,
        "Nicht relevant": 0.0,
        "JC-Berater lehnt WB ab": 0.0,
    },

    # ---------------------------------------------------------------
    # Setter-Rating (average of rating_company, produkt, rating_setter___closer)
    # Keys must match derive_setter_rating_avg() output
    # ---------------------------------------------------------------
    "setter_rating": {
        "9-10": 1.0,
        "6-8": 0.6,
        "1-5": 0.2,
        "Keine Angabe": 0.0,
    },

    # ---------------------------------------------------------------
    # ROI / Business Case (only Unternehmer)
    # ---------------------------------------------------------------
    "roi": {
        "Klar / wirtschaftlich plausibel": 1.0,
        "Klar/wirtschaftlich plausibel": 1.0,
        "Teilweise klar": 0.5,
        "Nicht klar": 0.0,
    },

    # ---------------------------------------------------------------
    # Budget vorhanden (only Unternehmer – same as finanzierung)
    # ---------------------------------------------------------------
    "budget": {
        "Klar / bestaetigt": 1.0,
        "Klar/bestätigt": 1.0,
        "Teilweise klar": 0.5,
        "Nicht klar": 0.0,
    },

    # ---------------------------------------------------------------
    # Deutsch-Gate lookup (gate, not weighted)
    # ---------------------------------------------------------------
    "deutsch_gate": {
        "C1-C2": None,       # no cap
        "C1": None,
        "C2": None,
        "B2": None,
        "B1-B2": None,
        "B1": 25,            # cap at 25
        "A1-A2": 25,         # cap at 25
        "A1": 25,
        "A2": 25,
    },

    # ---------------------------------------------------------------
    # PC + Internet Gate
    # ---------------------------------------------------------------
    "pc_internet_gate": {
        "Ja": None,          # no cap
        "Nein": 35,          # cap at 35
    },
}


# ---------------------------------------------------------------------------
# Default field simulations for missing/null values
# ---------------------------------------------------------------------------
DEFAULT_SIMULATIONS: Dict[str, Dict[str, float]] = {
    "finanzierung": {"Nicht klar": 0.4, "Teilweise klar": 0.35, "Klar / bestaetigt": 0.25},
    "entscheidungssituation": {"Nicht bekannt": 0.35, "Bekannt": 0.4, "Committed / Freigabe klar": 0.25},
    "produktfit": {"Unklar": 0.3, "Passend": 0.45, "Sehr passend": 0.25},
    "arbeitgeber_fit": {"Unklar": 0.35, "Solide": 0.4, "Stark": 0.25},
    "unternehmensfit": {"Unklar": 0.35, "Solide": 0.4, "Stark": 0.25},
    "unterlagen": {"Unvollstaendig": 0.3, "Teilweise vollstaendig": 0.4, "Vollstaendig": 0.3},
    "jc_status": {"Nicht relevant": 0.2, "JC-Berater prueft WB": 0.35, "JC-Berater stimmt WB zu": 0.35, "JC-Berater lehnt WB ab": 0.1},
    "budget_vorhanden": {"Nicht klar": 0.35, "Teilweise klar": 0.4, "Klar / bestaetigt": 0.25},
    "roi_erwartung": {"Nicht klar": 0.35, "Teilweise klar": 0.4, "Klar / wirtschaftlich plausibel": 0.25},
}


def get_default_simulations() -> Dict[str, Dict[str, float]]:
    """Return sensible default simulation distributions for all missing fields."""
    return DEFAULT_SIMULATIONS.copy()


def get_lookup(name: str, overrides: dict | None = None) -> Dict[str, float]:
    """Return a lookup table, optionally merged with scenario overrides."""
    base = DEFAULT_LOOKUPS.get(name, {}).copy()
    if overrides and name in overrides:
        base.update(overrides[name])
    return base


def lookup_value(table_name: str, key: str | None, overrides: dict | None = None) -> float:
    """Look up a value; return 0.0 for unknown keys."""
    if key is None:
        return 0.0
    table = get_lookup(table_name, overrides)
    return table.get(key, 0.0) or 0.0
