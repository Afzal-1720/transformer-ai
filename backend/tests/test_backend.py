import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.services.simulator import simulator
from app.services.storage import storage
from app.services.ml_forecasting import forecasting_engine
from app.services.ml_anomaly import anomaly_engine
from app.services.risk_engine import risk_engine
from app.services.load_balancer import load_balancer
from app.models.load_balancing import LoadTransferRequest, ScenarioVerdict

@pytest.fixture(scope="session", autouse=True)
def setup_simulation():
    """Ensure simulation fleet and 48-hour history are initialized."""
    simulator.initialize_system()

def test_simulator_initialization():
    transformers = storage.get_transformers()
    assert len(transformers) >= 10
    
    # Check TX-101
    tx101 = storage.get_transformer("TX-101")
    assert tx101 is not None
    assert tx101.rated_capacity_kva == 2500.0
    
    # Check telemetry history exists
    history = storage.get_telemetry_history("TX-101", limit=100)
    assert len(history) >= 20
    
    # Check physics consistency
    latest = storage.get_latest_telemetry("TX-101")
    assert latest is not None
    assert latest.active_power_kw <= latest.apparent_power_kva
    assert 0.0 <= latest.power_factor <= 1.0
    assert latest.oil_temp_c > 0.0

def test_ml_forecasting_engine():
    forecast = forecasting_engine.forecast_load("TX-101")
    assert forecast.transformer_id == "TX-101"
    assert len(forecast.predictions_1h) == 4
    assert len(forecast.predictions_6h) == 12
    assert len(forecast.predictions_24h) == 24
    
    # Check holdout evaluation metrics
    assert forecast.metrics.mae_kw >= 0.0
    assert forecast.metrics.rmse_kw >= 0.0
    assert forecast.metrics.mape_pct >= 0.0
    assert forecast.metrics.holdout_samples > 0

def test_anomaly_detection_engine():
    result = anomaly_engine.detect_anomalies("TX-101")
    assert result.transformer_id == "TX-101"
    assert 0.0 <= result.anomaly_score <= 100.0
    assert len(result.contributing_features) > 0
    
    # Verify attribution weights sum approximately to 1
    total_attr = sum(c.attribution_score for c in result.contributing_features)
    assert 0.95 <= total_attr <= 1.05

def test_explainable_risk_engine():
    risk = risk_engine.assess_risk("TX-101")
    assert 0.0 <= risk.overall_risk_score <= 100.0
    assert risk.risk_level in ["LOW", "MEDIUM", "HIGH", "CRITICAL"]
    assert len(risk.breakdown) >= 4
    assert len(risk.actionable_recommendations) > 0

def test_load_balancer_feasible_transfer():
    # TX-101 has 2500 kVA, transfer 100 kVA to Central Substation TX-501 (5000 kVA capacity)
    req = LoadTransferRequest(
        source_id="TX-101",
        target_id="TX-501",
        transfer_kva=100.0,
        safety_margin_pct=95.0
    )
    resp = load_balancer.simulate_transfer(req)
    assert resp.source_id == "TX-101"
    assert resp.target_id == "TX-501"
    assert resp.source_post_load_kva < resp.source_pre_load_kva
    assert resp.target_post_load_kva > resp.target_pre_load_kva
    assert resp.verdict in [ScenarioVerdict.APPROVED, ScenarioVerdict.WARNING]

def test_load_balancer_overload_rejection():
    # Attempting to transfer 100,000 kVA should clearly exceed target capacity
    req = LoadTransferRequest(
        source_id="TX-101",
        target_id="TX-102",
        transfer_kva=100000.0,
        safety_margin_pct=85.0
    )
    resp = load_balancer.simulate_transfer(req)
    assert resp.feasible is False
    assert resp.verdict == ScenarioVerdict.REJECTED
    assert len(resp.safety_warnings) > 0

def test_api_endpoints():
    with TestClient(app) as client:
        # Health check
        res = client.get("/api/health")
        assert res.status_code == 200
        data = res.json()
        assert data["status"] == "healthy"
        assert data["active_transformers"] >= 10

        # Transformers list
        res = client.get("/api/transformers")
        assert res.status_code == 200
        units = res.json()
        assert len(units) >= 10
        assert "telemetry" in units[0]

        # Dashboard summary
        res = client.get("/api/dashboard/summary")
        assert res.status_code == 200
        summary = res.json()
        assert "kpis" in summary
        assert summary["kpis"]["total_transformers"] >= 10
        assert "zone_distribution" in summary
        assert "insights" in summary

        # Alerts list
        res = client.get("/api/alerts")
        assert res.status_code == 200

        # Forecasting API
        res = client.post("/api/predictions/forecast", json={"transformer_id": "TX-101"})
        assert res.status_code == 200
        forecast_data = res.json()
        assert len(forecast_data["predictions_24h"]) == 24

        # Anomaly detection API
        res = client.post("/api/anomalies/detect", json={"transformer_id": "TX-101"})
        assert res.status_code == 200
        assert "anomaly_score" in res.json()

        # Load balancing API
        res = client.post("/api/load-balancing/simulate", json={
            "source_id": "TX-101",
            "target_id": "TX-102",
            "transfer_kva": 150.0,
            "safety_margin_pct": 85.0
        })
        assert res.status_code == 200

        # Maintenance API
        res = client.get("/api/maintenance")
        assert res.status_code == 200
        maint_data = res.json()
        assert "asset_register" in maint_data
        assert "tasks" in maint_data

        # Create maintenance task
        res = client.post("/api/maintenance", json={
            "transformer_id": "TX-101",
            "title": "Bushing Oil Level Top-up",
            "description": "Replenish mineral oil in primary terminal housing.",
            "priority": "P3_MEDIUM",
            "assigned_technician": "Elena Rostova",
            "scheduled_date": "2026-11-15"
        })
        assert res.status_code == 200
        task_id = res.json()["id"]

        # Update maintenance task
        res = client.patch(f"/api/maintenance/{task_id}", json={
            "status": "COMPLETED",
            "notes": "Top-up completed with 12L inhibited mineral oil."
        })
        assert res.status_code == 200
        assert res.json()["status"] == "COMPLETED"
