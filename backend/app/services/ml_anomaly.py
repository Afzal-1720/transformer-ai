import numpy as np
import pandas as pd
from datetime import datetime, timezone
from typing import List, Dict, Any, Tuple
from sklearn.ensemble import IsolationForest
from app.models.ai import AnomalyDetectionResponse, AnomalyContribution
from app.models.alert import AlertSeverity
from app.services.storage import storage

class AnomalyDetectionEngine:
    def __init__(self):
        self.forest = IsolationForest(
            n_estimators=100,
            contamination=0.05,
            random_state=42
        )
        self.fitted_transformer_id: str | None = None
        self.feature_means: Dict[str, float] = {}
        self.feature_stds: Dict[str, float] = {}

    def _prepare_matrix(self, history: list) -> np.ndarray:
        data = []
        for r in history:
            v_dev = abs(r.voltage_v - (r.voltage_kv * 1000.0 if r.voltage_kv > 1.0 else 415.0))
            delta_t = r.oil_temp_c - r.ambient_temp_c
            data.append([
                r.load_percentage,
                r.oil_temp_c,
                r.power_factor,
                v_dev,
                delta_t
            ])
        return np.array(data)

    def detect_anomalies(self, transformer_id: str) -> AnomalyDetectionResponse:
        spec = storage.get_transformer(transformer_id)
        if not spec:
            raise ValueError(f"Transformer {transformer_id} not found")

        history = storage.get_telemetry_history(transformer_id, limit=200)
        current = storage.get_latest_telemetry(transformer_id)

        if not current:
            now = datetime.now(timezone.utc)
            return AnomalyDetectionResponse(
                transformer_id=transformer_id,
                timestamp=now,
                is_anomaly=False,
                anomaly_score=0.0,
                severity=AlertSeverity.INFO,
                contributing_features=[],
                heuristic_observation="Telemetry unavailable. Sensor verification required.",
                recommended_checks=["Verify communication channel and RTU power status."],
                is_simulated=True
            )

        nominal_v = spec.secondary_voltage_kv * 1000.0 if spec.secondary_voltage_kv < 10.0 else spec.secondary_voltage_kv * 1000.0
        curr_v_dev = abs(current.voltage_v - nominal_v) / max(nominal_v, 1.0) * 100.0
        curr_delta_t = current.oil_temp_c - current.ambient_temp_c

        curr_vector = np.array([
            current.load_percentage,
            current.oil_temp_c,
            current.power_factor,
            curr_v_dev,
            curr_delta_t
        ]).reshape(1, -1)

        # Baseline stats for feature attribution
        if len(history) >= 20:
            hist_mat = self._prepare_matrix(history)
            means = np.mean(hist_mat, axis=0)
            stds = np.std(hist_mat, axis=0) + 1e-4

            # Train Isolation Forest on normal history
            iso = IsolationForest(n_estimators=60, contamination=0.05, random_state=42)
            iso.fit(hist_mat)
            
            raw_score = float(iso.decision_function(curr_vector)[0])  # negative is anomalous
            is_anomaly = bool(iso.predict(curr_vector)[0] == -1)
        else:
            means = np.array([65.0, 52.0, 0.94, 1.2, 28.0])
            stds = np.array([15.0, 10.0, 0.04, 1.5, 8.0])
            # Heuristic score
            raw_score = 0.25
            is_anomaly = (current.load_percentage > 105.0 or current.oil_temp_c > 80.0 or curr_v_dev > 6.0)

        # Normalized anomaly severity score (0 to 100, where > 65 is anomalous)
        # Decision function: typically ranges from -0.3 (extreme anomaly) to +0.25 (typical normal)
        normalized_score = float(np.clip((0.20 - raw_score) / 0.40 * 100.0, 0.0, 100.0))
        if current.load_percentage > 115.0 or current.oil_temp_c > 85.0:
            normalized_score = max(normalized_score, 85.0)
            is_anomaly = True

        # Calculate feature attribution based on z-score deviation
        deviations = np.abs((curr_vector[0] - means) / stds)
        total_dev = np.sum(deviations) + 1e-5
        weights = deviations / total_dev

        feature_names = [
            ("Load Percentage", f"{current.load_percentage}%", "30% - 90%", "High thermal/electrical stress from load demand"),
            ("Top Oil Temperature", f"{current.oil_temp_c}°C", "35°C - 75°C", "Accelerated paper insulation aging & gas formation"),
            ("Power Factor", f"{current.power_factor}", "0.90 - 0.98", "Excessive reactive VAR demand or harmonic distortion"),
            ("Voltage Deviation", f"{curr_v_dev:.2f}%", "< 5.0%", "Feeder impedance or upstream tap changer anomaly"),
            ("Delta Temperature Rise", f"{curr_delta_t:.1f}°C", "< 40°C rise", "Possible cooling pump/fan degradation or oil blockage")
        ]

        contributions: List[AnomalyContribution] = []
        for i, (name, val_str, exp_range, desc) in enumerate(feature_names):
            attr_score = float(round(weights[i], 3))
            contributions.append(AnomalyContribution(
                feature=name,
                observed_value=float(curr_vector[0][i]),
                expected_range=exp_range,
                attribution_score=attr_score,
                impact_description=desc
            ))

        # Sort highest contributing feature first
        contributions.sort(key=lambda c: c.attribution_score, reverse=True)

        # Determine severity
        if normalized_score >= 80.0:
            severity = AlertSeverity.CRITICAL
        elif normalized_score >= 60.0:
            severity = AlertSeverity.HIGH
        elif normalized_score >= 40.0:
            severity = AlertSeverity.WARNING
        else:
            severity = AlertSeverity.INFO

        top_feat = contributions[0].feature if contributions else "operating parameters"
        if is_anomaly:
            explanation = (
                f"Multivariate anomaly detected (Isolation Forest anomaly score: {normalized_score:.1f}/100). "
                f"Primary deviation driven by {top_feat}. Pattern departs significantly from historical baseline."
            )
            recommendations = [
                f"Review {top_feat} live telemetry and historical logs.",
                "Verify sensor calibration and PT/CT secondary wiring.",
                "Cross-examine secondary feeder load and substation ambient temperature.",
                "Inspect radiator cooling fans and oil level gauge."
            ]
        else:
            explanation = (
                f"Operating within nominal multivariate cluster (Score: {normalized_score:.1f}/100). "
                "No statistical pattern anomalies detected."
            )
            recommendations = [
                "Continue standard continuous automated telemetry monitoring.",
                "Maintain scheduled periodic dissolved gas inspection interval."
            ]

        return AnomalyDetectionResponse(
            transformer_id=transformer_id,
            timestamp=datetime.now(timezone.utc),
            is_anomaly=is_anomaly,
            anomaly_score=round(normalized_score, 1),
            severity=severity,
            contributing_features=contributions,
            heuristic_observation=explanation,
            recommended_checks=recommendations,
            is_simulated=True
        )

anomaly_engine = AnomalyDetectionEngine()
