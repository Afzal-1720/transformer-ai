from datetime import datetime
from enum import Enum
from typing import Optional
from pydantic import BaseModel, Field

class AlertSeverity(str, Enum):
    INFO = "INFO"
    WARNING = "WARNING"
    HIGH = "HIGH"
    CRITICAL = "CRITICAL"

class AlertStatus(str, Enum):
    ACTIVE = "ACTIVE"
    ACKNOWLEDGED = "ACKNOWLEDGED"
    RESOLVED = "RESOLVED"

class AlertCategory(str, Enum):
    OVER_VOLTAGE = "OVER_VOLTAGE"
    UNDER_VOLTAGE = "UNDER_VOLTAGE"
    OVER_CURRENT = "OVER_CURRENT"
    OVERHEATING = "OVERHEATING"
    SUDDEN_LOAD_VARIATION = "SUDDEN_LOAD_VARIATION"
    VOLTAGE_FLUCTUATION = "VOLTAGE_FLUCTUATION"
    MOISTURE = "MOISTURE"
    SENSOR_CONNECTIVITY = "SENSOR_CONNECTIVITY"

class Alert(BaseModel):
    id: str = Field(..., description="Unique alert identifier e.g. ALT-1001")
    transformer_id: str
    substation: str
    severity: AlertSeverity
    category: AlertCategory
    triggering_metric: str = Field(..., description="e.g. Vrms, Arms, winding_hotspot_temperature")
    triggering_value: float
    threshold_value: float
    unit: str
    message: str
    recommended_action: str
    inspection_recommended: bool = True
    status: AlertStatus = AlertStatus.ACTIVE
    created_at: datetime
    acknowledged_at: Optional[datetime] = None
    resolved_at: Optional[datetime] = None
    is_mock_data: bool = True
