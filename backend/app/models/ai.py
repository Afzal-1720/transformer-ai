from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel, Field
from app.models.transformer import RiskLevel
from app.models.alert import AlertSeverity

class ForecastDataPoint(BaseModel):
    timestamp: datetime
    predicted_load_kw: float
    lower_bound_kw: float
    upper_bound_kw: float
    baseline_persistence_kw: float

class ForecastMetrics(BaseModel):
    mae_kw: float = Field(..., description="Mean Absolute Error on chronological holdout set")
    rmse_kw: float = Field(..., description="Root Mean Squared Error on chronological holdout set")
    mape_pct: float = Field(..., description="Mean Absolute Percentage Error")
    baseline_mae_kw: float = Field(..., description="Baseline persistence model MAE for comparison")
    holdout_samples: int

class ForecastResponse(BaseModel):
    transformer_id: str
    generated_at: datetime
    metrics: ForecastMetrics
    historical_points: List[dict]  # recent observed points for continuous visualization
    predictions_1h: List[ForecastDataPoint]
    predictions_6h: List[ForecastDataPoint]
    predictions_24h: List[ForecastDataPoint]
    model_name: str = "scikit-learn Ridge/GradientBoosting Regressor"
    is_simulated: bool = True

class AnomalyContribution(BaseModel):
    feature: str
    observed_value: float
    expected_range: str
    attribution_score: float = Field(..., description="Relative contribution to anomaly score (0.0 to 1.0)")
    impact_description: str

class AnomalyDetectionResponse(BaseModel):
    transformer_id: str
    timestamp: datetime
    is_anomaly: bool
    anomaly_score: float = Field(..., description="Isolation Forest decision score (-1 to 1 or 0-100 normalized)")
    severity: AlertSeverity
    contributing_features: List[AnomalyContribution]
    heuristic_observation: str
    recommended_checks: List[str]
    is_simulated: bool = True

class RiskFactorBreakdown(BaseModel):
    factor_name: str
    weight_pct: float
    raw_metric: str
    sub_score: float
    weighted_points: float
    status: str
    explanation: str

class ExplainableRiskResponse(BaseModel):
    transformer_id: str
    timestamp: datetime
    overall_risk_score: float = Field(..., description="0-100 composite risk score")
    risk_level: RiskLevel
    breakdown: List[RiskFactorBreakdown]
    primary_risk_driver: str
    actionable_recommendations: List[str]
    disclaimer: str = "Academic demo prototype. Heuristic & statistical model only; not certified for physical grid operations."
    is_simulated: bool = True
