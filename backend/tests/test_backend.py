import pytest
from datetime import datetime, timezone
from fastapi.testclient import TestClient
from app.main import app
from app.config import settings
from app.services.simulator import simulator
from app.services.storage import storage
from app.services.condition_evaluator import condition_evaluator
from app.models.transformer import TransformerSpec, TelemetryReading, OverallCondition
from app.models.condition import (
    SensorConnectivity, VoltageBehaviour, LoadingCondition, ThermalCondition
)
from app.models.anomaly import AnomalyType, AnomalySeverity
from app.models.inspection import InspectionStatus, InspectionPriority

@pytest.fixture(scope="session", autouse=True)
def setup_simulation():
    """Initialize fleet and baseline telemetry."""
    simulator.initialize_system()

def test_voltage_deviation_calculations():
    """Verify voltage deviation percentage formula and dual independent checks."""
    rated_v = 240.0

    # 1. Normal voltage (within -10% and +6%, and between 216V and 254V)
    dev_pct, dev_status, supply_status = condition_evaluator.calculate_voltage_deviation(238.0, rated_v)
    assert dev_pct == pytest.approx(-0.83, 0.01)
    assert "Within Permissible Deviation" in dev_status
    assert "Normal Permissible Range" in supply_status

    # 2. Under-voltage deviation (< -10% and < 216V)
    dev_pct, dev_status, supply_status = condition_evaluator.calculate_voltage_deviation(210.0, rated_v)
    assert dev_pct == pytest.approx(-12.5, 0.01)
    assert "Under-Voltage Deviation" in dev_status
    assert "Under-Voltage Warning" in supply_status

    # 3. Over-voltage deviation (> +6% and > 254V)
    dev_pct, dev_status, supply_status = condition_evaluator.calculate_voltage_deviation(258.0, rated_v)
    assert dev_pct == pytest.approx(7.5, 0.01)
    assert "Over-Voltage Deviation" in dev_status
    assert "Over-Voltage Warning" in supply_status

    # 4. Verify rated deviation and absolute supply checks are independent
    # e.g. rated 230V, measured 218V: dev = -5.2% (within -10% to +6%), but supply is in range 216V-254V
    dev_pct_230, dev_stat_230, sup_stat_230 = condition_evaluator.calculate_voltage_deviation(218.0, 230.0)
    assert "Within Permissible Deviation" in dev_stat_230
    assert "Normal Permissible Range" in sup_stat_230

def test_current_deviation_and_loading_calculations():
    """Verify current deviation percentage and loading condition."""
    rated_i = 100.0

    # 1. Normal current
    dev_pct, cond = condition_evaluator.calculate_current_deviation(85.0, rated_i)
    assert dev_pct == -15.0
    assert cond == "Normal"

    # 2. Over-current (exceeding configurable +10% limit)
    dev_pct, cond = condition_evaluator.calculate_current_deviation(115.0, rated_i)
    assert dev_pct == 15.0
    assert "Over Current" in cond

    # 3. Loading percentage calculations
    # Normal: <80%
    loading_pct, l_cond = condition_evaluator.calculate_loading(75.0, rated_i)
    assert loading_pct == 75.0
    assert l_cond == LoadingCondition.NORMAL

    # High: 80% to 100%
    loading_pct, l_cond = condition_evaluator.calculate_loading(92.0, rated_i)
    assert loading_pct == 92.0
    assert l_cond == LoadingCondition.HIGH

    # Overloaded: > 100%
    loading_pct, l_cond = condition_evaluator.calculate_loading(125.0, rated_i)
    assert loading_pct == 125.0
    assert l_cond == LoadingCondition.OVERLOADED

def test_temperature_and_moisture_representation():
    """Verify winding hotspot temperature and that top oil/average winding are not exposed."""
    spec = storage.get_transformer("TX-001")
    assert spec is not None
    telemetry = storage.get_latest_telemetry("TX-001")
    assert telemetry is not None
    
    # Check winding hotspot temperature field
    assert hasattr(telemetry, "winding_hotspot_temperature")
    assert telemetry.winding_hotspot_temperature > 0.0

    # Verify top oil temperature and average winding temperature are NOT exposed in TelemetryReading
    assert not hasattr(telemetry, "top_oil_temperature")
    assert not hasattr(telemetry, "average_winding_temperature")
    assert not hasattr(telemetry, "oil_temp_c")

    # Check moisture
    assert hasattr(telemetry, "moisture")
    assert telemetry.moisture >= 0.0

