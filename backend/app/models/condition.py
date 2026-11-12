from datetime import datetime
from enum import Enum
from typing import Optional, List
from pydantic import BaseModel, Field
from app.models.transformer import OverallCondition

class SensorConnectivity(str, Enum):
    ONLINE = "Online"
    OFFLINE = "Offline"
    CONNECTION_LOST = "Connection Lost / No Recent Data"

class VoltageBehaviour(str, Enum):
    STABLE = "Stable"
    FLUCTUATING = "Fluctuating"
    UNDER_VOLTAGE = "Under Voltage"
    OVER_VOLTAGE = "Over Voltage"

class LoadingCondition(str, Enum):
    NORMAL = "Normal"
    HIGH = "High"
    OVERLOADED = "Overloaded"

class ThermalCondition(str, Enum):
    NORMAL = "Normal"
    ELEVATED = "Elevated"
    OVERHEATING = "Overheating"

class TransformerConditionReport(BaseModel):
    transformer_id: str
    timestamp: datetime

    # Evaluated sub-conditions
    sensor_connectivity: SensorConnectivity
    voltage_behaviour: VoltageBehaviour
    loading_condition: LoadingCondition
    thermal_condition: ThermalCondition

    # Overall condition
    overall_condition: OverallCondition
    condition_explanation: str
    recommended_action: str
    inspection_required: bool

    # Underlying metrics
    vrms_measured: float
    vrms_rated: float
    voltage_deviation_pct: float
    irms_measured: float
    irms_rated: float
    current_deviation_pct: float
    loading_pct: float
    winding_hotspot_temperature: float
    moisture: float

    # Threshold references
    voltage_permissible_deviation: str = "-10% to +6%"
    statutory_supply_range: str = "216 V to 254 V"
    configured_current_limit: str = "+10.0% above rated Arms"
    configured_loading_thresholds: str = "Normal: <80%, High: 80-100%, Overloaded: >100%"
    configured_thermal_thresholds: str = "Normal: <80°C, Elevated: 80-95°C, Overheating: >95°C"

    is_mock_data: bool = True
