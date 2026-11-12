from datetime import datetime
from enum import Enum
from typing import Optional, List
from pydantic import BaseModel, Field

class AnomalySeverity(str, Enum):
    CRITICAL = "Critical"
    WARNING = "Warning"
    INFORMATIONAL = "Informational"

class AnomalyType(str, Enum):
    OVER_VOLTAGE = "OVER_VOLTAGE"
    UNDER_VOLTAGE = "UNDER_VOLTAGE"
    OVER_CURRENT = "OVER_CURRENT"
    OVERHEATING = "OVERHEATING"
    SUDDEN_LOAD_VARIATION = "SUDDEN_LOAD_VARIATION"
    PHASE_IMBALANCE = "PHASE_IMBALANCE"
    SENSOR_CONNECTIVITY = "SENSOR_CONNECTIVITY"

class DetectedAnomaly(BaseModel):
    id: str = Field(..., description="Unique anomaly identifier e.g. ANM-1001")
    transformer_id: str
    anomaly_name: str
    anomaly_type: AnomalyType
    severity: AnomalySeverity
    detected_parameter: str
    measured_value: str
    applicable_threshold: str
    percentage_change: Optional[float] = None
    detection_time: datetime
    recommended_action: str
    is_mock_data: bool = True

class AnomalySummary(BaseModel):
    transformer_id: str
    timestamp: datetime
    overall_condition: str
    anomalies: List[DetectedAnomaly]
    total_anomalies: int
    has_critical: bool
    has_warning: bool
    phase_imbalance_status: str = "Disabled: Single-phase RMS hardware telemetry only. Phase-level data is not fabricated."
    is_mock_data: bool = True
