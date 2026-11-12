import math
import random
from datetime import datetime, timedelta, timezone
from typing import Dict, List, Optional
from app.config import settings
from app.models.transformer import TransformerSpec, TelemetryReading, SensorStatus
from app.models.alert import Alert, AlertSeverity, AlertCategory, AlertStatus
from app.models.inspection import InspectionRecord, InspectionStatus, InspectionPriority
from app.services.storage import storage
from app.services.condition_evaluator import condition_evaluator

# =========================================================================
# CANONICAL TRANSFORMER FLEET CONFIGURATION
# All units rated at standard low-voltage distribution nominal 240.0 Vrms.
# =========================================================================
INITIAL_TRANSFORMERS: List[TransformerSpec] = [
    TransformerSpec(
        id="TX-001",
        name="Substation North — Feeder Alpha Unit 1",
        substation="North Industrial Zone",
        rated_vrms=240.0,
        rated_irms=100.0,
        rated_kva=24.0,
        cooling_type="ONAN",
        installation_year=2018
    ),
    TransformerSpec(
        id="TX-002",
        name="Substation North — Feeder Alpha Unit 2",
        substation="North Industrial Zone",
        rated_vrms=240.0,
        rated_irms=125.0,
        rated_kva=30.0,
        cooling_type="ONAN",
        installation_year=2020
    ),
    TransformerSpec(
        id="TX-003",
        name="Substation East — Commercial Plaza Unit 1",
        substation="East Commercial District",
        rated_vrms=240.0,
        rated_irms=150.0,
        rated_kva=36.0,
        cooling_type="ONAN",
        installation_year=2019
    ),
    TransformerSpec(
        id="TX-004",
        name="Substation East — Retail Centre Unit 2",
        substation="East Commercial District",
        rated_vrms=240.0,
        rated_irms=80.0,
        rated_kva=19.2,
        cooling_type="ONAN",
        installation_year=2021
    ),
    TransformerSpec(
        id="TX-005",
        name="Substation South — Metro Residential Unit 1",
        substation="South Residential Sector",
        rated_vrms=240.0,
        rated_irms=100.0,
        rated_kva=24.0,
        cooling_type="ONAN",
        installation_year=2017
    ),
    TransformerSpec(
        id="TX-006",
        name="Substation South — Metro Residential Unit 2",
        substation="South Residential Sector",
        rated_vrms=240.0,
        rated_irms=100.0,
        rated_kva=24.0,
        cooling_type="ONAN",
        installation_year=2016
    ),
    TransformerSpec(
        id="TX-007",
        name="Substation West — Technology Park Unit 1",
        substation="West High-Tech Corridor",
        rated_vrms=240.0,
        rated_irms=200.0,
        rated_kva=48.0,
        cooling_type="ONAF",
        installation_year=2022
    ),
    TransformerSpec(
        id="TX-008",
        name="Substation West — Data Center Unit 2",
        substation="West High-Tech Corridor",
        rated_vrms=240.0,
        rated_irms=175.0,
        rated_kva=42.0,
        cooling_type="ONAF",
        installation_year=2023
    ),
]

