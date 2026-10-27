from typing import List, Optional
from fastapi import APIRouter, HTTPException, Query
from app.models.transformer import TransformerDetail, TransformerSpec, TelemetryReading
from app.services.storage import storage
from app.services.risk_engine import risk_engine

router = APIRouter(prefix="/transformers", tags=["Transformers"])

@router.get("", response_model=List[TransformerDetail])
def list_transformers(
    zone: Optional[str] = Query(None, description="Filter by substation zone"),
    status: Optional[str] = Query(None, description="Filter by health status")
):
    specs = storage.get_transformers()
    results = []

    for spec in specs:
        if zone and zone.lower() not in spec.zone.lower():
            continue

        telemetry = storage.get_latest_telemetry(spec.id)
        if not telemetry:
            continue

        health_score, health_status, risk_level, risk_score = risk_engine.calculate_health_score(spec.id)
        
        if status and status.upper() != health_status.value:
            continue

        active_alerts = storage.get_active_alerts_count(spec.id)

        results.append(TransformerDetail(
            spec=spec,
            telemetry=telemetry,
            health_score=health_score,
            health_status=health_status,
            risk_level=risk_level,
            risk_score=risk_score,
            active_alerts_count=active_alerts,
            is_simulated=True
        ))

    return results

@router.get("/{transformer_id}", response_model=TransformerDetail)
def get_transformer(transformer_id: str):
    spec = storage.get_transformer(transformer_id)
    if not spec:
        raise HTTPException(status_code=404, detail=f"Transformer {transformer_id} not found")

    telemetry = storage.get_latest_telemetry(transformer_id)
    if not telemetry:
        raise HTTPException(status_code=404, detail=f"No telemetry found for transformer {transformer_id}")

    health_score, health_status, risk_level, risk_score = risk_engine.calculate_health_score(transformer_id)
    active_alerts = storage.get_active_alerts_count(transformer_id)

    return TransformerDetail(
        spec=spec,
        telemetry=telemetry,
        health_score=health_score,
        health_status=health_status,
        risk_level=risk_level,
        risk_score=risk_score,
        active_alerts_count=active_alerts,
        is_simulated=True
    )

@router.get("/{transformer_id}/telemetry", response_model=List[TelemetryReading])
def get_transformer_telemetry(
    transformer_id: str,
    limit: int = Query(60, ge=1, le=500, description="Number of recent telemetry points to return")
):
    spec = storage.get_transformer(transformer_id)
    if not spec:
        raise HTTPException(status_code=404, detail=f"Transformer {transformer_id} not found")

    history = storage.get_telemetry_history(transformer_id, limit=limit)
    return history
