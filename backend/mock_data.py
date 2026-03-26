"""
Mock data generator.

Creates 200 realistic deals with bell-curve-like score distributions
across three segments. Includes a CLI entry point to seed the database.

Usage:
    cd backend && python mock_data.py
"""

from __future__ import annotations

import asyncio
import random
import uuid
from datetime import datetime, timedelta, timezone
from typing import List, Dict, Any

import numpy as np

from database.db import Deal, init_db, async_session
from scoring.engine import score_deal_simple


# ---------------------------------------------------------------------------
# German-language value pools per quality tier
# ---------------------------------------------------------------------------

SEGMENTS = ["Arbeitender", "Arbeitsloser", "Unternehmer"]
SEGMENT_WEIGHTS = [0.40, 0.30, 0.30]

DEAL_NAMES_PREFIX = [
    "Weiterbildung", "Umschulung", "Coaching", "Zertifikatskurs",
    "Qualifizierung", "Fortbildung", "Karriereberatung", "Sprachkurs",
]
DEAL_NAMES_SUFFIX = [
    "IT", "Marketing", "Vertrieb", "Buchhaltung", "Projektmanagement",
    "Data Science", "Cloud Computing", "Cybersecurity", "SAP", "Pflege",
]

SETTER_TIERS = {
    "high": ["A", "A", "B"],
    "mid":  ["B", "B", "C"],
    "low":  ["C", "D", "D", "Keine Angabe"],
}

FINANZ_TIERS = {
    "high": ["Selbstzahler", "Arbeitgeber zahlt", "Ratenzahlung"],
    "mid":  ["Ratenzahlung", "Bildungsgutschein", "Noch unklar"],
    "low":  ["Noch unklar", "Keine Angabe"],
}

DECISION_TIERS = {
    "high": ["Alleinentscheider", "Alleinentscheider", "Ehepartner einbezogen"],
    "mid":  ["Ehepartner einbezogen", "Arbeitgeber muss zustimmen"],
    "low":  ["Noch nicht entschieden", "Keine Angabe"],
}

REAKTION_TIERS = {
    "high": ["<24h", "<24h", "1-2 Tage"],
    "mid":  ["1-2 Tage", "3-7 Tage"],
    "low":  [">7 Tage", "Keine Angabe"],
}

NEXT_STEP_TIERS = {
    "high": ["Termin steht", "Termin steht", "Follow-up geplant"],
    "mid":  ["Follow-up geplant", "Noch offen"],
    "low":  ["Noch offen", "Kein Next Step"],
}

AKTIVITAET_TIERS = {
    "high": ["Sehr aktiv", "Aktiv"],
    "mid":  ["Aktiv", "Maessig"],
    "low":  ["Maessig", "Inaktiv"],
}

AGING_TIERS = {
    "high": ["<15 Tage", "<15 Tage"],
    "mid":  ["<15 Tage", "15-30 Tage"],
    "low":  ["15-30 Tage", ">30 Tage"],
}

PRODUKT_TIERS = {
    "high": ["Perfekt", "Gut"],
    "mid":  ["Gut", "Mittel"],
    "low":  ["Mittel", "Schlecht", "Keine Angabe"],
}

AG_FIT_TIERS = {
    "high": ["Top-Arbeitgeber", "Guter Arbeitgeber"],
    "mid":  ["Guter Arbeitgeber", "Durchschnittlich"],
    "low":  ["Durchschnittlich", "Kleinstunternehmen", "Keine Angabe"],
}

UNTERNEHMEN_TIERS = {
    "high": ["Etabliertes Unternehmen", "Wachstum"],
    "mid":  ["Wachstum", "Start-up"],
    "low":  ["Start-up", "Einzelunternehmer", "Keine Angabe"],
}

BUDGET_TIERS = {
    "high": ["Ja, freigegeben", "Ja, in Planung"],
    "mid":  ["Ja, in Planung", "Teilweise"],
    "low":  ["Nein", "Keine Angabe"],
}

ROI_TIERS = {
    "high": ["Hoch", "Hoch", "Mittel"],
    "mid":  ["Mittel", "Mittel"],
    "low":  ["Niedrig", "Keine Angabe"],
}

