import threading
from typing import Dict, List, Optional
from datetime import datetime, timezone
from app.models.transformer import TransformerSpec, TelemetryReading
from app.models.alert import Alert, AlertStatus, AlertSeverity
from app.models.inspection import InspectionRecord, InspectionStatus, InspectionPriority

class InMemoryStorage:
    def __init__(self):
        self._lock = threading.Lock()
        self.transformers: Dict[str, TransformerSpec] = {}
        self.latest_telemetry: Dict[str, TelemetryReading] = {}
        self.telemetry_history: Dict[str, List[TelemetryReading]] = {}  # Max 600 items per transformer
        self.alerts: Dict[str, Alert] = {}
        self.inspections: Dict[str, InspectionRecord] = {}
        self.sim_speed_multiplier: float = 1.0
        self.sim_paused: bool = False
        self.injected_anomalies: Dict[str, dict] = {} # transformer_id -> anomaly config

    # Transformers
    def set_transformer_spec(self, spec: TransformerSpec):
        with self._lock:
            self.transformers[spec.id] = spec
            if spec.id not in self.telemetry_history:
                self.telemetry_history[spec.id] = []

    def get_transformers(self) -> List[TransformerSpec]:
        with self._lock:
            return list(self.transformers.values())

    def get_transformer(self, transformer_id: str) -> Optional[TransformerSpec]:
        with self._lock:
            return self.transformers.get(transformer_id)

    # Telemetry
    def record_telemetry(self, telemetry: TelemetryReading, max_history: int = 500):
        with self._lock:
            self.latest_telemetry[telemetry.transformer_id] = telemetry
            history = self.telemetry_history.setdefault(telemetry.transformer_id, [])
            history.append(telemetry)
            if len(history) > max_history:
                self.telemetry_history[telemetry.transformer_id] = history[-max_history:]

    def get_latest_telemetry(self, transformer_id: str) -> Optional[TelemetryReading]:
        with self._lock:
            return self.latest_telemetry.get(transformer_id)

    def get_all_latest_telemetry(self) -> Dict[str, TelemetryReading]:
        with self._lock:
            return dict(self.latest_telemetry)

    def get_telemetry_history(self, transformer_id: str, limit: int = 100) -> List[TelemetryReading]:
        with self._lock:
            history = self.telemetry_history.get(transformer_id, [])
            return history[-limit:] if limit > 0 else history

    # Alerts & Anomaly Notifications
    def add_alert(self, alert: Alert):
        with self._lock:
            self.alerts[alert.id] = alert

    def get_alerts(
        self,
        status: Optional[AlertStatus] = None,
        severity: Optional[AlertSeverity] = None,
        transformer_id: Optional[str] = None
    ) -> List[Alert]:
        with self._lock:
            results = list(self.alerts.values())
            if status:
                results = [a for a in results if a.status == status]
            if severity:
                results = [a for a in results if a.severity == severity]
            if transformer_id:
                results = [a for a in results if a.transformer_id == transformer_id]
            return sorted(results, key=lambda a: a.created_at, reverse=True)

    def get_active_alerts_count(self, transformer_id: Optional[str] = None) -> int:
        with self._lock:
            active = [a for a in self.alerts.values() if a.status == AlertStatus.ACTIVE]
            if transformer_id:
                active = [a for a in active if a.transformer_id == transformer_id]
            return len(active)

    def acknowledge_alert(self, alert_id: str) -> Optional[Alert]:
        with self._lock:
            alert = self.alerts.get(alert_id)
            if alert:
                alert.status = AlertStatus.ACKNOWLEDGED
                alert.acknowledged_at = datetime.now(timezone.utc)
                return alert
            return None

    def resolve_alert(self, alert_id: str) -> Optional[Alert]:
        with self._lock:
            alert = self.alerts.get(alert_id)
            if alert:
                alert.status = AlertStatus.RESOLVED
                alert.resolved_at = datetime.now(timezone.utc)
                return alert
            return None

    # Inspections & Maintenance
    def add_inspection(self, record: InspectionRecord):
        with self._lock:
            self.inspections[record.id] = record

    def get_inspections(
        self,
        transformer_id: Optional[str] = None,
        status: Optional[InspectionStatus] = None
    ) -> List[InspectionRecord]:
        with self._lock:
            records = list(self.inspections.values())
            if transformer_id:
                records = [r for r in records if r.transformer_id == transformer_id]
            if status:
                records = [r for r in records if r.status == status]
            return sorted(records, key=lambda r: r.detected_at, reverse=True)

    def update_inspection(self, record_id: str, updates: dict) -> Optional[InspectionRecord]:
        with self._lock:
            record = self.inspections.get(record_id)
            if not record:
                return None
            for key, val in updates.items():
                if val is not None and hasattr(record, key):
                    setattr(record, key, val)
            return record

    def get_pending_inspections_count(self, transformer_id: Optional[str] = None) -> int:
        with self._lock:
            pending = [r for r in self.inspections.values() if r.status != InspectionStatus.COMPLETED]
            if transformer_id:
                pending = [r for r in pending if r.transformer_id == transformer_id]
            return len(pending)

    # Simulation Controls
    def set_simulation_speed(self, multiplier: float):
        with self._lock:
            self.sim_speed_multiplier = max(0.2, min(multiplier, 20.0))

    def set_simulation_pause(self, paused: bool):
        with self._lock:
            self.sim_paused = paused

    def inject_anomaly(self, transformer_id: str, anomaly_type: str, severity: str = "HIGH", duration_sec: int = 120):
        with self._lock:
            self.injected_anomalies[transformer_id] = {
                "type": anomaly_type,
                "severity": severity,
                "duration_sec": duration_sec,
                "started_at": datetime.now(timezone.utc).timestamp()
            }

    def clear_anomaly(self, transformer_id: str):
        with self._lock:
            self.injected_anomalies.pop(transformer_id, None)

    def get_active_anomalies(self) -> Dict[str, dict]:
        with self._lock:
            now = datetime.now(timezone.utc).timestamp()
            expired = [
                tx_id for tx_id, conf in self.injected_anomalies.items()
                if (now - conf["started_at"]) > conf["duration_sec"]
            ]
            for tx_id in expired:
                del self.injected_anomalies[tx_id]
            return dict(self.injected_anomalies)

storage = InMemoryStorage()
