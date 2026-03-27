from __future__ import annotations

from datetime import datetime
from typing import Optional, Dict, Any, List
from pydantic import BaseModel, Field


# ---------------------------------------------------------------------------
# Scenario weights
# ---------------------------------------------------------------------------

class ScenarioWeights(BaseModel):
    # Rechner A - Arbeitender
    a_lead: float = Field(default=22, description="Lead-Score (Arbeitender)")
    a_setter: float = Field(default=18, description="Setter-Rating (Arbeitender)")
    a_finanzierung: float = Field(default=12, description="Finanzierung (Arbeitender)")
    a_decision: float = Field(default=12, description="Entscheidungssituation (Arbeitender)")
    a_reaktion: float = Field(default=8, description="Reaktionsgeschwindigkeit (Arbeitender)")
    a_next_step: float = Field(default=5, description="Next Step (Arbeitender)")
    a_aktivitaet: float = Field(default=4, description="Aktivitaet (Arbeitender)")
    a_aging: float = Field(default=4, description="Aging (Arbeitender)")
    a_produkt: float = Field(default=5, description="Produktfit (Arbeitender)")
    a_ag_fit: float = Field(default=10, description="Arbeitgeber-Fit (Arbeitender)")

    # Rechner B - Unternehmer
    b_lead: float = Field(default=22, description="Lead-Score (Unternehmer)")
    b_setter: float = Field(default=18, description="Setter-Rating (Unternehmer)")
    b_budget: float = Field(default=12, description="Budget (Unternehmer)")
    b_roi: float = Field(default=12, description="ROI (Unternehmer)")
    b_reaktion: float = Field(default=8, description="Reaktionsgeschwindigkeit (Unternehmer)")
    b_next_step: float = Field(default=5, description="Next Step (Unternehmer)")
    b_aktivitaet: float = Field(default=4, description="Aktivitaet (Unternehmer)")
    b_aging: float = Field(default=4, description="Aging (Unternehmer)")
    b_produkt: float = Field(default=5, description="Produktfit (Unternehmer)")
    b_company: float = Field(default=10, description="Unternehmensfit (Unternehmer)")

    # Rechner C - Arbeitsloser
    c_lead: float = Field(default=22, description="Lead-Score (Arbeitsloser)")
    c_setter: float = Field(default=18, description="Setter-Rating (Arbeitsloser)")
    c_amt: float = Field(default=12, description="Amt/Foerderung (Arbeitsloser)")
    c_reaktion: float = Field(default=8, description="Reaktionsgeschwindigkeit (Arbeitsloser)")
    c_next_step: float = Field(default=5, description="Next Step (Arbeitsloser)")
    c_aktivitaet: float = Field(default=4, description="Aktivitaet (Arbeitsloser)")
    c_aging: float = Field(default=4, description="Aging (Arbeitsloser)")
    c_produkt: float = Field(default=5, description="Produktfit (Arbeitsloser)")
    c_unterlagen: float = Field(default=10, description="Unterlagen (Arbeitsloser)")
    c_jc: float = Field(default=12, description="JC-Status (Arbeitsloser)")


class FieldSimulationRule(BaseModel):
    """Defines assumed distribution for a missing field."""
    field: str  # e.g. "finanzierung"
    # Distribution: maps lookup value -> probability (must sum to 1.0)
    distribution: Dict[str, float]
    # e.g. {"Nicht klar": 0.3, "Teilweise klar": 0.4, "Klar / bestaetigt": 0.3}


class FieldSimulations(BaseModel):
    """All field simulation rules for a scenario."""
    rules: List[FieldSimulationRule] = []


class GateRule(BaseModel):
    enabled: bool = True
    cap: float = 25


class GateConfig(BaseModel):
    deutsch_gate: GateRule = Field(default_factory=lambda: GateRule(enabled=True, cap=25))
    pc_internet_gate: GateRule = Field(default_factory=lambda: GateRule(enabled=True, cap=35))
    jc_ablehnung_gate: GateRule = Field(default_factory=lambda: GateRule(enabled=True, cap=10))


class BandThresholds(BaseModel):
    hot_min: float = 80
    warm_min: float = 60
    nurture_min: float = 40


# ---------------------------------------------------------------------------
# Scenario CRUD
# ---------------------------------------------------------------------------

