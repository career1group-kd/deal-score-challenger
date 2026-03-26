import json
from datetime import datetime, timezone
from sqlalchemy import (
    Column, String, Integer, Float, Boolean, DateTime, Text, JSON,
    create_engine,
)
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.orm import DeclarativeBase

from config import get_settings


class Base(DeclarativeBase):
    pass


# ---------------------------------------------------------------------------
# ORM models
# ---------------------------------------------------------------------------

class Deal(Base):
    __tablename__ = "deals"

    id = Column(String, primary_key=True)
    hubspot_deal_id = Column(String, unique=True, nullable=True, index=True)
    deal_name = Column(String, nullable=True)
    segment_neu = Column(String, nullable=True, index=True)  # Raw HubSpot value
    calculator_segment = Column(String, nullable=True, index=True)  # arbeitender / unternehmer / arbeitsloser
    deal_stage = Column(String, nullable=True)
    pipeline = Column(String, nullable=True)
    amount = Column(Float, nullable=True)
    close_date = Column(DateTime, nullable=True)
    create_date = Column(DateTime, nullable=True)
    owner_id = Column(String, nullable=True)

    # Scoring input fields
    lead_score_contact = Column(Float, nullable=True)
    setter_rating = Column(String, nullable=True)
    finanzierung = Column(String, nullable=True)
    entscheidungssituation = Column(String, nullable=True)
    reaktionsgeschwindigkeit = Column(String, nullable=True)
    next_step = Column(String, nullable=True)
    aktivitaet = Column(String, nullable=True)
    stage_aging = Column(String, nullable=True)
    produktfit = Column(String, nullable=True)
    arbeitgeber_fit = Column(String, nullable=True)
    unternehmensfit = Column(String, nullable=True)
    budget_vorhanden = Column(String, nullable=True)
    roi_erwartung = Column(String, nullable=True)
    unterlagen = Column(String, nullable=True)
    jc_status = Column(String, nullable=True)

    # Additional HubSpot fields
    fachgebiet = Column(String, nullable=True)
    produkt = Column(String, nullable=True)
    rating_company = Column(String, nullable=True)
    stage_probability = Column(String, nullable=True)
    zustandiges_amt = Column(String, nullable=True)

    # Gate fields
    deutsch_niveau = Column(String, nullable=True)
    pc_internet = Column(String, nullable=True)
    jc_ablehnung = Column(String, nullable=True)

    # Outcome
    is_won = Column(Boolean, nullable=True)
    is_closed = Column(Boolean, nullable=True, default=False)

    # Derived fields
    notes_last_contacted = Column(DateTime, nullable=True)
    notes_next_activity_date = Column(DateTime, nullable=True)
    hs_lastmodifieddate = Column(DateTime, nullable=True)

    # Computed score (baseline)
    computed_score = Column(Float, nullable=True)
    score_band = Column(String, nullable=True)

    # Metadata
    synced_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))


class Scenario(Base):
    __tablename__ = "scenarios"

    id = Column(String, primary_key=True)
    name = Column(String, nullable=False)
    description = Column(Text, nullable=True)
    is_baseline = Column(Boolean, default=False, index=True)
    weights_json = Column(JSON, nullable=False, default=dict)
    gates_json = Column(JSON, nullable=False, default=dict)
    bands_json = Column(JSON, nullable=False, default=dict)
    lookups_json = Column(JSON, nullable=False, default=dict)
    simulations_json = Column(JSON, nullable=False, default=dict)
    version = Column(Integer, default=1)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))


class SyncStatus(Base):
    __tablename__ = "sync_status"

    id = Column(Integer, primary_key=True, autoincrement=True)
    sync_type = Column(String, nullable=False)  # initial / incremental
    status = Column(String, nullable=False)       # running / completed / failed
    deals_synced = Column(Integer, default=0)
    error_message = Column(Text, nullable=True)
    started_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    completed_at = Column(DateTime, nullable=True)


# ---------------------------------------------------------------------------
# Engine / session setup
# ---------------------------------------------------------------------------

settings = get_settings()

_engine_kwargs: dict = {
    "echo": settings.APP_ENV == "development",
    "future": True,
}
if settings.DATABASE_URL.startswith("postgresql"):
    _engine_kwargs.update({"pool_size": 5, "max_overflow": 10})

engine = create_async_engine(settings.DATABASE_URL, **_engine_kwargs)

async_session = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)


async def get_db() -> AsyncSession:
    async with async_session() as session:
        try:
            yield session
        finally:
            await session.close()


async def init_db():
    """Create all tables."""
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