class TelemetrySimulator:
    def __init__(self):
        self.temperature_state: Dict[str, float] = {}
        self.consecutive_abnormal_ticks: Dict[str, int] = {}
        self.last_valid_telemetry: Dict[str, TelemetryReading] = {}
        self.ongoing_alert_categories: Dict[str, set] = {}

    def initialize_system(self):
        """Populate fleet, generate 48 hours of historical readings, and seed initial inspection records."""
        # 1. Register fleet
        for spec in INITIAL_TRANSFORMERS:
            storage.set_transformer_spec(spec)
            self.temperature_state[spec.id] = 68.0
            self.ongoing_alert_categories[spec.id] = set()

        # 2. Generate 48 hours of baseline readings (hourly steps)
        now = datetime.now(timezone.utc)
        start_time = now - timedelta(hours=48)
        current_time = start_time

        while current_time < now:
            for spec in INITIAL_TRANSFORMERS:
                reading = self._generate_physics_reading(spec, current_time, allow_anomaly=False)
                storage.record_telemetry(reading, max_history=500)
            current_time += timedelta(hours=1)

        # 3. Generate latest current reading
        for spec in INITIAL_TRANSFORMERS:
            reading = self._generate_physics_reading(spec, now, allow_anomaly=True)
            storage.record_telemetry(reading, max_history=500)
            self.last_valid_telemetry[spec.id] = reading

        # 4. Seed sample inspection history
        sample_inspections = [
            InspectionRecord(
                id="INSP-2026-001",
                transformer_id="TX-001",
                transformer_name="Substation North — Feeder Alpha Unit 1",
                reason="Routine visual and terminal connection inspection",
                priority=InspectionPriority.ROUTINE,
                status=InspectionStatus.COMPLETED,
                detected_at=now - timedelta(days=12),
                completed_at=now - timedelta(days=11),
                recommended_action="Inspect bushing terminals and check dielectric moisture",
                assigned_technician="Marcus Vance (Field Lead)",
                notes="Terminals torqued to specification. Dielectric moisture within 14% RH.",
                is_mock_data=True
            ),
            InspectionRecord(
                id="INSP-2026-002",
                transformer_id="TX-003",
                transformer_name="Substation East — Commercial Plaza Unit 1",
                reason="Periodic load profile verification under commercial midday peak",
                priority=InspectionPriority.MEDIUM,
                status=InspectionStatus.ACKNOWLEDGED,
                detected_at=now - timedelta(days=3),
                acknowledged_at=now - timedelta(days=2),
                recommended_action="Inspect connected load and verify secondary cable thermal margins",
                assigned_technician="Elena Rostova",
                notes="Assigned to Field Unit 2. Scheduled for onsite thermography.",
                is_mock_data=True
            )
        ]
        for insp in sample_inspections:
            storage.add_inspection(insp)

    def _get_diurnal_load_factor(self, substation: str, hour: float) -> float:
        """Realistic load curve tailored to distribution zone typology."""
        if "Industrial" in substation:
            # Daytime plateau 07:00 - 20:00 (65% to 85%)
            return 0.58 + 0.24 * (1.0 / (1.0 + math.exp(-0.8 * (hour - 7)))) - 0.18 * (1.0 / (1.0 + math.exp(-0.8 * (hour - 20))))
        elif "Commercial" in substation:
            # Business hours peak 09:00 - 18:00
            peak = math.exp(-((hour - 14) ** 2) / 24.0)
            return 0.42 + 0.45 * peak
        elif "Residential" in substation:
            # Dual peak: morning (07:30) and evening (19:30)
            m = 0.28 * math.exp(-((hour - 7.5) ** 2) / 4.0)
            e = 0.42 * math.exp(-((hour - 19.5) ** 2) / 8.0)
            return 0.35 + m + e
        else:
            # Tech / Data center steady load
            return 0.70 + 0.12 * math.sin((hour - 8) * math.pi / 12.0)

    # =========================================================================
    # FUTURE HARDWARE INTEGRATION:
    # Replace the mock telemetry provider below with the actual
    # hardware/IoT gateway API endpoint.
    # Fetch real Vrms, Arms, winding hotspot temperature and moisture
    # readings from the connected transformer sensors.
    # =========================================================================
    def _generate_physics_reading(
        self, spec: TransformerSpec, timestamp: datetime, allow_anomaly: bool = True
    ) -> TelemetryReading:
        hour = timestamp.hour + timestamp.minute / 60.0 + timestamp.second / 3600.0

        # Ambient baseline (min 18°C, max 32°C)
        ambient_temp = 22.0 + 8.0 * math.sin((hour - 9) * math.pi / 12.0)

        # Baseline loading factor
        base_factor = self._get_diurnal_load_factor(spec.substation, hour)
        unit_offset = ((hash(spec.id) % 11) - 5) / 100.0  # -0.05 to +0.05
        noise = random.uniform(-0.02, 0.02)
        load_ratio = max(0.25, min(1.10, base_factor + unit_offset + noise))

        # Check for demo anomaly injection
        active_anomalies = storage.get_active_anomalies()
        anomaly_info = active_anomalies.get(spec.id) if allow_anomaly else None

        forced_voltage = None
        forced_current = None
        forced_temp_rise = 0.0
        forced_moisture = None
        sensor_status = "ONLINE"

        if anomaly_info:
            atype = anomaly_info.get("type", "").lower()
            if atype == "over_voltage":
                # Push voltage above statutory 254V & > +6%
                forced_voltage = random.uniform(256.5, 264.0)
            elif atype == "under_voltage":
                # Push voltage below statutory 216V & < -10%
                forced_voltage = random.uniform(204.0, 212.0)
            elif atype == "over_current":
                # Push current well above rated (+25% to +45% overload)
                forced_current = spec.rated_irms * random.uniform(1.22, 1.45)
            elif atype == "overheating":
                # Winding hotspot temperature rises into overheating zone (>98°C)
                forced_temp_rise = random.uniform(32.0, 44.0)
            elif atype == "sudden_load_variation":
                # Instantaneous current step increase of +38%
                forced_current = spec.rated_irms * random.uniform(1.15, 1.30)
            elif atype == "sensor_freeze":
                sensor_status = "STALE"
                if spec.id in self.last_valid_telemetry:
                    frozen = self.last_valid_telemetry[spec.id].model_copy()
                    frozen.timestamp = timestamp
                    frozen.sensor_status = "STALE"
                    return frozen
            elif atype == "offline":
                sensor_status = "OFFLINE"

        # 1. Measured Output Voltage (Vrms)
        # Nominal: 240.0 V with small feeder ohmic drop (~1.5% to 3.5%)
        if forced_voltage is not None:
            measured_vrms = round(forced_voltage, 1)
        else:
            voltage_drop = load_ratio * 3.5
            nominal_v = spec.rated_vrms
            measured_vrms = round(nominal_v - voltage_drop + random.uniform(-0.8, 0.8), 1)

        # 2. Measured Output Current (Arms)
        if forced_current is not None:
            measured_irms = round(forced_current, 1)
        else:
            measured_irms = round(spec.rated_irms * load_ratio, 1)

        # 3. Winding Hotspot Temperature (°C)
        # Thermal model: Hotspot temperature = Ambient + steady-state rise from load
        # In a standard distribution transformer, steady rise ~ 45°C * (load_ratio)^1.8
        steady_hotspot = ambient_temp + 42.0 * (load_ratio ** 1.8) + forced_temp_rise
        prev_temp = self.temperature_state.get(spec.id, steady_hotspot)
        # Thermal inertia exponential smoothing (alpha ~ 0.15 per cycle)
        hotspot_temp = round(prev_temp + 0.15 * (steady_hotspot - prev_temp), 1)
        self.temperature_state[spec.id] = hotspot_temp

        # 4. Moisture Reading (% RH)
        if forced_moisture is not None:
            moisture_val = round(forced_moisture, 1)
        else:
            base_moisture = 14.0 + (hash(spec.id) % 8)
            moisture_val = round(base_moisture + random.uniform(-0.5, 0.5), 1)

        # IMPORTANT: Top oil temperature and average winding temperature are NOT exposed.
        return TelemetryReading(
            transformer_id=spec.id,
            timestamp=timestamp,
            vrms=measured_vrms,
            irms=measured_irms,
            winding_hotspot_temperature=hotspot_temp,
            moisture=moisture_val,
            sensor_status=sensor_status,
            is_mock_data=True
        )

    def tick(self) -> Dict[str, TelemetryReading]:
        """Execute one simulation step across the fleet, evaluate anomalies, and trigger debounced inspection alerts."""
        if storage.sim_paused:
            return storage.get_all_latest_telemetry()

        now = datetime.now(timezone.utc)
        results = {}

        for spec in INITIAL_TRANSFORMERS:
            reading = self._generate_physics_reading(spec, now, allow_anomaly=True)
            storage.record_telemetry(reading)
            self.last_valid_telemetry[spec.id] = reading
            results[spec.id] = reading

            # Anomaly and Inspection Notification Evaluation
            self._evaluate_and_notify(spec, reading)

        return results

    def _evaluate_and_notify(self, spec: TransformerSpec, reading: TelemetryReading):
        """
        Detects abnormal readings, performs hysteresis checks to avoid repeated alert spam,
        and generates inspection notifications when anomalies or persistent fluctuations occur.
        """
        history = storage.get_telemetry_history(spec.id, limit=10)
        anomalies = condition_evaluator.detect_anomalies(spec, reading, history)

        active_types = {a.anomaly_type.value for a in anomalies}
        prev_types = self.ongoing_alert_categories.get(spec.id, set())

        # If abnormal conditions exist
        if anomalies:
            self.consecutive_abnormal_ticks[spec.id] = self.consecutive_abnormal_ticks.get(spec.id, 0) + 1

            # Trigger alert after debouncing persistence (>= 2 ticks) for NEW anomaly types
            # to avoid spamming alerts for every reading of the same ongoing condition
            for anm in anomalies:
                atype_str = anm.anomaly_type.value
                if atype_str not in prev_types and self.consecutive_abnormal_ticks[spec.id] >= 2:
                    alert_id = f"ALT-{int(datetime.now(timezone.utc).timestamp()) % 100000:05d}"
                    alert = Alert(
                        id=alert_id,
                        transformer_id=spec.id,
                        substation=spec.substation,
                        severity=AlertSeverity(anm.severity.value.upper()),
                        category=AlertCategory(atype_str),
                        triggering_metric=anm.detected_parameter,
                        triggering_value=float(reading.vrms if "Voltage" in anm.detected_parameter else reading.irms if "Current" in anm.detected_parameter else reading.winding_hotspot_temperature),
                        threshold_value=float(settings.SUPPLY_VOLTAGE_MAX if "Over-Voltage" in anm.anomaly_name else settings.SUPPLY_VOLTAGE_MIN if "Under-Voltage" in anm.anomaly_name else spec.rated_irms),
                        unit="V" if "Voltage" in anm.detected_parameter else "A" if "Current" in anm.detected_parameter else "°C",
                        message=f"{anm.anomaly_name} detected on {spec.id} ({anm.measured_value}). {anm.applicable_threshold}.",
                        recommended_action=anm.recommended_action,
                        inspection_recommended=True,
                        status=AlertStatus.ACTIVE,
                        created_at=datetime.now(timezone.utc),
                        is_mock_data=True
                    )
                    storage.add_alert(alert)

                    # Create corresponding inspection requirement record
                    insp_id = f"INSP-{int(datetime.now(timezone.utc).timestamp()) % 100000:05d}"
                    prio = InspectionPriority.CRITICAL if anm.severity.value == "Critical" else InspectionPriority.HIGH
                    insp_record = InspectionRecord(
                        id=insp_id,
                        transformer_id=spec.id,
                        transformer_name=spec.name,
                        reason=f"Abnormal reading detected: {anm.anomaly_name} ({anm.measured_value})",
                        priority=prio,
                        status=InspectionStatus.PENDING,
                        detected_at=datetime.now(timezone.utc),
                        recommended_action=anm.recommended_action,
                        assigned_technician="Substation Electrical Field Team",
                        notes="Automated inspection recommendation triggered by abnormal telemetry.",
                        is_mock_data=True
                    )
                    storage.add_inspection(insp_record)

            self.ongoing_alert_categories[spec.id] = active_types
        else:
            self.consecutive_abnormal_ticks[spec.id] = 0
            self.ongoing_alert_categories[spec.id] = set()

simulator = TelemetrySimulator()
