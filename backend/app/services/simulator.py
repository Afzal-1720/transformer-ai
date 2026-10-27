import math
import random
from datetime import datetime, timedelta, timezone
from typing import Dict, List, Optional
from app.models.transformer import (
    TransformerSpec, TelemetryReading, CommunicationStatus, HealthStatus, RiskLevel
)
from app.models.alert import Alert, AlertSeverity, AlertCategory, AlertStatus
from app.models.maintenance import MaintenanceTask, TaskPriority, TaskStatus
from app.services.storage import storage

# Canonical transformer fleet
INITIAL_TRANSFORMERS: List[TransformerSpec] = [
    TransformerSpec(
        id="TX-101",
        name="Substation North — Heavy Industrial T1",
        zone="Zone North (Industrial)",
        rated_capacity_kva=2500.0,
        primary_voltage_kv=33.0,
        secondary_voltage_kv=11.0,
        cooling_type="ONAF",
        installation_year=2017,
        latitude=37.7833,
        longitude=-122.4167,
        connected_substations=["TX-102", "TX-501"]
    ),
    TransformerSpec(
        id="TX-102",
        name="Substation North — Auxiliary Feeder T2",
        zone="Zone North (Industrial)",
        rated_capacity_kva=1500.0,
        primary_voltage_kv=33.0,
        secondary_voltage_kv=11.0,
        cooling_type="ONAN",
        installation_year=2019,
        latitude=37.7850,
        longitude=-122.4120,
        connected_substations=["TX-101", "TX-501"]
    ),
    TransformerSpec(
        id="TX-201",
        name="Substation East — Commercial Core T1",
        zone="Zone East (Commercial)",
        rated_capacity_kva=2000.0,
        primary_voltage_kv=11.0,
        secondary_voltage_kv=0.415,
        cooling_type="ONAN",
        installation_year=2018,
        latitude=37.7790,
        longitude=-122.3950,
        connected_substations=["TX-202", "TX-501"]
    ),
    TransformerSpec(
        id="TX-202",
        name="Substation East — Retail Plaza T2",
        zone="Zone East (Commercial)",
        rated_capacity_kva=1000.0,
        primary_voltage_kv=11.0,
        secondary_voltage_kv=0.415,
        cooling_type="ONAN",
        installation_year=2021,
        latitude=37.7760,
        longitude=-122.3910,
        connected_substations=["TX-201"]
    ),
    TransformerSpec(
        id="TX-301",
        name="Substation South — Metro Residential T1",
        zone="Zone South (Residential)",
        rated_capacity_kva=1250.0,
        primary_voltage_kv=11.0,
        secondary_voltage_kv=0.415,
        cooling_type="ONAN",
        installation_year=2016,
        latitude=37.7550,
        longitude=-122.4200,
        connected_substations=["TX-302"]
    ),
    TransformerSpec(
        id="TX-302",
        name="Substation South — Metro Residential T2",
        zone="Zone South (Residential)",
        rated_capacity_kva=1250.0,
        primary_voltage_kv=11.0,
        secondary_voltage_kv=0.415,
        cooling_type="ONAN",
        installation_year=2015,
        latitude=37.7510,
        longitude=-122.4230,
        connected_substations=["TX-301", "TX-303"]
    ),
    TransformerSpec(
        id="TX-303",
        name="Substation South — Highland Estates T3",
        zone="Zone South (Residential)",
        rated_capacity_kva=800.0,
        primary_voltage_kv=11.0,
        secondary_voltage_kv=0.415,
        cooling_type="ONAN",
        installation_year=2020,
        latitude=37.7460,
        longitude=-122.4350,
        connected_substations=["TX-302"]
    ),
    TransformerSpec(
        id="TX-401",
        name="Substation West — Silicon Data Center T1",
        zone="Zone West (Technology)",
        rated_capacity_kva=3000.0,
        primary_voltage_kv=33.0,
        secondary_voltage_kv=11.0,
        cooling_type="OFAF",
        installation_year=2022,
        latitude=37.7690,
        longitude=-122.4490,
        connected_substations=["TX-402", "TX-501"]
    ),
    TransformerSpec(
        id="TX-402",
        name="Substation West — Research Campus T2",
        zone="Zone West (Technology)",
        rated_capacity_kva=2500.0,
        primary_voltage_kv=33.0,
        secondary_voltage_kv=11.0,
        cooling_type="ONAF",
        installation_year=2021,
        latitude=37.7720,
        longitude=-122.4450,
        connected_substations=["TX-401"]
    ),
    TransformerSpec(
        id="TX-501",
        name="Central Grid Inter-tie Substation",
        zone="Zone Central (Transmission)",
        rated_capacity_kva=5000.0,
        primary_voltage_kv=132.0,
        secondary_voltage_kv=33.0,
        cooling_type="OFAF",
        installation_year=2014,
        latitude=37.7700,
        longitude=-122.4180,
        connected_substations=["TX-101", "TX-201", "TX-401"]
    )
]

