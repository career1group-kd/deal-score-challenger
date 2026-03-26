"""
HubSpot sync endpoints.
"""

from __future__ import annotations

from fastapi import APIRouter, Depends, BackgroundTasks
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from database.db import SyncStatus, get_db
from models.schemas import HubSpotSyncResponse, HubSpotStatusResponse
from hubspot.sync import sync_deals

router = APIRouter(prefix="/api/hubspot", tags=["hubspot"])


@router.post("/sync", response_model=HubSpotSyncResponse)
async def trigger_sync(
    background_tasks: BackgroundTasks,
    incremental: bool = False,
    db: AsyncSession = Depends(get_db),
):
    """Trigger a HubSpot sync (runs in background)."""
    # For background tasks we need a fresh session
    async def _run_sync():
        from database.db import async_session
        async with async_session() as session:
            try:
                count = await sync_deals(session, incremental=incremental)
            except Exception:
                pass

    background_tasks.add_task(_run_sync)
    return HubSpotSyncResponse(
        status="started",
        message="Sync started in background",
    )


@router.get("/status", response_model=HubSpotStatusResponse)
async def sync_status(db: AsyncSession = Depends(get_db)):
    """Get the latest sync status."""
    result = await db.execute(
        select(SyncStatus).order_by(SyncStatus.started_at.desc()).limit(1)
    )
    status = result.scalar_one_or_none()
    if status is None:
        return HubSpotStatusResponse()
    return HubSpotStatusResponse(
        last_sync=status.started_at,
        sync_type=status.sync_type,
        status=status.status,
        deals_synced=status.deals_synced or 0,
        error_message=status.error_message,
    )