class ScenarioBase(BaseModel):
    name: str
    description: Optional[str] = None
    weights: ScenarioWeights = Field(default_factory=ScenarioWeights)
    gates: GateConfig = Field(default_factory=GateConfig)
    bands: BandThresholds = Field(default_factory=BandThresholds)
    lookups: Dict[str, Any] = Field(default_factory=dict)
    simulations: FieldSimulations = Field(default_factory=FieldSimulations)


class ScenarioCreate(ScenarioBase):
    pass


class ScenarioUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    weights: Optional[ScenarioWeights] = None
    gates: Optional[GateConfig] = None
    bands: Optional[BandThresholds] = None
    lookups: Optional[Dict[str, Any]] = None
    simulations: Optional[FieldSimulations] = None


class ScenarioResponse(ScenarioBase):
    id: str
    is_baseline: bool = False
    version: int = 1
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


# ---------------------------------------------------------------------------
# Deal
# ---------------------------------------------------------------------------

class DealResponse(BaseModel):
    id: str
    hubspot_deal_id: Optional[str] = None
    deal_name: Optional[str] = None
    segment_neu: Optional[str] = None
    deal_stage: Optional[str] = None
    amount: Optional[float] = None
    close_date: Optional[datetime] = None
    is_won: Optional[bool] = None
    is_closed: Optional[bool] = None
    computed_score: Optional[float] = None
    score_band: Optional[str] = None
    created_at: Optional[datetime] = None

    model_config = {"from_attributes": True}


class ScoreComponent(BaseModel):
    field: str
    label: str
    raw_value: Optional[str] = None
    lookup_value: float = 0
    weight: float = 0
    weighted_score: float = 0
    is_simulated: bool = False


class GateResult(BaseModel):
    gate_name: str
    triggered: bool = False
    cap_value: Optional[float] = None
    reason: Optional[str] = None


class DealScoreBreakdown(BaseModel):
    deal_id: str
    segment: str
    raw_score: float
    gate_caps: List[GateResult]
    final_score: float
    band: str
    components: List[ScoreComponent]


# ---------------------------------------------------------------------------
# Analytics
# ---------------------------------------------------------------------------

class DistributionBin(BaseModel):
    bin_start: float
    bin_end: float
    count: int
    percentage: float


class AnalyticsResponse(BaseModel):
    total_deals: int
    mean_score: float
    median_score: float
    std_dev: float
    distribution: List[DistributionBin]
    band_counts: Dict[str, int]


class WinRateByBand(BaseModel):
    band: str
    total: int
    won: int
    lost: int
    win_rate: float


class WonLostBin(BaseModel):
    name: str
    won: int
    lost: int


class BacktestResult(BaseModel):
    scenario_id: str
    scenario_name: str
    total_deals: int
    win_rates_by_band: List[WinRateByBand]
    precision: float
    recall: float
    f1_score: float
    optimal_cutoff: float
    revenue_impact: Dict[str, float]
    won_lost_histogram: List[WonLostBin] = []


class ConfusionMatrixResult(BaseModel):
    true_positive: int
    false_positive: int
    true_negative: int
    false_negative: int
    accuracy: float
    precision: float
    recall: float
    f1_score: float
    threshold: float


class CohortComparison(BaseModel):
    scenario_a_id: str
    scenario_b_id: str
    score_deltas: Dict[str, float]
    band_migration: Dict[str, Dict[str, int]]
    win_rate_comparison: Dict[str, Dict[str, float]]


class ROCPoint(BaseModel):
    threshold: float
    tpr: float
    fpr: float


class RevenueImpact(BaseModel):
    threshold: float
    deals_above: int
    deals_below: int
    revenue_above: float
    revenue_below: float
    win_rate_above: float
    win_rate_below: float


class ScoringRequest(BaseModel):
    deal_id: Optional[str] = None
    deal_data: Optional[Dict[str, Any]] = None
    scenario_id: Optional[str] = None


class ScoringPreviewRequest(BaseModel):
    scenario: ScenarioBase
    deal_ids: Optional[List[str]] = None
    limit: int = 50


class HubSpotSyncResponse(BaseModel):
    status: str
    deals_synced: int = 0
    message: str = ""


class HubSpotStatusResponse(BaseModel):
    last_sync: Optional[datetime] = None
    sync_type: Optional[str] = None
    status: Optional[str] = None
    deals_synced: int = 0
    error_message: Optional[str] = None
