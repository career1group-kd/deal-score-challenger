"""
Scenario CRUD + baseline management + versioning.
"""

from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import List, Optional

from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from database.db import Scenario as ScenarioORM
from models.schemas import ScenarioCreate, ScenarioUpdate, ScenarioResponse
from scenarios.models import scenario_orm_to_response


async def list_scenarios(session: AsyncSession) -> List[ScenarioResponse]:
    result = await session.execute(select(ScenarioORM).order_by(ScenarioORM.created_at.desc()))
    return [scenario_orm_to_response(s) for s in result.scalars().all()]


async def get_scenario(session: AsyncSession, scenario_id: str) -> Optional[ScenarioResponse]:
    result = await session.execute(select(ScenarioORM).where(ScenarioORM.id == scenario_id))
    orm = result.scalar_one_or_none()
    if orm is None:
        return None
    return scenario_orm_to_response(orm)


async def get_baseline(session: AsyncSession) -> Optional[ScenarioResponse]:
    result = await session.execute(select(ScenarioORM).where(ScenarioORM.is_baseline == True))
    orm = result.scalar_one_or_none()
    if orm is None:
        return None
    return scenario_orm_to_response(orm)


async def create_scenario(session: AsyncSession, data: ScenarioCreate) -> ScenarioResponse:
    orm = ScenarioORM(
        id=str(uuid.uuid4()),
        name=data.name,
        description=data.description,
        is_baseline=False,
        weights_json=data.weights.model_dump(),
        gates_json=data.gates.model_dump(),
        bands_json=data.bands.model_dump(),
        lookups_json=data.lookups,
        simulations_json=data.simulations.model_dump(),
        version=1,
    )
    session.add(orm)
    await session.commit()
    await session.refresh(orm)
    return scenario_orm_to_response(orm)


async def update_scenario(
    session: AsyncSession, scenario_id: str, data: ScenarioUpdate
) -> Optional[ScenarioResponse]:
    result = await session.execute(select(ScenarioORM).where(ScenarioORM.id == scenario_id))
    orm = result.scalar_one_or_none()
    if orm is None:
        return None

    if data.name is not None:
        orm.name = data.name
    if data.description is not None:
        orm.description = data.description
    if data.weights is not None:
        orm.weights_json = data.weights.model_dump()
    if data.gates is not None:
        orm.gates_json = data.gates.model_dump()
    if data.bands is not None:
        orm.bands_json = data.bands.model_dump()
    if data.lookups is not None:
        orm.lookups_json = data.lookups
    if data.simulations is not None:
        orm.simulations_json = data.simulations.model_dump()

    orm.version = (orm.version or 0) + 1
    orm.updated_at = datetime.now(timezone.utc)
    await session.commit()
    await session.refresh(orm)
    return scenario_orm_to_response(orm)


async def delete_scenario(session: AsyncSession, scenario_id: str) -> bool:
    result = await session.execute(select(ScenarioORM).where(ScenarioORM.id == scenario_id))
    orm = result.scalar_one_or_none()
    if orm is None:
        return False
    await session.delete(orm)
    await session.commit()
    return True


async def set_baseline(session: AsyncSession, scenario_id: str) -> Optional[ScenarioResponse]:
    """Mark a scenario as the baseline, un-marking any previous baseline."""
    # Clear existing baseline
    await session.execute(
        update(ScenarioORM).where(ScenarioORM.is_baseline == True).values(is_baseline=False)
    )
    # Set new baseline
    result = await session.execute(select(ScenarioORM).where(ScenarioORM.id == scenario_id))
    orm = result.scalar_one_or_none()
    if orm is None:
        return None
    orm.is_baseline = True
    orm.updated_at = datetime.now(timezone.utc)
    await session.commit()
    await session.refresh(orm)
    return scenario_orm_to_response(orm)
