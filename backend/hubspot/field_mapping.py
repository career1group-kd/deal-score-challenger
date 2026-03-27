"""
Mapping between HubSpot CRM field names and the internal deal model.
Updated with real HubSpot field names and segment/stage values.
"""

from __future__ import annotations
from datetime import datetime, timezone, timedelta
from typing import Any, Dict, Optional

# HubSpot property -> internal field
DEAL_FIELD_MAP: Dict[str, str] = {
    "hs_object_id": "hubspot_deal_id",
    "dealname": "deal_name",
    "dealstage": "deal_stage",
    "pipeline": "pipeline",
    "amount": "amount",
    "closedate": "close_date",
    "createdate": "create_date",
    "hubspot_owner_id": "owner_id",
    "hs_lastmodifieddate": "hs_lastmodifieddate",
    "hs_deal_stage_probability": "stage_probability",
    # Scoring-relevant fields
    "segment_neu": "segment_neu",
    "rating_setter___closer": "setter_rating",
    "deutsch_sprachniveau": "deutsch_niveau",
    "pc_und_internet_vorhanden_": "pc_internet",
    "fachgebiet_ebene_1": "fachgebiet",
    "produkt": "produkt",
    "rating_company": "rating_company",
    "notes_last_contacted": "notes_last_contacted",
    "notes_next_activity_date": "notes_next_activity_date",
    "num_notes": "num_notes",
    "naechstes_feedbackgespraech_datum": "naechstes_feedbackgespraech_datum",
    "feedbackgesprach_status": "feedbackgesprach_status",
    # New recommended fields (if they exist in HubSpot)
    "deal_score_funding_clarity": "finanzierung",
    "deal_score_decision_clarity": "entscheidungssituation",
    "deal_score_product_fit": "produktfit",
    "deal_score_documents_complete": "unterlagen",
    "jc_verifizierungsstatus": "jc_status",
}

# Contact-level fields pulled via deal association
CONTACT_PROPERTIES = ["frist_incoming_lead_score", "zustandiges_amt"]

DATE_FIELDS = {
    "close_date", "create_date", "notes_last_contacted",
    "notes_next_activity_date", "hs_lastmodifieddate",
    "naechstes_feedbackgespraech_datum",
}

# ---------------------------------------------------------------------------
# Segment mapping: real HubSpot segment_neu values → internal calculator
# ---------------------------------------------------------------------------
# FbW = Förderung beruflicher Weiterbildung (gefördert → Arbeitsloser Mensch / chapternext)
# SZ P = Selbstzahler Privat (selbstzahlend → Unternehmer)
# FbW - WB QCG = QCG Weiterbildung (arbeitend → Arbeitender Mensch / onecareer)

SEGMENT_CALCULATOR_MAP: Dict[str, str] = {
    "FbW - WB BGS": "arbeitsloser",
    "FbW - WB QCG": "arbeitender",
    "SZ P": "unternehmer",
}

# Fallback: if segment not in map, try to guess from pipeline
PIPELINE_SEGMENT_FALLBACK: Dict[str, str] = {
    "default": "arbeitender",          # OneCareer pipeline
    "327839987": "arbeitsloser",        # ChapterNext pipeline
    "169628399": "unternehmer",         # AVGS pipeline
}


def get_calculator_segment(segment_neu: Optional[str], pipeline: Optional[str] = None) -> Optional[str]:
    """Map HubSpot segment_neu to calculator type."""
    if segment_neu and segment_neu in SEGMENT_CALCULATOR_MAP:
        return SEGMENT_CALCULATOR_MAP[segment_neu]
    if pipeline and pipeline in PIPELINE_SEGMENT_FALLBACK:
        return PIPELINE_SEGMENT_FALLBACK[pipeline]
    return None


# ---------------------------------------------------------------------------
# Pipeline stage IDs for Won/Lost detection
# ---------------------------------------------------------------------------

WON_STAGE_IDS = {
    "159128799",    # OneCareer → Gewonnen
    "518300393",    # ChapterNext → Gewonnen
    "312441326",    # AVGS → Gewonnen
}

LOST_STAGE_IDS = {
    "159128800",    # OneCareer → Verloren
    "518300394",    # ChapterNext → Verloren
    "312441327",    # AVGS → Verloren
}

CLOSED_STAGE_IDS = WON_STAGE_IDS | LOST_STAGE_IDS

PIPELINE_LABELS = {
    "default": "OneCareer",
    "327839987": "ChapterNext",
    "169628399": "AVGS Deals",
}

STAGE_LABELS = {
    "decisionmakerboughtin": "Angebot erstellen",
    "158273264": "Zustimmung Teilnehmer",
    "159128797": "Zustimmung Berater",
    "159128799": "Gewonnen",
    "172090082": "on Hold",
    "159128800": "Verloren",
    "518300389": "Angebot erstellen",
    "518300388": "Zustimmung Teilnehmer",
    "518300390": "Zustimmung Berater",
    "518300393": "Gewonnen",
    "518300391": "on Hold",
    "518300394": "Verloren",
    "312441323": "Angebot erstellen",
    "312441324": "Zustimmung Teilnehmer",
    "312441325": "Zustimmung Berater",
    "312441326": "Gewonnen",
    "375243204": "on Hold",
    "312441327": "Verloren",
}


# ---------------------------------------------------------------------------
# Date parsing
# ---------------------------------------------------------------------------

