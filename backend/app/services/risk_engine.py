from datetime import datetime, timezone
from typing import List, Tuple
from app.models.ai import ExplainableRiskResponse, RiskFactorBreakdown
from app.models.transformer import RiskLevel, HealthStatus, CommunicationStatus
from app.services.storage import storage

class ExplainableRiskEngine:
    def assess_risk(self, transformer_id: str) -> ExplainableRiskResponse:
        spec = storage.get_transformer(transformer_id)
        if not spec:
            raise ValueError(f"Transformer {transformer_id} not found")

        current = storage.get_latest_telemetry(transformer_id)
        history = storage.get_telemetry_history(transformer_id, limit=30)
        active_alerts_cnt = storage.get_active_alerts_count(transformer_id)

        now = datetime.now(timezone.utc)

        if not current:
            return ExplainableRiskResponse(
                transformer_id=transformer_id,
                timestamp=now,
                overall_risk_score=90.0,
                risk_level=RiskLevel.CRITICAL,
                breakdown=[
                    RiskFactorBreakdown(
                        factor_name="Telemetry Availability",
                        weight_pct=100.0,
                        raw_metric="NO TELEMETRY",
                        sub_score=90.0,
                        weighted_points=90.0,
                        status="CRITICAL",
                        explanation="Zero telemetry received. Grid visibility compromised."
                    )
                ],
                primary_risk_driver="Total Telemetry Loss",
                actionable_recommendations=["Dispatch field technician to verify substation RTU connectivity."],
                is_simulated=True
            )

        # 1. Thermal Stress (Weight: 35%)
        # Normal oil temp < 65°C: 0 pts; 65-75°C: 25 pts; 75-85°C: 60 pts; >85°C: 100 pts
        oil_t = current.oil_temp_c
        if oil_t < 65.0:
            thermal_sub = max(0.0, (oil_t - 40.0) / 25.0 * 20.0)
            thermal_status = "NORMAL"
        elif oil_t < 75.0:
            thermal_sub = 20.0 + (oil_t - 65.0) / 10.0 * 30.0
            thermal_status = "ELEVATED"
        elif oil_t < 85.0:
            thermal_sub = 50.0 + (oil_t - 75.0) / 10.0 * 35.0
            thermal_status = "HIGH"
        else:
            thermal_sub = min(100.0, 85.0 + (oil_t - 85.0) * 2.0)
            thermal_status = "CRITICAL"
        thermal_pts = thermal_sub * 0.35

        # 2. Overload & Duration (Weight: 30%)
        # Evaluate recent sustained overload
        recent_loads = [r.load_percentage for r in history[-6:]] if history else [current.load_percentage]
        avg_recent_load = sum(recent_loads) / len(recent_loads)
        curr_load = current.load_percentage

        if curr_load < 80.0:
            overload_sub = (curr_load / 80.0) * 15.0
            overload_status = "OPTIMAL"
        elif curr_load <= 100.0:
            overload_sub = 15.0 + ((curr_load - 80.0) / 20.0) * 35.0
            overload_status = "MODERATE"
        elif curr_load <= 115.0:
            overload_sub = 50.0 + ((curr_load - 100.0) / 15.0) * 35.0
            overload_status = "OVERLOAD"
        else:
            overload_sub = min(100.0, 85.0 + (curr_load - 115.0) * 1.5)
            overload_status = "SEVERE_OVERLOAD"
        
        # Duration multiplier if sustained
        if avg_recent_load > 100.0 and len(history) >= 3:
            overload_sub = min(100.0, overload_sub * 1.15)
        overload_pts = overload_sub * 0.30

        # 3. Voltage Deviation (Weight: 15%)
        nominal_v = spec.secondary_voltage_kv * 1000.0
        v_dev_pct = abs(current.voltage_v - nominal_v) / max(nominal_v, 1.0) * 100.0
        if v_dev_pct < 3.0:
            v_sub = (v_dev_pct / 3.0) * 15.0
            v_status = "STABLE"
        elif v_dev_pct < 6.0:
            v_sub = 15.0 + ((v_dev_pct - 3.0) / 3.0) * 40.0
            v_status = "DRIFT"
        else:
            v_sub = min(100.0, 55.0 + (v_dev_pct - 6.0) * 10.0)
            v_status = "UNACCEPTABLE"
        v_pts = v_sub * 0.15

        # 4. Active Alarms & Events (Weight: 10%)
        alarm_sub = min(100.0, active_alerts_cnt * 35.0)
        alarm_status = "CLEAN" if active_alerts_cnt == 0 else ("WARNING" if active_alerts_cnt == 1 else "CRITICAL")
        alarm_pts = alarm_sub * 0.10

        # 5. Telemetry & Sensor Integrity (Weight: 10%)
        if current.communication_status == CommunicationStatus.ONLINE:
            comm_sub = 0.0
            comm_status = "HEALTHY"
        elif current.communication_status == CommunicationStatus.STALE:
            comm_sub = 60.0
            comm_status = "STALE_DATA"
        else:
            comm_sub = 100.0
            comm_status = "OFFLINE"
        comm_pts = comm_sub * 0.10

        # Total Composite Risk Score (0 - 100)
        total_risk_score = round(thermal_pts + overload_pts + v_pts + alarm_pts + comm_pts, 1)

        # Categorize
        if total_risk_score >= 75.0 or current.communication_status == CommunicationStatus.OFFLINE or oil_t > 90.0:
            risk_level = RiskLevel.CRITICAL
        elif total_risk_score >= 50.0:
            risk_level = RiskLevel.HIGH
        elif total_risk_score >= 25.0:
            risk_level = RiskLevel.MEDIUM
        else:
            risk_level = RiskLevel.LOW

        breakdown = [
            RiskFactorBreakdown(
                factor_name="Thermal Stress",
                weight_pct=35.0,
                raw_metric=f"Top Oil: {oil_t:.1f}°C, Winding: {current.winding_temp_c:.1f}°C",
                sub_score=round(thermal_sub, 1),
                weighted_points=round(thermal_pts, 1),
                status=thermal_status,
                explanation="Measures dielectric oil and winding hotspot thermal dissipation margin."
            ),
            RiskFactorBreakdown(
                factor_name="Electrical Loading & Duration",
                weight_pct=30.0,
                raw_metric=f"Current: {curr_load:.1f}% (Recent Avg: {avg_recent_load:.1f}%)",
                sub_score=round(overload_sub, 1),
                weighted_points=round(overload_pts, 1),
                status=overload_status,
                explanation="Sustained electrical loading relative to design MVA/kVA thermal limit."
            ),
            RiskFactorBreakdown(
                factor_name="Voltage Stability",
                weight_pct=15.0,
                raw_metric=f"Deviation: {v_dev_pct:.2f}% ({current.voltage_v:.1f} V)",
                sub_score=round(v_sub, 1),
                weighted_points=round(v_pts, 1),
                status=v_status,
                explanation="Deviation from nominal rated secondary terminal voltage."
            ),
            RiskFactorBreakdown(
                factor_name="Alarm Events & History",
                weight_pct=10.0,
                raw_metric=f"{active_alerts_cnt} active alerts",
                sub_score=round(alarm_sub, 1),
                weighted_points=round(alarm_pts, 1),
                status=alarm_status,
                explanation="Active unresolved alarms requiring operator intervention."
            ),
            RiskFactorBreakdown(
                factor_name="Data Quality & Telemetry",
                weight_pct=10.0,
                raw_metric=f"Status: {current.communication_status.value}",
                sub_score=round(comm_sub, 1),
                weighted_points=round(comm_pts, 1),
                status=comm_status,
                explanation="Reliability and freshness of SCADA sensor packet feed."
            )
        ]

        # Primary driver
        sorted_factors = sorted(breakdown, key=lambda b: b.weighted_points, reverse=True)
        primary_driver = sorted_factors[0].factor_name if sorted_factors else "Nominal Operation"

        # Actionable recommendations
        recommendations = []
        if risk_level == RiskLevel.CRITICAL:
            recommendations.append("URGENT: Initiate load-transfer scenario to relieve downstream feeder stress.")
            recommendations.append("Verify forced-oil and forced-air cooling fan bank circuit breakers.")
            recommendations.append("Alert shift grid supervisor and prepare field crew for on-site inspection.")
        elif risk_level == RiskLevel.HIGH:
            recommendations.append("Review automated load-transfer candidates in the Load Balancing module.")
            recommendations.append("Monitor oil temperature trend for rapid rate-of-rise exceeding 4°C/hr.")
            recommendations.append("Schedule priority infrared thermography inspection within 48 hours.")
        elif risk_level == RiskLevel.MEDIUM:
            recommendations.append("Maintain standard SCADA supervision; watch peak hour load projections.")
            recommendations.append("Verify transformer tap changer position during peak transition.")
        else:
            recommendations.append("Asset operating within healthy design tolerances.")
            recommendations.append("Maintain routine preventive inspection schedule.")

        return ExplainableRiskResponse(
            transformer_id=transformer_id,
            timestamp=now,
            overall_risk_score=total_risk_score,
            risk_level=risk_level,
            breakdown=breakdown,
            primary_risk_driver=primary_driver,
            actionable_recommendations=recommendations,
            disclaimer="Academic demo prototype. Heuristic & statistical model only; not certified for physical grid operations.",
            is_simulated=True
        )

    def calculate_health_score(self, transformer_id: str) -> Tuple[float, HealthStatus, RiskLevel, float]:
        """Calculates 0-100 asset health score and returns (health_score, status, risk_level, risk_score)."""
        risk_resp = self.assess_risk(transformer_id)
        # Health score is inverse of operational and aging stress
        spec = storage.get_transformer(transformer_id)
        age = (datetime.now().year - spec.installation_year) if spec else 5
        age_penalty = min(15.0, age * 1.5)
        
        health_score = max(5.0, min(100.0, 100.0 - (risk_resp.overall_risk_score * 0.75 + age_penalty)))
        
        if health_score >= 80.0:
            status = HealthStatus.HEALTHY
        elif health_score >= 50.0:
            status = HealthStatus.WARNING
        else:
            status = HealthStatus.CRITICAL

        if risk_resp.overall_risk_score >= 70.0:
            status = HealthStatus.CRITICAL

        return round(health_score, 1), status, risk_resp.risk_level, risk_resp.overall_risk_score

risk_engine = ExplainableRiskEngine()
