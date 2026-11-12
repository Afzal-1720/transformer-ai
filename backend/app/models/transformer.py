from datetime import datetime
from enum import Enum
from typing import Optional, List
from pydantic import BaseModel, Field

class SensorStatus(str, Enum):
    ONLINE = "ONLINE"
    STALE = "STALE"
    OFFLINE = "OFFLINE"
    CONNECTION_LOST = "CONNECTION_LOST"

class OverallCondition(str, Enum):
    HEALTHY = "HEALTHY"
    WARNING = "WARNING"
    CRITICAL = "CRITICAL"
    INSPECTION_REQUIRED = "INSPECTION_REQUIRED"

class TransformerSpec(BaseModel):
    id: str = Field(..., description="Unique transformer identifier e.g. TX-001")
    name: str = Field(..., description="Descriptive asset name e.g. Feeder Substation Unit 1")
    substation: str = Field(..., description="Substation / Distribution zone location")
    rated_vrms: float = Field(default=240.0, description="Rated output voltage Vrms in Volts (e.g. 240.0 V)")
    rated_irms: float = Field(..., description="Rated output current Arms in Amperes (e.g. 100.0 A)")
    rated_kva: float = Field(..., description="Rated apparent power capacity in kVA")
    cooling_type: str = Field(default="ONAN", description="Cooling system class e.g. ONAN")
    installation_year: int = Field(default=2019, description="Commissioning year")

# =========================================================================
# FUTURE HARDWARE INTEGRATION:
# Replace the mock telemetry provider below with the actual
# hardware/IoT gateway API endpoint.
# Fetch real Vrms, Arms, winding hotspot temperature and moisture
# readings from the connected transformer sensors.
# =========================================================================
class TelemetryReading(BaseModel):
    transformer_id: str
    timestamp: datetime
    vrms: float = Field(..., description="Measured output voltage Vrms in Volts")
    irms: float = Field(..., description="Measured output current Arms in Amperes")
    winding_hotspot_temperature: float = Field(..., description="Winding Hotspot Temperature in °C (from sensor reading)")
    moisture: float = Field(..., description="Moisture in % RH (relative saturation in dielectric insulation)")
    sensor_status: str = Field(default="ONLINE", description="ONLINE, STALE, OFFLINE, CONNECTION_LOST")
    is_mock_data: bool = True

    # Note: As per project requirements, Top Oil Temperature (60°C) and Average Winding
    # Temperature (65°C) are internal design baselines and are strictly NOT displayed or exposed.

class TransformerDetail(BaseModel):
    spec: TransformerSpec
    telemetry: TelemetryReading

    # A. Output Voltage Assessment (Separate Checks)
    voltage_deviation_pct: float = Field(..., description="((Measured V - Rated V) / Rated V) * 100")
    voltage_deviation_status: str = Field(..., description="Normal (-10% to +6%) / Under-Voltage Deviation (< -10%) / Over-Voltage Deviation (> +6%)")
    supply_voltage_status: str = Field(..., description="Normal (216V-254V) / Under-Voltage Warning (<216V) / Over-Voltage Warning (>254V)")

    # B. Output Current Assessment
    current_deviation_pct: float = Field(..., description="((Measured I - Rated I) / Rated I) * 100")
    current_condition: str = Field(..., description="Normal / Over Current (against configurable threshold)")

    # C. Loading & Thermal Condition
    loading_pct: float = Field(..., description="(Measured Current / Rated Current) * 100")
    loading_condition: str = Field(..., description="Normal (<80%) / High (80%-100%) / Overloaded (>100%)")
    thermal_condition: str = Field(..., description="Normal (<80°C) / Elevated (80°-95°C) / Overheating (>95°C)")
    voltage_behaviour: str = Field(..., description="Stable / Fluctuating / Under Voltage / Over Voltage")

    # D. Overall Condition Assessment
    overall_condition: OverallCondition
    condition_explanation: str
    recommended_action: str
    inspection_required: bool = False
    active_anomalies_count: int = 0
    is_mock_data: bool = True
