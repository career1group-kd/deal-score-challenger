"""
Scenario data models for persistence layer.
Re-exports the ORM model from database.db and provides conversion helpers.
"""

from __future__ import annotations

import json
from typing import Dict, Any

from database.db import Scenario as ScenarioORM
from models.schemas import (
    ScenarioResponse, ScenarioWeights, GateConfig, BandThresholds,
    FieldSimulations,
)


def scenario_orm_to_response(orm: ScenarioORM) -> ScenarioResponse:
    """Convert ORM Scenario to Pydantic response."""
    weights_data = orm.weights_json or {}
    gates_data = orm.gates_json or {}
    bands_data = orm.bands_json or {}
    lookups_data = orm.lookups_json or {}
    simulations_data = getattr(orm, "simulations_json", None) or {}

    return ScenarioResponse(
        id=orm.id,
        name=orm.name,
        description=orm.description,
        is_baseline=orm.is_baseline,
        weights=ScenarioWeights(**weights_data) if weights_data else ScenarioWeights(),
        gates=GateConfig(**gates_data) if gates_data else GateConfig(),
        bands=BandThresholds(**bands_data) if bands_data else BandThresholds(),
        lookups=lookups_data,
        simulations=FieldSimulations(**simulations_data) if simulations_data else FieldSimulations(),
        version=orm.version or 1,
        created_at=orm.created_at,
        updated_at=orm.updated_at,
    )
