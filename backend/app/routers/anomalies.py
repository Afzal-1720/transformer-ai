from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from app.models.ai import AnomalyDetectionResponse
from app.services.ml_anomaly import anomaly_engine
from app.services.storage import storage

router = APIRouter(prefix="/anomalies", tags=["Anomalies"])

class AnomalyDetectPayload(BaseModel):
    transformer_id: str

class AnomalyInjectPayload(BaseModel):
    transformer_id: str
    anomaly_type: str = Field(..., description="overload | high_temp | voltage_sag | sensor_freeze | offline")
    severity: str = "HIGH"
    duration_sec: int = 120

class AnomalyClearPayload(BaseModel):
    transformer_id: str

@router.post("/detect", response_model=AnomalyDetectionResponse)
def detect_anomalies(payload: AnomalyDetectPayload):
    try:
        return anomaly_engine.detect_anomalies(payload.transformer_id)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Anomaly detection error: {str(e)}")

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
        "message": f"Simulated {payload.anomaly_type} injected into {payload.transformer_id} for {payload.duration_sec}s."
    }

@router.post("/clear")
def clear_anomaly(payload: AnomalyClearPayload):
    storage.clear_anomaly(payload.transformer_id)
    return {
        "status": "cleared",
        "transformer_id": payload.transformer_id,
        "message": f"Active simulated anomaly cleared for {payload.transformer_id}."
    }