def test_required_anomaly_types():
    """Verify detection of the required anomaly conditions and phase imbalance status."""
    spec = TransformerSpec(
        id="TEST-TX",
        name="Test Substation",
        substation="Test Substation Zone",
        rated_vrms=240.0,
        rated_irms=100.0,
        rated_kva=24.0
    )

    now = datetime.now(timezone.utc)

    # 1. Over-Voltage Anomaly Test
    reading_ov = TelemetryReading(
        transformer_id="TEST-TX",
        timestamp=now,
        vrms=258.0, # > 254V
        irms=80.0,
        winding_hotspot_temperature=70.0,
        moisture=15.0,
        sensor_status="ONLINE"
    )
    anomalies_ov = condition_evaluator.detect_anomalies(spec, reading_ov, [])
    assert any(a.anomaly_type == AnomalyType.OVER_VOLTAGE for a in anomalies_ov)
    ov = next(a for a in anomalies_ov if a.anomaly_type == AnomalyType.OVER_VOLTAGE)
    assert ov.recommended_action == "Check incoming supply and voltage regulation"

    # 2. Under-Voltage Anomaly Test
    reading_uv = TelemetryReading(
        transformer_id="TEST-TX",
        timestamp=now,
        vrms=208.0, # < 216V
        irms=80.0,
        winding_hotspot_temperature=70.0,
        moisture=15.0,
        sensor_status="ONLINE"
    )
    anomalies_uv = condition_evaluator.detect_anomalies(spec, reading_uv, [])
    assert any(a.anomaly_type == AnomalyType.UNDER_VOLTAGE for a in anomalies_uv)
    uv = next(a for a in anomalies_uv if a.anomaly_type == AnomalyType.UNDER_VOLTAGE)
    assert uv.recommended_action == "Check incoming supply and connected load"

    # 3. Over-Current Anomaly Test
    reading_oc = TelemetryReading(
        transformer_id="TEST-TX",
        timestamp=now,
        vrms=238.0,
        irms=125.0, # > 110A (+10% limit)
        winding_hotspot_temperature=72.0,
        moisture=15.0,
        sensor_status="ONLINE"
    )
    anomalies_oc = condition_evaluator.detect_anomalies(spec, reading_oc, [])
    assert any(a.anomaly_type == AnomalyType.OVER_CURRENT for a in anomalies_oc)

    # 4. Overheating Anomaly Test (based on winding hotspot temperature)
    reading_hot = TelemetryReading(
        transformer_id="TEST-TX",
        timestamp=now,
        vrms=238.0,
        irms=80.0,
        winding_hotspot_temperature=102.0, # > 95°C overheating
        moisture=15.0,
        sensor_status="ONLINE"
    )
    anomalies_hot = condition_evaluator.detect_anomalies(spec, reading_hot, [])
    assert any(a.anomaly_type == AnomalyType.OVERHEATING for a in anomalies_hot)
    hot = next(a for a in anomalies_hot if a.anomaly_type == AnomalyType.OVERHEATING)
    assert hot.recommended_action == "Inspect cooling arrangements and transformer thermal condition"

    # 5. Sudden Load Variation Test
    baseline_history = [
        TelemetryReading(
            transformer_id="TEST-TX",
            timestamp=now,
            vrms=240.0,
            irms=60.0,
            winding_hotspot_temperature=65.0,
            moisture=15.0,
            sensor_status="ONLINE"
        ) for _ in range(5)
    ]
    # Current steps from 60A to 95A (+58% shift)
    reading_sudden = TelemetryReading(
        transformer_id="TEST-TX",
        timestamp=now,
        vrms=240.0,
        irms=95.0,
        winding_hotspot_temperature=68.0,
        moisture=15.0,
        sensor_status="ONLINE"
    )
    anomalies_sudden = condition_evaluator.detect_anomalies(spec, reading_sudden, baseline_history)
    assert any(a.anomaly_type == AnomalyType.SUDDEN_LOAD_VARIATION for a in anomalies_sudden)
    var = next(a for a in anomalies_sudden if a.anomaly_type == AnomalyType.SUDDEN_LOAD_VARIATION)
    assert var.percentage_change is not None
    assert var.percentage_change > 25.0
    assert var.recommended_action == "Inspect connected load and feeder conditions"

    # 6. Verify Phase Imbalance is disabled
    assert settings.PHASE_IMBALANCE_ENABLED is False

