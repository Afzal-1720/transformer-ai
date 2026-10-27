from datetime import datetime
from enum import Enum
from typing import Optional, List
from pydantic import BaseModel, Field

class HealthStatus(str, Enum):
    HEALTHY = "HEALTHY"
    WARNING = "WARNING"
    CRITICAL = "CRITICAL"
    OFFLINE = "OFFLINE"

class RiskLevel(str, Enum):
    LOW = "LOW"
    MEDIUM = "MEDIUM"
    HIGH = "HIGH"
    CRITICAL = "CRITICAL"

class CommunicationStatus(str, Enum):
    ONLINE = "ONLINE"
    STALE = "STALE"
    OFFLINE = "OFFLINE"

class TransformerSpec(BaseModel):
    id: str = Field(..., description="Unique transformer identifier e.g. TX-101")
    name: str = Field(..., description="Descriptive asset name e.g. Substation Alpha TX-1")
    zone: str = Field(..., description="Substation / Grid zone e.g. Zone North (Industrial)")
    rated_capacity_kva: float = Field(..., description="Rated apparent power capacity in kVA")
    primary_voltage_kv: float = Field(..., description="Primary winding rated voltage in kV (e.g. 33.0 or 11.0)")
    secondary_voltage_kv: float = Field(..., description="Secondary winding rated voltage in kV (e.g. 11.0 or 0.415)")
    cooling_type: str = Field(default="ONAN", description="Cooling system class e.g. ONAN, ONAF, OFAF")
    installation_year: int = Field(default=2018, description="Commissioning year")
    latitude: float = Field(default=37.7749)
    longitude: float = Field(default=-122.4194)
    connected_substations: List[str] = Field(default_factory=list, description="IDs of physically tie-able transformers")

class TelemetryReading(BaseModel):
    timestamp: datetime
    transformer_id: str
    voltage_v: float = Field(..., description="Phase/Line-to-line voltage in Volts")
    voltage_kv: float = Field(..., description="Voltage expressed in kV")
    current_a: float = Field(..., description="Current in Amperes")
    active_power_kw: float = Field(..., description="Real / Active power in kW")
    apparent_power_kva: float = Field(..., description="Apparent power in kVA")
    reactive_power_kvar: float = Field(..., description="Reactive power in kVAR")
    power_factor: float = Field(..., description="Power factor (0.0 to 1.0)")
    frequency_hz: float = Field(default=50.0, description="Grid frequency in Hz (nominal 50.0/60.0 Hz)")
    oil_temp_c: float = Field(..., description="Top oil temperature in °C")
    winding_temp_c: float = Field(..., description="Hotspot winding temperature in °C")
    ambient_temp_c: float = Field(..., description="Ambient substation temperature in °C")
    load_percentage: float = Field(..., description="Load percentage relative to rated kVA")
    communication_status: CommunicationStatus = CommunicationStatus.ONLINE
    is_simulated: bool = True

class TransformerDetail(BaseModel):
    spec: TransformerSpec
    telemetry: TelemetryReading
    health_score: float = Field(..., description="Overall health index (0 to 100)")
    health_status: HealthStatus
    risk_level: RiskLevel
    risk_score: float = Field(..., description="Calculated operational risk score (0 to 100)")
    active_alerts_count: int = 0
    is_simulated: bool = True