def parse_hs_date(val: Any) -> Optional[datetime]:
    if val is None:
        return None
    if isinstance(val, datetime):
        return val
    try:
        if isinstance(val, (int, float)):
            return datetime.fromtimestamp(val / 1000, tz=timezone.utc)
        return datetime.fromisoformat(str(val).replace("Z", "+00:00"))
    except Exception:
        return None


# ---------------------------------------------------------------------------
# Main mapping function
# ---------------------------------------------------------------------------

def map_hubspot_deal(hs_properties: Dict[str, Any]) -> Dict[str, Any]:
    """Convert a HubSpot properties dict to internal deal dict."""
    out: Dict[str, Any] = {}
    for hs_key, internal_key in DEAL_FIELD_MAP.items():
        val = hs_properties.get(hs_key)
        if val is None:
            continue
        if internal_key in DATE_FIELDS:
            out[internal_key] = parse_hs_date(val)
        elif internal_key == "amount":
            try:
                out[internal_key] = float(val)
            except (ValueError, TypeError):
                out[internal_key] = None
        elif internal_key == "num_notes":
            try:
                out[internal_key] = int(float(val))
            except (ValueError, TypeError):
                out[internal_key] = None
        else:
            out[internal_key] = val

    # Derive is_won / is_closed from actual stage IDs
    stage = hs_properties.get("dealstage") or ""
    out["is_won"] = stage in WON_STAGE_IDS
    out["is_closed"] = stage in CLOSED_STAGE_IDS

    return out


# ---------------------------------------------------------------------------
# Derived field functions
# ---------------------------------------------------------------------------

def derive_response_speed(notes_last_contacted: Optional[datetime]) -> str:
    """Derive reaktionsgeschwindigkeit from notes_last_contacted."""
    if notes_last_contacted is None:
        return ">7 Tage / keine Antwort"
    now = datetime.now(timezone.utc)
    delta = now - notes_last_contacted
    if delta < timedelta(hours=24):
        return "<24h"
    if delta < timedelta(days=3):
        return "1-2 Tage"
    if delta < timedelta(days=8):
        return "3-7 Tage"
    return ">7 Tage / keine Antwort"


def derive_stage_aging(hs_lastmodifieddate: Optional[datetime]) -> str:
    """Derive stage aging category from hs_lastmodifieddate."""
    if hs_lastmodifieddate is None:
        return ">30 Tage ohne Fortschritt"
    now = datetime.now(timezone.utc)
    delta = now - hs_lastmodifieddate
    if delta.days < 15:
        return "<15 Tage / aktiver Fortschritt"
    if delta.days <= 30:
        return "15-30 Tage"
    return ">30 Tage ohne Fortschritt"


def derive_next_step_freshness(notes_next_activity_date: Optional[datetime]) -> str:
    """Derive next_step from notes_next_activity_date."""
    if notes_next_activity_date is None:
        return "Kein Next Step"
    now = datetime.now(timezone.utc)
    days_until = (notes_next_activity_date - now).days
    if days_until >= 0 and days_until <= 7:
        return "Aktuell <= 7 Tage"
    if days_until < 0 and abs(days_until) <= 7:
        return "Aelter als 7 Tage"
    return "Kein Next Step"


def derive_has_scheduled_activity(notes_next_activity_date: Optional[datetime]) -> bool:
    """Check if there is a future scheduled activity."""
    if notes_next_activity_date is None:
        return False
    return notes_next_activity_date > datetime.now(timezone.utc)


# ---------------------------------------------------------------------------
# NEW derived fields
# ---------------------------------------------------------------------------

def derive_aktivitaet_from_notes(num_notes: Any) -> str:
    """Derive Aktivitaet category from num_notes count.

    Categories: <3, 3-6, 6-12, >12
    """
    if num_notes is None:
        return "<3"
    try:
        n = int(float(str(num_notes)))
    except (ValueError, TypeError):
        return "<3"
    if n < 3:
        return "<3"
    if n <= 6:
        return "3-6"
    if n <= 12:
        return "6-12"
    return ">12"


def derive_next_step_feedback(
    feedbackgesprach_datum: Optional[datetime],
    feedbackgesprach_status: Optional[str],
) -> str:
    """Derive next step from feedback date and status.

    Returns one of:
      - FollowUp nicht notwendig  (status == "Nicht notwendig")
      - FollowUp in der Zukunft   (date in the future)
      - FollowUp in der Vergangenheit (date in the past)
      - Kein FollowUp gesetzt      (no date, not "nicht notwendig")
    """
    if feedbackgesprach_status and feedbackgesprach_status.strip().lower() == "nicht notwendig":
        return "FollowUp nicht notwendig"
    if feedbackgesprach_datum is None:
        return "Kein FollowUp gesetzt"
    now = datetime.now(timezone.utc)
    if feedbackgesprach_datum > now:
        return "FollowUp in der Zukunft"
    return "FollowUp in der Vergangenheit"


def derive_setter_rating_avg(
    rating_company: Any,
    produkt: Any,
    rating_setter_closer: Any,
) -> str:
    """Compute average of up to 3 rating fields (each 1-10 scale).

    Returns one of: 1-5, 6-8, 9-10, Keine Angabe
    """
    values = []
    for raw in [rating_company, produkt, rating_setter_closer]:
        if raw is None:
            continue
        try:
            v = float(str(raw))
            if 1 <= v <= 10:
                values.append(v)
        except (ValueError, TypeError):
            continue
    if not values:
        return "Keine Angabe"
    avg = sum(values) / len(values)
    if avg <= 5:
        return "1-5"
    if avg <= 8:
        return "6-8"
    return "9-10"