UNTERLAGEN_TIERS = {
    "high": ["Vollstaendig", "Fast vollstaendig"],
    "mid":  ["Fast vollstaendig", "Teilweise"],
    "low":  ["Teilweise", "Fehlend"],
}

JC_TIERS = {
    "high": ["BGS bewilligt", "BGS beantragt"],
    "mid":  ["AVGS vorhanden", "In Beratung"],
    "low":  ["In Beratung", "Kein Kontakt JC"],
}

DEUTSCH_OPTIONS = ["C1-C2", "B1-B2", "B1-B2", "A1-A2"]
PC_OPTIONS = ["Ja", "Ja", "Ja", "Nein"]


def _pick(tier_map: dict, tier: str) -> str:
    return random.choice(tier_map[tier])


def _assign_tier() -> str:
    """Assign a quality tier using a rough bell curve: 25% high, 50% mid, 25% low."""
    r = random.random()
    if r < 0.25:
        return "high"
    elif r < 0.75:
        return "mid"
    else:
        return "low"


def _generate_deal(idx: int) -> Dict[str, Any]:
    segment = random.choices(SEGMENTS, weights=SEGMENT_WEIGHTS, k=1)[0]
    tier = _assign_tier()

    # Outcome probability tied to tier
    outcome_rand = random.random()
    if tier == "high":
        is_won = outcome_rand < 0.65
    elif tier == "mid":
        is_won = outcome_rand < 0.35
    else:
        is_won = outcome_rand < 0.10

    # 25% open deals
    is_open = random.random() < 0.25
    if is_open:
        is_closed = False
        is_won = None
        deal_stage = random.choice(["appointmentscheduled", "qualifiedtobuy", "presentationscheduled"])
    else:
        is_closed = True
        deal_stage = "closedwon" if is_won else "closedlost"

    # Lead score: tier-dependent
    if tier == "high":
        lead_score = random.gauss(75, 12)
    elif tier == "mid":
        lead_score = random.gauss(50, 15)
    else:
        lead_score = random.gauss(25, 12)
    lead_score = max(0, min(100, lead_score))

    now = datetime.now(timezone.utc)
    create_date = now - timedelta(days=random.randint(10, 180))
    close_date = create_date + timedelta(days=random.randint(5, 90)) if is_closed else None
    amount = round(random.uniform(2000, 15000), 2) if random.random() > 0.1 else None

    deal_name = f"{random.choice(DEAL_NAMES_PREFIX)} {random.choice(DEAL_NAMES_SUFFIX)} #{idx}"

    # Gate fields (occasional gate triggers for realism)
    deutsch = random.choice(DEUTSCH_OPTIONS)
    pc_internet = random.choice(PC_OPTIONS)
    jc_ablehnung = "Ja" if (segment == "Arbeitsloser" and random.random() < 0.08) else "Nein"

    deal = {
        "id": str(uuid.uuid4()),
        "deal_name": deal_name,
        "segment_neu": segment,
        "deal_stage": deal_stage,
        "amount": amount,
        "close_date": close_date,
        "create_date": create_date,
        "is_won": is_won,
        "is_closed": is_closed,
        "lead_score_contact": round(lead_score, 1),
        "setter_rating": _pick(SETTER_TIERS, tier),
        "reaktionsgeschwindigkeit": _pick(REAKTION_TIERS, tier),
        "next_step": _pick(NEXT_STEP_TIERS, tier),
        "aktivitaet": _pick(AKTIVITAET_TIERS, tier),
        "stage_aging": _pick(AGING_TIERS, tier),
        "produktfit": _pick(PRODUKT_TIERS, tier),
        "deutsch_niveau": deutsch,
        "pc_internet": pc_internet,
        "jc_ablehnung": jc_ablehnung,
    }

    # Segment-specific fields
    if segment == "Arbeitender":
        deal["finanzierung"] = _pick(FINANZ_TIERS, tier)
        deal["entscheidungssituation"] = _pick(DECISION_TIERS, tier)
        deal["arbeitgeber_fit"] = _pick(AG_FIT_TIERS, tier)
    elif segment == "Unternehmer":
        deal["budget_vorhanden"] = _pick(BUDGET_TIERS, tier)
        deal["roi_erwartung"] = _pick(ROI_TIERS, tier)
        deal["unternehmensfit"] = _pick(UNTERNEHMEN_TIERS, tier)
    elif segment == "Arbeitsloser":
        deal["finanzierung"] = _pick(FINANZ_TIERS, tier)
        deal["unterlagen"] = _pick(UNTERLAGEN_TIERS, tier)
        deal["jc_status"] = _pick(JC_TIERS, tier)

    return deal