class TelemetrySimulator:
    def __init__(self):
        self.temperature_state: Dict[str, float] = {}
        self.consecutive_abnormal_ticks: Dict[str, int] = {}
        self.last_valid_telemetry: Dict[str, TelemetryReading] = {}
        self.stale_ticks_counter: Dict[str, int] = {}

    def initialize_system(self):
        """Populate fleet, generate 48-hour historical telemetry, and register initial tasks."""
        # 1. Register transformers
        for spec in INITIAL_TRANSFORMERS:
            storage.set_transformer_spec(spec)
            self.temperature_state[spec.id] = 48.0  # nominal initial oil temp

        # 2. Generate 48 hours of historical readings (hourly)
        now = datetime.now(timezone.utc)
        start_time = now - timedelta(hours=48)
        
        current_time = start_time
        while current_time < now:
            for spec in INITIAL_TRANSFORMERS:
                reading = self._generate_physics_reading(spec, current_time, allow_anomaly=False)
                storage.record_telemetry(reading, max_history=600)
            current_time += timedelta(hours=1)

        # 3. Generate latest current reading
        for spec in INITIAL_TRANSFORMERS:
            reading = self._generate_physics_reading(spec, now, allow_anomaly=True)
            storage.record_telemetry(reading, max_history=600)
            self.last_valid_telemetry[spec.id] = reading

        # 4. Create sample initial maintenance work orders
        sample_tasks = [
            MaintenanceTask(
                id="MNT-2026-001",
                transformer_id="TX-101",
                title="DGA Dissolved Gas Analysis & Oil Dielectric Testing",
                description="Routine semi-annual oil dielectric breakdown testing and dissolved gas chromatography.",
                priority=TaskPriority.P2_HIGH,
                status=TaskStatus.IN_PROGRESS,
                assigned_technician="Sarah Chen (High-Voltage Lead)",
                scheduled_date=(now + timedelta(days=2)).strftime("%Y-%m-%d"),
                created_at=now - timedelta(days=5),
                notes="Previous DGA showed minor trace acetylene (1.2 ppm), stable."
            ),
            MaintenanceTask(
                id="MNT-2026-002",
                transformer_id="TX-501",
                title="Cooling Radiator Fan Bank #2 Inspection",
                description="Check thermal vibration, bearings, and automatic thermostat control contactors.",
                priority=TaskPriority.P3_MEDIUM,
                status=TaskStatus.OPEN,
                assigned_technician="Marcus Vance",
                scheduled_date=(now + timedelta(days=7)).strftime("%Y-%m-%d"),
                created_at=now - timedelta(days=2),
                notes="Visual inspection indicated slight oil dust accumulation on upper fins."
            ),
            MaintenanceTask(
                id="MNT-2026-003",
                transformer_id="TX-302",
                title="Bushing Infrared Thermography & Tightening",
                description="Inspect secondary 0.415 kV terminal connections under peak evening loading.",
                priority=TaskPriority.P4_ROUTINE,
                status=TaskStatus.COMPLETED,
                assigned_technician="David Kim",
                scheduled_date=(now - timedelta(days=10)).strftime("%Y-%m-%d"),
                completed_date=(now - timedelta(days=9)).strftime("%Y-%m-%d"),
                created_at=now - timedelta(days=15),
                notes="Terminal delta-T within 2.1°C of ambient. Connection torqued to 85 Nm."
            )
        ]
        for t in sample_tasks:
            storage.add_maintenance_task(t)

    def _get_diurnal_load_factor(self, zone: str, hour: float) -> float:
        """Realistic load multiplier depending on zone typology and hour (0-24)."""
        if "Industrial" in zone:
            # 2-shift industrial plateau: high 07:00 - 22:00, moderate overnight
            base = 0.55 + 0.32 * (1.0 / (1.0 + math.exp(-0.8 * (hour - 7)))) - 0.25 * (1.0 / (1.0 + math.exp(-0.8 * (hour - 21))))
            return max(0.45, min(base, 0.95))
        elif "Commercial" in zone:
            # Business hours peak 09:00 - 18:00
            peak = math.exp(-((hour - 14) ** 2) / 24.0)
            return 0.35 + 0.55 * peak
        elif "Residential" in zone:
            # Dual peak: morning (07:30) and evening (19:30)
            morning = 0.35 * math.exp(-((hour - 7.5) ** 2) / 4.0)
            evening = 0.55 * math.exp(-((hour - 19.5) ** 2) / 8.0)
            return 0.30 + morning + evening
        elif "Technology" in zone:
            # High continuous baseline (servers/data centers) with minor daytime variation
            return 0.72 + 0.16 * math.sin((hour - 8) * math.pi / 12.0)
        else:
            # Central transmission inter-tie: aggregate weighted curve
            return 0.60 + 0.25 * math.sin((hour - 10) * math.pi / 12.0)

    def _generate_physics_reading(self, spec: TransformerSpec, timestamp: datetime, allow_anomaly: bool = True) -> TelemetryReading:
        hour = timestamp.hour + timestamp.minute / 60.0 + timestamp.second / 3600.0
        
        # Ambient temperature diurnal model: min 16°C at 05:00, max 32°C at 15:00
        ambient_temp = 22.0 + 8.0 * math.sin((hour - 9) * math.pi / 12.0)
        
        # Base load factor for this transformer type
        zone_factor = self._get_diurnal_load_factor(spec.zone, hour)
        
        # Unit-specific offset so identical zones have natural variance
        unit_hash_factor = (hash(spec.id) % 15 - 7) / 100.0  # -0.07 to +0.07
        random_noise = random.uniform(-0.025, 0.025)
        load_ratio = max(0.20, zone_factor + unit_hash_factor + random_noise)

        # Check for active injected anomaly
        active_anomalies = storage.get_active_anomalies()
        anomaly_info = active_anomalies.get(spec.id) if allow_anomaly else None
        
        comm_status = CommunicationStatus.ONLINE
        forced_voltage_sag = 1.0
        forced_temp_rise = 0.0
        
        if anomaly_info:
            atype = anomaly_info.get("type")
            if atype == "overload":
                # Push load to 118% - 130%
                load_ratio = random.uniform(1.18, 1.32)
            elif atype == "high_temp":
                forced_temp_rise = random.uniform(28.0, 42.0)
            elif atype == "voltage_sag":
                forced_voltage_sag = random.uniform(0.82, 0.88)
            elif atype == "sensor_freeze":
                comm_status = CommunicationStatus.STALE
                if spec.id in self.last_valid_telemetry:
                    # Return exact duplicate frozen reading
                    frozen = self.last_valid_telemetry[spec.id].model_copy()
                    frozen.timestamp = timestamp
                    frozen.communication_status = CommunicationStatus.STALE
                    return frozen
            elif atype == "offline":
                comm_status = CommunicationStatus.OFFLINE

        # Apparent power S in kVA
        apparent_power_kva = round(spec.rated_capacity_kva * load_ratio, 1)
        load_percentage = round((apparent_power_kva / spec.rated_capacity_kva) * 100.0, 1)

        # Power factor (nominal 0.93 - 0.97 for industrial/commercial, 0.90 - 0.95 residential)
        pf_base = 0.95 if "Technology" in spec.zone else 0.93
        power_factor = round(min(0.99, max(0.82, pf_base + random.uniform(-0.02, 0.02))), 3)

        # Active power P (kW) and Reactive power Q (kVAR)
        active_power_kw = round(apparent_power_kva * power_factor, 1)
        q_squared = max(0.0, apparent_power_kva**2 - active_power_kw**2)
        reactive_power_kvar = round(math.sqrt(q_squared), 1)

        # Secondary voltage V
        nominal_v_kv = spec.secondary_voltage_kv
        # High load causes small feeder voltage drop (ohmic drop)
        voltage_drop_pct = (load_ratio * 0.035) * forced_voltage_sag
        actual_v_kv = round(nominal_v_kv * (1.0 - voltage_drop_pct + random.uniform(-0.005, 0.005)) * forced_voltage_sag, 3)
        actual_v_v = round(actual_v_kv * 1000.0, 1)

        # Current I = S / (sqrt(3) * V_LL)
        # S in kVA -> S*1000 VA, V in V
        if actual_v_v > 0:
            current_a = round((apparent_power_kva * 1000.0) / (math.sqrt(3) * actual_v_v), 1)
        else:
            current_a = 0.0

        # Frequency (nominally 50.0 Hz, standard grid governor swing ±0.06 Hz)
        frequency_hz = round(50.0 + random.uniform(-0.04, 0.04), 2)

        # Thermal physics model:
        # Steady state temperature rise delta_T = delta_T_rated * (load_ratio)^1.6
        # delta_T_rated ~ 50°C for standard distribution transformers
        delta_t_rated = 48.0
        delta_t_steady = delta_t_rated * (load_ratio ** 1.6)
        steady_oil_temp = ambient_temp + delta_t_steady + forced_temp_rise

        # Thermal inertia: smooth transition toward steady state
        prev_temp = self.temperature_state.get(spec.id, steady_oil_temp)
        # alpha time constant factor (~0.12 per tick step)
        oil_temp = round(prev_temp + 0.12 * (steady_oil_temp - prev_temp), 1)
        self.temperature_state[spec.id] = oil_temp

        # Winding hotspot temperature = oil temp + winding gradient
        winding_gradient = 14.0 * (load_ratio ** 1.8)
        winding_temp = round(oil_temp + winding_gradient, 1)

        reading = TelemetryReading(
            timestamp=timestamp,
            transformer_id=spec.id,
            voltage_v=actual_v_v,
            voltage_kv=actual_v_kv,
            current_a=current_a,
            active_power_kw=active_power_kw,
            apparent_power_kva=apparent_power_kva,
            reactive_power_kvar=reactive_power_kvar,
            power_factor=power_factor,
            frequency_hz=frequency_hz,
            oil_temp_c=oil_temp,
            winding_temp_c=winding_temp,
            ambient_temp_c=round(ambient_temp, 1),
            load_percentage=load_percentage,
            communication_status=comm_status,
            is_simulated=True
        )
        return reading

    def tick(self) -> Dict[str, TelemetryReading]:
        """Execute one simulation cycle: generate fresh telemetry and evaluate threshold alarms."""
        if storage.sim_paused:
            return storage.get_all_latest_telemetry()

        now = datetime.now(timezone.utc)
        results = {}

        for spec in INITIAL_TRANSFORMERS:
            reading = self._generate_physics_reading(spec, now, allow_anomaly=True)
            storage.record_telemetry(reading)
            self.last_valid_telemetry[spec.id] = reading
            results[spec.id] = reading

            # Evaluate hysteresis-aware alert rules
            self._evaluate_telemetry_alerts(spec, reading)

        return results

    def _evaluate_telemetry_alerts(self, spec: TransformerSpec, reading: TelemetryReading):
        """Hysteresis filter: triggers alert after persistent violation to prevent alarm chatter."""
        is_abnormal = False
        alert_candidate = None

        if reading.communication_status == CommunicationStatus.OFFLINE:
            alert_candidate = {
                "category": AlertCategory.COMMUNICATION,
                "severity": AlertSeverity.CRITICAL,
                "metric": "communication_status",
                "val": 0.0,
                "thresh": 1.0,
                "unit": "status",
                "msg": f"Loss of SCADA telemetry connection from {spec.name}.",
                "rec": "Inspect field RTU, modem antenna, and substation switch."
            }
            is_abnormal = True
        elif reading.load_percentage >= 115.0:
            alert_candidate = {
                "category": AlertCategory.OVERLOAD,
                "severity": AlertSeverity.CRITICAL,
                "metric": "load_percentage",
                "val": reading.load_percentage,
                "thresh": 115.0,
                "unit": "%",
                "msg": f"Critical overload on {spec.id} ({reading.load_percentage}%). Risk of accelerated insulation degradation.",
                "rec": "Execute emergency load transfer or shed non-critical feeders."
            }
            is_abnormal = True
        elif reading.load_percentage >= 100.0:
            alert_candidate = {
                "category": AlertCategory.OVERLOAD,
                "severity": AlertSeverity.WARNING,
                "metric": "load_percentage",
                "val": reading.load_percentage,
                "thresh": 100.0,
                "unit": "%",
                "msg": f"Sustained rated load exceeded on {spec.id} ({reading.load_percentage}%).",
                "rec": "Monitor winding hotspot temp and prepare contingency switching."
            }
            is_abnormal = True
        elif reading.oil_temp_c >= 88.0:
            alert_candidate = {
                "category": AlertCategory.TEMPERATURE,
                "severity": AlertSeverity.CRITICAL,
                "metric": "oil_temp_c",
                "val": reading.oil_temp_c,
                "thresh": 88.0,
                "unit": "°C",
                "msg": f"Top oil temperature critical on {spec.id} ({reading.oil_temp_c}°C).",
                "rec": "Verify forced-air cooling fans and reduce apparent loading."
            }
            is_abnormal = True
        elif reading.oil_temp_c >= 78.0:
            alert_candidate = {
                "category": AlertCategory.TEMPERATURE,
                "severity": AlertSeverity.WARNING,
                "metric": "oil_temp_c",
                "val": reading.oil_temp_c,
                "thresh": 78.0,
                "unit": "°C",
                "msg": f"Elevated top oil temperature on {spec.id} ({reading.oil_temp_c}°C).",
                "rec": "Check ambient temperature ventilation and cooling radiator oil flow."
            }
            is_abnormal = True

        # Track persistence
        count = self.consecutive_abnormal_ticks.get(spec.id, 0)
        if is_abnormal:
            count += 1
            self.consecutive_abnormal_ticks[spec.id] = count
            # Trigger alert once threshold persistence is met (>= 2 ticks)
            if count == 2 and alert_candidate:
                alert_id = f"ALT-{int(datetime.now(timezone.utc).timestamp()) % 100000:05d}"
                alert = Alert(
                    id=alert_id,
                    transformer_id=spec.id,
                    zone=spec.zone,
                    severity=alert_candidate["severity"],
                    category=alert_candidate["category"],
                    triggering_metric=alert_candidate["metric"],
                    triggering_value=alert_candidate["val"],
                    threshold_value=alert_candidate["thresh"],
                    unit=alert_candidate["unit"],
                    message=alert_candidate["msg"],
                    recommended_action=alert_candidate["rec"],
                    status=AlertStatus.ACTIVE,
                    created_at=datetime.now(timezone.utc),
                    is_simulated=True
                )
                storage.add_alert(alert)
        else:
            self.consecutive_abnormal_ticks[spec.id] = 0

simulator = TelemetrySimulator()
