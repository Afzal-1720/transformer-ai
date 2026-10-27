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
    OVERLOAD = "OVERLOAD"
    TEMPERATURE = "TEMPERATURE"
    VOLTAGE = "VOLTAGE"
    ANOMALY = "ANOMALY"
    DATA_QUALITY = "DATA_QUALITY"
    COMMUNICATION = "COMMUNICATION"

class Alert(BaseModel):
    id: str = Field(..., description="Unique alert identifier e.g. ALT-1001")
    transformer_id: str
    zone: str
    severity: AlertSeverity
    category: AlertCategory
    triggering_metric: str = Field(..., description="e.g. load_percentage, oil_temp_c, voltage_dev")
    triggering_value: float
    threshold_value: float
    unit: str
    message: str
    recommended_action: str
    status: AlertStatus = AlertStatus.ACTIVE
    created_at: datetime
    acknowledged_at: Optional[datetime] = None
    resolved_at: Optional[datetime] = None
    is_simulated: bool = True
