from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from app.models.anomaly import AnomalySummary
from app.services.storage import storage
from app.services.condition_evaluator import condition_evaluator

router = APIRouter(prefix="/anomalies", tags=["Anomalies"])

class AnomalyDetectPayload(BaseModel):
    transformer_id: str

class AnomalyInjectPayload(BaseModel):
    transformer_id: str
    anomaly_type: str = Field(..., description="over_voltage | under_voltage | over_current | overheating | sudden_load_variation | sensor_freeze | offline")
    severity: str = "HIGH"
    duration_sec: int = 120

class AnomalyClearPayload(BaseModel):
    transformer_id: str

@router.post("/detect", response_model=AnomalySummary)
def detect_anomalies(payload: AnomalyDetectPayload):
    spec = storage.get_transformer(payload.transformer_id)
    if not spec:
        raise HTTPException(status_code=404, detail=f"Transformer {payload.transformer_id} not found")

    telemetry = storage.get_latest_telemetry(payload.transformer_id)
    if not telemetry:
        raise HTTPException(status_code=404, detail=f"No telemetry found for transformer {payload.transformer_id}")

    history = storage.get_telemetry_history(payload.transformer_id, limit=10)
    anomalies = condition_evaluator.detect_anomalies(spec, telemetry, history)
    report = condition_evaluator.evaluate_condition_report(spec, telemetry, history)

    return AnomalySummary(
        transformer_id=payload.transformer_id,
        timestamp=telemetry.timestamp,
        overall_condition=report.overall_condition.value,
        anomalies=anomalies,
        total_anomalies=len(anomalies),
        has_critical=any(a.severity.value == "Critical" for a in anomalies),
        has_warning=any(a.severity.value == "Warning" for a in anomalies),
        phase_imbalance_status="Disabled: Single-phase RMS hardware telemetry only. Phase-level data is not fabricated.",
        is_mock_data=True
    )

@router.post("/inject")
def inject_demo_anomaly(payload: AnomalyInjectPayload):
    spec = storage.get_transformer(payload.transformer_id)
    if not spec:
        raise HTTPException(status_code=404, detail=f"Transformer {payload.transformer_id} not found")

    storage.inject_anomaly(
        transformer_id=payload.transformer_id,
        anomaly_type=payload.anomaly_type,
        severity=payload.severity,
        duration_sec=payload.duration_sec
    )
    return {
        "status": "injected",
        "transformer_id": payload.transformer_id,
        "anomaly_type": payload.anomaly_type,
        "duration_sec": payload.duration_sec,
        "message": f"Demonstration anomaly '{payload.anomaly_type}' injected into {payload.transformer_id} for {payload.duration_sec}s."
    }

@router.post("/clear")
def clear_anomaly(payload: AnomalyClearPayload):
    storage.clear_anomaly(payload.transformer_id)
    return {
        "status": "cleared",
        "transformer_id": payload.transformer_id,
        "message": f"Active demonstration anomaly cleared for {payload.transformer_id}."
    }
