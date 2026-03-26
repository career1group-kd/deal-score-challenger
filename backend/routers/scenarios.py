"""
Scenario CRUD + set-baseline endpoints.
"""

from __future__ import annotations

from typing import List

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from database.db import get_db
from models.schemas import ScenarioCreate, ScenarioUpdate, ScenarioResponse
from scenarios.manager import (
    list_scenarios, get_scenario, create_scenario,
    update_scenario, delete_scenario, set_baseline, get_baseline,
)

router = APIRouter(prefix="/api/scenarios", tags=["scenarios"])


@router.get("", response_model=List[ScenarioResponse])
async def list_all(db: AsyncSession = Depends(get_db)):
    return await list_scenarios(db)


@router.get("/baseline", response_model=ScenarioResponse)
async def get_baseline_scenario(db: AsyncSession = Depends(get_db)):
    result = await get_baseline(db)
    if result is None:
        raise HTTPException(status_code=404, detail="No baseline scenario set")
    return result


@router.get("/{scenario_id}", response_model=ScenarioResponse)
async def get_one(scenario_id: str, db: AsyncSession = Depends(get_db)):
    result = await get_scenario(db, scenario_id)
    if result is None:
        raise HTTPException(status_code=404, detail="Scenario not found")
    return result


@router.post("", response_model=ScenarioResponse, status_code=201)
async def create(data: ScenarioCreate, db: AsyncSession = Depends(get_db)):
    return await create_scenario(db, data)


@router.put("/{scenario_id}", response_model=ScenarioResponse)
async def update(scenario_id: str, data: ScenarioUpdate, db: AsyncSession = Depends(get_db)):
    result = await update_scenario(db, scenario_id, data)
    if result is None:
        raise HTTPException(status_code=404, detail="Scenario not found")
    return result


@router.delete("/{scenario_id}")
async def delete(scenario_id: str, db: AsyncSession = Depends(get_db)):
    success = await delete_scenario(db, scenario_id)
    if not success:
        raise HTTPException(status_code=404, detail="Scenario not found")
    return {"status": "deleted"}


@router.post("/{scenario_id}/set-baseline", response_model=ScenarioResponse)
async def set_as_baseline(scenario_id: str, db: AsyncSession = Depends(get_db)):
    result = await set_baseline(db, scenario_id)
    if result is None:
        raise HTTPException(status_code=404, detail="Scenario not found")
    return result
