"""
HubSpot sync logic: initial and incremental sync with contact association
for lead score enrichment.
"""

from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import List, Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from database.db import Deal, SyncStatus
from hubspot.client import HubSpotClient
from hubspot.field_mapping import (
    DEAL_FIELD_MAP, CONTACT_PROPERTIES,
    map_hubspot_deal, get_calculator_segment,
    derive_response_speed, derive_stage_aging,
    derive_next_step_freshness, derive_has_scheduled_activity,
)
from scoring.engine import score_deal_simple


DEAL_PROPERTIES = list(DEAL_FIELD_MAP.keys())


async def _enrich_with_contact(client: HubSpotClient, deal_hs_id: str) -> dict:
    """Fetch associated contact and return lead score + zustandiges_amt."""
    result = {}
    try:
        assoc = await client.get_deal_associations(deal_hs_id, "contacts")
        results = assoc.get("results", [])
        if not results:
            return result
        contact_id = str(results[0].get("id", ""))
        if not contact_id:
            return result
        contact = await client.get_contact(contact_id, properties=CONTACT_PROPERTIES)
        props = contact.get("properties", {})

        # Lead score
        raw_score = props.get("frist_incoming_lead_score")
        if raw_score is not None:
            try:
                result["lead_score_contact"] = float(raw_score)
            except (ValueError, TypeError):
                pass

        # Zuständiges Amt (for JC status derivation)
        amt = props.get("zustandiges_amt")
        if amt:
            result["zustandiges_amt"] = amt

    except Exception:
        pass
    return result


async def _upsert_deal(session: AsyncSession, deal_data: dict) -> Deal:
    hs_id = deal_data.get("hubspot_deal_id")
    result = await session.execute(
        select(Deal).where(Deal.hubspot_deal_id == hs_id)
    )
    existing = result.scalar_one_or_none()

    if existing:
        for k, v in deal_data.items():
            if v is not None and hasattr(existing, k):
                setattr(existing, k, v)
        existing.synced_at = datetime.now(timezone.utc)
        existing.updated_at = datetime.now(timezone.utc)
        return existing
    else:
        # Filter to only columns that exist on the Deal model
        valid_cols = {c.key for c in Deal.__table__.columns}
        filtered = {k: v for k, v in deal_data.items() if k in valid_cols}
        deal = Deal(id=str(uuid.uuid4()), **filtered)
        deal.synced_at = datetime.now(timezone.utc)
        session.add(deal)
        return deal


async def sync_deals(session: AsyncSession, incremental: bool = False) -> int:
    """
    Full or incremental sync from HubSpot.
    Returns number of deals synced.
    """
    client = HubSpotClient()
    sync_record = SyncStatus(
        sync_type="incremental" if incremental else "initial",
        status="running",
    )
    session.add(sync_record)
    await session.commit()

    try:
        count = 0
        batch_size = 100

        async for hs_deal in client.get_all_deals(properties=DEAL_PROPERTIES):
            props = hs_deal.get("properties", {})
            deal_data = map_hubspot_deal(props)

            # Derive calculator segment from segment_neu + pipeline
            calculator_segment = get_calculator_segment(
                deal_data.get("segment_neu"),
                deal_data.get("pipeline"),
            )
            deal_data["calculator_segment"] = calculator_segment

            # Derive fields from dates (no extra API calls needed)
            deal_data["reaktionsgeschwindigkeit"] = derive_response_speed(
                deal_data.get("notes_last_contacted")
            )
            deal_data["stage_aging"] = derive_stage_aging(
                deal_data.get("hs_lastmodifieddate")
            )
            deal_data["next_step"] = derive_next_step_freshness(
                deal_data.get("notes_next_activity_date")
            )
            has_activity = derive_has_scheduled_activity(
                deal_data.get("notes_next_activity_date")
            )
            deal_data["aktivitaet"] = "Geplant" if has_activity else "Keine geplant"

            deal = await _upsert_deal(session, deal_data)

            # Score with default weights
            try:
                deal_dict = {c.key: getattr(deal, c.key) for c in Deal.__table__.columns}
                score, band = score_deal_simple(deal_dict)
                deal.computed_score = score
                deal.score_band = band
            except Exception:
                pass

            count += 1

            # Commit in batches and expire objects to free memory
            if count % batch_size == 0:
                await session.commit()
                session.expunge_all()

        await session.commit()
        session.expunge_all()

        sync_record.status = "completed"
        sync_record.deals_synced = count
        sync_record.completed_at = datetime.now(timezone.utc)
        await session.commit()

        await client.close()
        return count

    except Exception as e:
        sync_record.status = "failed"
        sync_record.error_message = str(e)
        sync_record.completed_at = datetime.now(timezone.utc)
        await session.commit()
        await client.close()
        raise