def test_condition_assessment_and_inspections():
    """Verify separate condition evaluations and inspection recommendation status."""
    spec = storage.get_transformer("TX-001")
    telemetry = storage.get_latest_telemetry("TX-001")
    history = storage.get_telemetry_history("TX-001", limit=10)

    report = condition_evaluator.evaluate_condition_report(spec, telemetry, history)
    assert report.transformer_id == "TX-001"
    assert report.overall_condition in [OverallCondition.HEALTHY, OverallCondition.WARNING, OverallCondition.CRITICAL, OverallCondition.INSPECTION_REQUIRED]
    assert report.sensor_connectivity in [SensorConnectivity.ONLINE, SensorConnectivity.OFFLINE, SensorConnectivity.CONNECTION_LOST]
    assert report.voltage_behaviour in [VoltageBehaviour.STABLE, VoltageBehaviour.FLUCTUATING, VoltageBehaviour.UNDER_VOLTAGE, VoltageBehaviour.OVER_VOLTAGE]
    assert report.loading_condition in [LoadingCondition.NORMAL, LoadingCondition.HIGH, LoadingCondition.OVERLOADED]
    assert report.thermal_condition in [ThermalCondition.NORMAL, ThermalCondition.ELEVATED, ThermalCondition.OVERHEATING]
    assert len(report.condition_explanation) > 0
    assert len(report.recommended_action) > 0

def test_rest_api_endpoints():
    """Verify all REST API endpoints for monitoring, anomalies, dashboard, and inspections."""
    with TestClient(app) as client:
        # 1. Health check
        res = client.get("/api/health")
        assert res.status_code == 200
        assert res.json()["status"] == "healthy"

        # 2. List transformers
        res = client.get("/api/transformers")
        assert res.status_code == 200
        fleet = res.json()
        assert len(fleet) == 1
        assert fleet[0]["spec"]["name"] == "Transformer_1"
        assert "voltage_deviation_pct" in fleet[0]
        assert "current_deviation_pct" in fleet[0]
        assert "loading_pct" in fleet[0]
        assert "supply_voltage_status" in fleet[0]

        # 3. Single transformer detail
        res = client.get("/api/transformers/TX-001")
        assert res.status_code == 200
        assert res.json()["spec"]["id"] == "TX-001"

        # 4. Telemetry history
        res = client.get("/api/transformers/TX-001/telemetry?limit=20")
        assert res.status_code == 200
        assert len(res.json()) >= 10

        # 5. Transformer condition report
        res = client.get("/api/transformers/TX-001/condition")
        assert res.status_code == 200
        assert "overall_condition" in res.json()
        assert "sensor_connectivity" in res.json()
        assert "voltage_behaviour" in res.json()

        # 6. Transformer anomalies
        res = client.get("/api/transformers/TX-001/anomalies")
        assert res.status_code == 200
        assert "anomalies" in res.json()
        assert "phase_imbalance_status" in res.json()

        # 7. Dashboard summary
        res = client.get("/api/dashboard/summary")
        assert res.status_code == 200
        summary = res.json()
        assert "kpis" in summary
        assert summary["kpis"]["total_transformers"] == 1
        assert "transformer_summaries" in summary
        assert [transformer["id"] for transformer in summary["transformer_summaries"]] == ["TX-001"]

        # 8. Alerts
        res = client.get("/api/alerts")
        assert res.status_code == 200

        # 9. Inspections list
        res = client.get("/api/maintenance/inspections")
        assert res.status_code == 200
        inspections = res.json()
        assert len(inspections) >= 1

        # 10. Create manual inspection
        res = client.post("/api/maintenance/inspections", json={
            "transformer_id": "TX-001",
            "reason": "Test inspection request for thermal check",
            "priority": "High",
            "recommended_action": "Inspect cooling arrangements and transformer thermal condition"
        })
        assert res.status_code == 200
        created_id = res.json()["id"]

        # 11. Update inspection to Acknowledged
        res = client.patch(f"/api/maintenance/inspections/{created_id}", json={
            "status": "Acknowledged",
            "notes": "Assigned to Lead Technician Alpha"
        })
        assert res.status_code == 200
        assert res.json()["status"] == "Acknowledged"

        # 12. Update inspection to Completed
        res = client.patch(f"/api/maintenance/inspections/{created_id}", json={
            "status": "Completed",
            "notes": "Inspection completed successfully."
        })
        assert res.status_code == 200
        assert res.json()["status"] == "Completed"