def generate_mock_deals(n: int = 200) -> List[Dict[str, Any]]:
    """Generate n mock deals."""
    random.seed(42)
    np.random.seed(42)
    return [_generate_deal(i + 1) for i in range(n)]


async def seed_database(n: int = 200):
    """Seed the database with mock deals."""
    await init_db()

    deals_data = generate_mock_deals(n)
    async with async_session() as session:
        for dd in deals_data:
            # Score the deal
            try:
                score, band = score_deal_simple(dd)
            except Exception:
                score, band = None, None

            deal = Deal(
                id=dd["id"],
                deal_name=dd.get("deal_name"),
                segment_neu=dd.get("segment_neu"),
                deal_stage=dd.get("deal_stage"),
                amount=dd.get("amount"),
                close_date=dd.get("close_date"),
                create_date=dd.get("create_date"),
                is_won=dd.get("is_won"),
                is_closed=dd.get("is_closed"),
                lead_score_contact=dd.get("lead_score_contact"),
                setter_rating=dd.get("setter_rating"),
                finanzierung=dd.get("finanzierung"),
                entscheidungssituation=dd.get("entscheidungssituation"),
                reaktionsgeschwindigkeit=dd.get("reaktionsgeschwindigkeit"),
                next_step=dd.get("next_step"),
                aktivitaet=dd.get("aktivitaet"),
                stage_aging=dd.get("stage_aging"),
                produktfit=dd.get("produktfit"),
                arbeitgeber_fit=dd.get("arbeitgeber_fit"),
                unternehmensfit=dd.get("unternehmensfit"),
                budget_vorhanden=dd.get("budget_vorhanden"),
                roi_erwartung=dd.get("roi_erwartung"),
                unterlagen=dd.get("unterlagen"),
                jc_status=dd.get("jc_status"),
                deutsch_niveau=dd.get("deutsch_niveau"),
                pc_internet=dd.get("pc_internet"),
                jc_ablehnung=dd.get("jc_ablehnung"),
                computed_score=score,
                score_band=band,
            )
            session.add(deal)

        # Also create a default baseline scenario
        from database.db import Scenario as ScenarioORM
        from models.schemas import ScenarioWeights, GateConfig, BandThresholds

        baseline = ScenarioORM(
            id=str(uuid.uuid4()),
            name="Baseline v1",
            description="Default scoring weights and gates",
            is_baseline=True,
            weights_json=ScenarioWeights().model_dump(),
            gates_json=GateConfig().model_dump(),
            bands_json=BandThresholds().model_dump(),
            lookups_json={},
            version=1,
        )
        session.add(baseline)

        await session.commit()

    print(f"Seeded {n} deals + baseline scenario into the database.")

    # Print score distribution summary
    scores = [dd.get("_score") for dd in deals_data if dd.get("_score") is not None]
    scored_deals = []
    for dd in deals_data:
        try:
            s, b = score_deal_simple(dd)
            scored_deals.append((s, b, dd.get("segment_neu")))
        except Exception:
            pass

    if scored_deals:
        all_scores = [s for s, _, _ in scored_deals]
        print(f"Score range: {min(all_scores):.1f} - {max(all_scores):.1f}")
        print(f"Mean: {np.mean(all_scores):.1f}, Median: {np.median(all_scores):.1f}")
        bands = {}
        for _, b, _ in scored_deals:
            bands[b] = bands.get(b, 0) + 1
        print(f"Band distribution: {bands}")
        segs = {}
        for _, _, seg in scored_deals:
            segs[seg] = segs.get(seg, 0) + 1
        print(f"Segment distribution: {segs}")


if __name__ == "__main__":
    asyncio.run(seed_database(200))
