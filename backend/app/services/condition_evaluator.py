import math
import numpy as np
from datetime import datetime, timezone
from typing import List, Tuple, Optional
from app.config import settings
from app.models.transformer import (
    TransformerSpec, TelemetryReading, TransformerDetail, OverallCondition, SensorStatus
)
from app.models.condition import (
    SensorConnectivity, VoltageBehaviour, LoadingCondition, ThermalCondition, TransformerConditionReport
)
from app.models.anomaly import DetectedAnomaly, AnomalyType, AnomalySeverity

class ConditionEvaluator:
    """
    Core electrical power systems evaluation service for transformer condition assessment,
    anomaly detection, and operator recommendation generation.
    """

    @staticmethod
    def calculate_voltage_deviation(measured_v: float, rated_v: float) -> Tuple[float, str, str]:
        """
        Calculates:
        1. Voltage Deviation (%) = ((Measured Voltage - Rated Voltage) / Rated Voltage) * 100
        2. Deviation Assessment:
           - -10% to +6%: Within permissible deviation
           - Below -10%: Under-voltage deviation alert
           - Above +6%: Over-voltage deviation alert
        3. Statutory Supply Voltage Assessment (Independent Check):
           - 216 V to 254 V: Normal permissible supply range
           - Above 254 V: Over-voltage warning
           - Below 216 V: Under-voltage warning
        """
        if rated_v <= 0:
            rated_v = 240.0
            
        dev_pct = round(((measured_v - rated_v) / rated_v) * 100.0, 2)

        # Check 1: Rated Voltage Deviation Assessment (-10% to +6%)
        if dev_pct < settings.VOLTAGE_DEV_MIN_PCT:
            dev_status = "Under-Voltage Deviation (< -10%)"
        elif dev_pct > settings.VOLTAGE_DEV_MAX_PCT:
            dev_status = "Over-Voltage Deviation (> +6%)"
        else:
            dev_status = "Within Permissible Deviation (-10% to +6%)"

        # Check 2: Absolute Statutory Supply Voltage Range (216V to 254V)
        if measured_v < settings.SUPPLY_VOLTAGE_MIN:
            supply_status = f"Under-Voltage Warning (<{settings.SUPPLY_VOLTAGE_MIN}V)"
        elif measured_v > settings.SUPPLY_VOLTAGE_MAX:
            supply_status = f"Over-Voltage Warning (>{settings.SUPPLY_VOLTAGE_MAX}V)"
        else:
            supply_status = f"Normal Permissible Range ({settings.SUPPLY_VOLTAGE_MIN}V - {settings.SUPPLY_VOLTAGE_MAX}V)"

        return dev_pct, dev_status, supply_status

    @staticmethod
    def calculate_current_deviation(measured_i: float, rated_i: float) -> Tuple[float, str]:
        """
        Calculates:
        Current Deviation (%) = ((Measured Current - Rated Current) / Rated Current) * 100
        Checked against configurable backend threshold (default +10.0% above rated Arms).
        """
        if rated_i <= 0:
            rated_i = 100.0
            
        dev_pct = round(((measured_i - rated_i) / rated_i) * 100.0, 2)
        if dev_pct > settings.CURRENT_DEV_MAX_PCT:
            cond = f"Over Current (>+{settings.CURRENT_DEV_MAX_PCT}% limit)"
        else:
            cond = "Normal"
        return dev_pct, cond

    @staticmethod
    def calculate_loading(measured_i: float, rated_i: float) -> Tuple[float, LoadingCondition]:
        """
        Loading (%) = (Measured Current / Rated Current) * 100
        Evaluated against configurable loading thresholds:
        - Normal: < 80%
        - High: 80% to 100%
        - Overloaded: > 100%
        """
        if rated_i <= 0:
            rated_i = 100.0
            
        loading_pct = round((measured_i / rated_i) * 100.0, 1)
        if loading_pct > settings.LOADING_OVERLOAD_PCT:
            cond = LoadingCondition.OVERLOADED
        elif loading_pct >= settings.LOADING_HIGH_PCT:
            cond = LoadingCondition.HIGH
        else:
            cond = LoadingCondition.NORMAL
        return loading_pct, cond

    @staticmethod
    def evaluate_thermal_condition(hotspot_temp_c: float) -> ThermalCondition:
        """
        Evaluates winding hotspot temperature against configurable thresholds:
        - Normal: < 80°C
        - Elevated: 80°C to 95°C
        - Overheating: > 95°C
        """
        if hotspot_temp_c > settings.HOTSPOT_TEMP_ELEVATED_MAX_C:
            return ThermalCondition.OVERHEATING
        elif hotspot_temp_c >= settings.HOTSPOT_TEMP_NORMAL_MAX_C:
            return ThermalCondition.ELEVATED
        return ThermalCondition.NORMAL

    @staticmethod
    def evaluate_voltage_behaviour(measured_v: float, recent_voltages: List[float]) -> VoltageBehaviour:
        """
        Evaluates voltage behaviour: Under Voltage, Over Voltage, Fluctuating, or Stable.
        """
        if measured_v < settings.SUPPLY_VOLTAGE_MIN:
            return VoltageBehaviour.UNDER_VOLTAGE
        elif measured_v > settings.SUPPLY_VOLTAGE_MAX:
            return VoltageBehaviour.OVER_VOLTAGE

        if len(recent_voltages) >= 4:
            std = float(np.std(recent_voltages[-6:]))
            if std > 3.0:
                return VoltageBehaviour.FLUCTUATING

        return VoltageBehaviour.STABLE

    @classmethod
    def detect_anomalies(
        cls,
        spec: TransformerSpec,
        reading: TelemetryReading,
        recent_readings: List[TelemetryReading]
    ) -> List[DetectedAnomaly]:
        """
        Evaluates all required anomaly conditions:
        1. Over-voltage
        2. Under-voltage
        3. Over-current
        4. Overheating (based on winding hotspot temperature)
        5. Sudden load variation (unexpected increase/decrease in current)
        6. Phase imbalance (Optional: disabled placeholder)
        """
        anomalies: List[DetectedAnomaly] = []
        now = reading.timestamp or datetime.now(timezone.utc)
        tx_id = spec.id

        # 0. Check Sensor Status
        if reading.sensor_status in ["OFFLINE", "CONNECTION_LOST"]:
            anomalies.append(DetectedAnomaly(
                id=f"ANM-COMM-{tx_id}",
                transformer_id=tx_id,
                anomaly_name="Sensor Connection Lost",
                anomaly_type=AnomalyType.SENSOR_CONNECTIVITY,
                severity=AnomalySeverity.CRITICAL,
                detected_parameter="Sensor Telemetry Feed",
                measured_value=reading.sensor_status,
                applicable_threshold="ONLINE Required",
                detection_time=now,
                recommended_action="Check sensor connections and communication",
                is_mock_data=True
            ))
            return anomalies

        v_dev_pct, v_dev_status, supply_status = cls.calculate_voltage_deviation(reading.vrms, spec.rated_vrms)
        c_dev_pct, c_dev_status = cls.calculate_current_deviation(reading.irms, spec.rated_irms)
        loading_pct, loading_cond = cls.calculate_loading(reading.irms, spec.rated_irms)
        thermal_cond = cls.evaluate_thermal_condition(reading.winding_hotspot_temperature)

        # 1. Over-Voltage Anomaly
        if reading.vrms > settings.SUPPLY_VOLTAGE_MAX or v_dev_pct > settings.VOLTAGE_DEV_MAX_PCT:
            sev = AnomalySeverity.CRITICAL if reading.vrms > 260.0 else AnomalySeverity.WARNING
            anomalies.append(DetectedAnomaly(
                id=f"ANM-OV-{tx_id}",
                transformer_id=tx_id,
                anomaly_name="Over-Voltage Condition",
                anomaly_type=AnomalyType.OVER_VOLTAGE,
                severity=sev,
                detected_parameter="Output Voltage (Vrms)",
                measured_value=f"{reading.vrms:.1f} Vrms ({v_dev_pct:+.1f}%)",
                applicable_threshold=f"Max Permissible: {settings.SUPPLY_VOLTAGE_MAX} V (+{settings.VOLTAGE_DEV_MAX_PCT}%)",
                percentage_change=v_dev_pct,
                detection_time=now,
                recommended_action="Check incoming supply and voltage regulation",
                is_mock_data=True
            ))

        # 2. Under-Voltage Anomaly
        elif reading.vrms < settings.SUPPLY_VOLTAGE_MIN or v_dev_pct < settings.VOLTAGE_DEV_MIN_PCT:
            sev = AnomalySeverity.CRITICAL if reading.vrms < 200.0 else AnomalySeverity.WARNING
            anomalies.append(DetectedAnomaly(
                id=f"ANM-UV-{tx_id}",
                transformer_id=tx_id,
                anomaly_name="Under-Voltage Condition",
                anomaly_type=AnomalyType.UNDER_VOLTAGE,
                severity=sev,
                detected_parameter="Output Voltage (Vrms)",
                measured_value=f"{reading.vrms:.1f} Vrms ({v_dev_pct:+.1f}%)",
                applicable_threshold=f"Min Permissible: {settings.SUPPLY_VOLTAGE_MIN} V ({settings.VOLTAGE_DEV_MIN_PCT}%)",
                percentage_change=v_dev_pct,
                detection_time=now,
                recommended_action="Check incoming supply and connected load",
                is_mock_data=True
            ))

        # 3. Over-Current Anomaly
        if c_dev_pct > settings.CURRENT_DEV_MAX_PCT:
            sev = AnomalySeverity.CRITICAL if loading_pct >= 115.0 else AnomalySeverity.WARNING
            action = (
                "Immediate attention; inspect connected load and loading pattern"
                if thermal_cond != ThermalCondition.NORMAL
                else "Check the connected load"
            )
            anomalies.append(DetectedAnomaly(
                id=f"ANM-OC-{tx_id}",
                transformer_id=tx_id,
                anomaly_name="Over-Current / Overload Condition",
                anomaly_type=AnomalyType.OVER_CURRENT,
                severity=sev,
                detected_parameter="Output Current (Arms)",
                measured_value=f"{reading.irms:.1f} Arms ({c_dev_pct:+.1f}% deviation, {loading_pct:.1f}% load)",
                applicable_threshold=f"Rated: {spec.rated_irms:.1f} Arms (Limit: +{settings.CURRENT_DEV_MAX_PCT}%)",
                percentage_change=c_dev_pct,
                detection_time=now,
                recommended_action=action,
                is_mock_data=True
            ))

        # 4. Overheating Anomaly (Based on Winding Hotspot Temperature)
        if thermal_cond == ThermalCondition.OVERHEATING or reading.winding_hotspot_temperature > settings.HOTSPOT_TEMP_NORMAL_MAX_C:
            sev = AnomalySeverity.CRITICAL if reading.winding_hotspot_temperature >= settings.HOTSPOT_TEMP_CRITICAL_C else AnomalySeverity.WARNING
            anomalies.append(DetectedAnomaly(
                id=f"ANM-THERM-{tx_id}",
                transformer_id=tx_id,
                anomaly_name="Winding Overheating Detected",
                anomaly_type=AnomalyType.OVERHEATING,
                severity=sev,
                detected_parameter="Winding Hotspot Temperature",
                measured_value=f"{reading.winding_hotspot_temperature:.1f} °C",
                applicable_threshold=f"Normal Limit: <{settings.HOTSPOT_TEMP_NORMAL_MAX_C}°C (Elevated: {settings.HOTSPOT_TEMP_ELEVATED_MAX_C}°C)",
                detection_time=now,
                recommended_action="Inspect cooling arrangements and transformer thermal condition",
                is_mock_data=True
            ))

        # 5. Sudden Load Variation Anomaly
        # Compare latest current reading with rolling baseline of recent readings (past 3-6 readings)
        if len(recent_readings) >= 2:
            prev_currents = [r.irms for r in recent_readings[-6:-1]]
            if prev_currents:
                baseline_i = float(np.mean(prev_currents))
                if baseline_i > 2.0:
                    delta_pct = round(((reading.irms - baseline_i) / baseline_i) * 100.0, 1)
                    if abs(delta_pct) >= settings.SUDDEN_CURRENT_VARIATION_PCT:
                        direction = "Surge Increase" if delta_pct > 0 else "Sudden Drop"
                        anomalies.append(DetectedAnomaly(
                            id=f"ANM-VAR-{tx_id}",
                            transformer_id=tx_id,
                            anomaly_name=f"Sudden Load Variation ({direction})",
                            anomaly_type=AnomalyType.SUDDEN_LOAD_VARIATION,
                            severity=AnomalySeverity.WARNING,
                            detected_parameter="Output Current Variation",
                            measured_value=f"{reading.irms:.1f} Arms (Baseline: {baseline_i:.1f} Arms)",
                            applicable_threshold=f"Max Allowed Step Variation: ±{settings.SUDDEN_CURRENT_VARIATION_PCT}%",
                            percentage_change=delta_pct,
                            detection_time=now,
                            recommended_action="Inspect connected load and feeder conditions",
                            is_mock_data=True
                        ))

        # 6. Optional: Phase Imbalance
        # Kept disabled as per requirements: Single-phase RMS telemetry does not fabricate 3-phase readings.

        return anomalies

    @classmethod
    def evaluate_condition_report(
        cls,
        spec: TransformerSpec,
        reading: TelemetryReading,
        recent_readings: List[TelemetryReading]
    ) -> TransformerConditionReport:
        """
        Creates a comprehensive condition assessment report for the selected transformer.
        Derives Overall Condition (Healthy / Warning / Critical / Inspection Required)
        from actual operating parameters and active anomalies.
        """
        now = reading.timestamp or datetime.now(timezone.utc)
        v_dev_pct, v_dev_status, supply_status = cls.calculate_voltage_deviation(reading.vrms, spec.rated_vrms)
        c_dev_pct, c_dev_status = cls.calculate_current_deviation(reading.irms, spec.rated_irms)
        loading_pct, loading_cond = cls.calculate_loading(reading.irms, spec.rated_irms)
        thermal_cond = cls.evaluate_thermal_condition(reading.winding_hotspot_temperature)
        
        recent_v = [r.vrms for r in recent_readings[-10:]]
        v_behaviour = cls.evaluate_voltage_behaviour(reading.vrms, recent_v)

        # Connectivity
        if reading.sensor_status == "ONLINE":
            connectivity = SensorConnectivity.ONLINE
        elif reading.sensor_status == "OFFLINE":
            connectivity = SensorConnectivity.OFFLINE
        else:
            connectivity = SensorConnectivity.CONNECTION_LOST

        anomalies = cls.detect_anomalies(spec, reading, recent_readings)
        has_critical = any(a.severity == AnomalySeverity.CRITICAL for a in anomalies)
        has_warning = any(a.severity == AnomalySeverity.WARNING for a in anomalies)

        # Derive Overall Condition
        if connectivity != SensorConnectivity.ONLINE:
            overall = OverallCondition.CRITICAL
            explanation = "Sensor telemetry offline or connection lost. Live condition visibility interrupted; field inspection required."
            action = "Check sensor connections and communication"
            inspection_req = True
        elif has_critical:
            overall = OverallCondition.CRITICAL
            top_crit = next(a for a in anomalies if a.severity == AnomalySeverity.CRITICAL)
            explanation = f"Critical operating condition detected: {top_crit.anomaly_name} ({top_crit.measured_value}). Exceeds emergency threshold."
            action = top_crit.recommended_action
            inspection_req = True
        elif has_warning:
            if any(a.anomaly_type in [AnomalyType.SUDDEN_LOAD_VARIATION, AnomalyType.OVERHEATING] for a in anomalies):
                overall = OverallCondition.INSPECTION_REQUIRED
                inspection_req = True
            else:
                overall = OverallCondition.WARNING
                inspection_req = False
            top_warn = next(a for a in anomalies if a.severity == AnomalySeverity.WARNING)
            explanation = f"Abnormal condition detected: {top_warn.anomaly_name} ({top_warn.measured_value}). {top_warn.applicable_threshold}."
            action = top_warn.recommended_action
        elif v_behaviour == VoltageBehaviour.FLUCTUATING:
            overall = OverallCondition.INSPECTION_REQUIRED
            explanation = "Abnormal voltage fluctuations observed over recent sample cycles. Inspection recommended to verify tap changer / supply stability."
            action = "Check incoming supply and voltage regulation"
            inspection_req = True
        else:
            overall = OverallCondition.HEALTHY
            explanation = "All electrical output parameters, winding hotspot temperature, and moisture levels are within permissible design bounds."
            action = "Routine automated telemetry monitoring active"
            inspection_req = False

        return TransformerConditionReport(
            transformer_id=spec.id,
            timestamp=now,
            sensor_connectivity=connectivity,
            voltage_behaviour=v_behaviour,
            loading_condition=loading_cond,
            thermal_condition=thermal_cond,
            overall_condition=overall,
            condition_explanation=explanation,
            recommended_action=action,
            inspection_required=inspection_req,
            vrms_measured=reading.vrms,
            vrms_rated=spec.rated_vrms,
            voltage_deviation_pct=v_dev_pct,
            irms_measured=reading.irms,
            irms_rated=spec.rated_irms,
            current_deviation_pct=c_dev_pct,
            loading_pct=loading_pct,
            winding_hotspot_temperature=reading.winding_hotspot_temperature,
            moisture=reading.moisture,
            is_mock_data=True
        )

    @classmethod
    def create_transformer_detail(
        cls,
        spec: TransformerSpec,
        reading: TelemetryReading,
        recent_readings: List[TelemetryReading],
        active_anomalies_count: int = 0
    ) -> TransformerDetail:
        """
        Builds the complete TransformerDetail object for dashboard and fleet lists.
        """
        report = cls.evaluate_condition_report(spec, reading, recent_readings)
        v_dev_pct, v_dev_status, supply_status = cls.calculate_voltage_deviation(reading.vrms, spec.rated_vrms)
        c_dev_pct, c_dev_status = cls.calculate_current_deviation(reading.irms, spec.rated_irms)

        return TransformerDetail(
            spec=spec,
            telemetry=reading,
            voltage_deviation_pct=v_dev_pct,
            voltage_deviation_status=v_dev_status,
            supply_voltage_status=supply_status,
            current_deviation_pct=c_dev_pct,
            current_condition=c_dev_status,
            loading_pct=report.loading_pct,
            loading_condition=report.loading_condition.value,
            thermal_condition=report.thermal_condition.value,
            voltage_behaviour=report.voltage_behaviour.value,
            overall_condition=report.overall_condition,
            condition_explanation=report.condition_explanation,
            recommended_action=report.recommended_action,
            inspection_required=report.inspection_required,
            active_anomalies_count=active_anomalies_count,
            is_mock_data=True
        )

condition_evaluator = ConditionEvaluator()
