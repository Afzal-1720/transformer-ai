from typing import List, Optional
from fastapi import APIRouter, HTTPException, Query
from app.models.transformer import TransformerDetail, TelemetryReading, TransformerSpec
from app.models.condition import TransformerConditionReport
from app.models.anomaly import AnomalySummary
from app.services.storage import storage
from app.services.condition_evaluator import condition_evaluator

router = APIRouter(prefix="/transformers", tags=["Transformers"])

@router.get("", response_model=List[TransformerDetail])
def list_transformers(
    substation: Optional[str] = Query(None, description="Filter by substation zone"),
    condition: Optional[str] = Query(None, description="Filter by overall condition (HEALTHY, WARNING, CRITICAL, INSPECTION_REQUIRED)")
):
    """
    List all monitored transformers with latest telemetry and evaluated condition status.
    """
    specs = storage.get_transformers()
    results = []

    for spec in specs:
        if substation and substation.lower() not in spec.substation.lower():
            continue

        telemetry = storage.get_latest_telemetry(spec.id)
        if not telemetry:
            continue

        history = storage.get_telemetry_history(spec.id, limit=10)
        anomalies = condition_evaluator.detect_anomalies(spec, telemetry, history)
        detail = condition_evaluator.create_transformer_detail(
            spec, telemetry, history, active_anomalies_count=len(anomalies)
        )

        if condition and condition.upper() != detail.overall_condition.value:
            continue

        results.append(detail)

    return results

@router.get("/{transformer_id}", response_model=TransformerDetail)
def get_transformer(transformer_id: str):
    """
    Get detailed information and condition status for a specific transformer.
    """
    spec = storage.get_transformer(transformer_id)
    if not spec:
        raise HTTPException(status_code=404, detail=f"Transformer {transformer_id} not found")

    telemetry = storage.get_latest_telemetry(transformer_id)
    if not telemetry:
        raise HTTPException(status_code=404, detail=f"No telemetry found for transformer {transformer_id}")

    history = storage.get_telemetry_history(transformer_id, limit=10)
    anomalies = condition_evaluator.detect_anomalies(spec, telemetry, history)
    
    return condition_evaluator.create_transformer_detail(
        spec, telemetry, history, active_anomalies_count=len(anomalies)
    )

@router.get("/{transformer_id}/telemetry", response_model=List[TelemetryReading])
def get_transformer_telemetry(
    transformer_id: str,
    limit: int = Query(60, ge=1, le=500, description="Number of recent telemetry points to return")
):
    """
    Get historical telemetry readings for trend chart visualization.
    """
    spec = storage.get_transformer(transformer_id)
    if not spec:
        raise HTTPException(status_code=404, detail=f"Transformer {transformer_id} not found")

    # =========================================================================
    # FUTURE HARDWARE INTEGRATION:
    # Replace the storage retrieval below with queries against real time-series
    # database (e.g. TimescaleDB, InfluxDB, or IoT message broker) receiving
    # live Vrms, Arms, Winding Hotspot Temp, and Moisture from sensor hardware.
    # =========================================================================
    return storage.get_telemetry_history(transformer_id, limit=limit)

@router.get("/{transformer_id}/condition", response_model=TransformerConditionReport)
def get_transformer_condition(transformer_id: str):
    """
    Get dedicated condition assessment report for a transformer, separating
    sensor connectivity, voltage behaviour, loading condition, and thermal condition.
    """
    spec = storage.get_transformer(transformer_id)
    if not spec:
        raise HTTPException(status_code=404, detail=f"Transformer {transformer_id} not found")

    telemetry = storage.get_latest_telemetry(transformer_id)
    if not telemetry:
        raise HTTPException(status_code=404, detail=f"No telemetry found for transformer {transformer_id}")

    history = storage.get_telemetry_history(transformer_id, limit=10)
    return condition_evaluator.evaluate_condition_report(spec, telemetry, history)

@router.get("/{transformer_id}/anomalies", response_model=AnomalySummary)
def get_transformer_anomalies(transformer_id: str):
    """
    Detects and returns all active operating anomalies for the specified transformer.
    """
    spec = storage.get_transformer(transformer_id)
    if not spec:
        raise HTTPException(status_code=404, detail=f"Transformer {transformer_id} not found")

    telemetry = storage.get_latest_telemetry(transformer_id)
    if not telemetry:
        raise HTTPException(status_code=404, detail=f"No telemetry found for transformer {transformer_id}")

    history = storage.get_telemetry_history(transformer_id, limit=10)
    anomalies = condition_evaluator.detect_anomalies(spec, telemetry, history)
    report = condition_evaluator.evaluate_condition_report(spec, telemetry, history)

    return AnomalySummary(
        transformer_id=transformer_id,
        timestamp=telemetry.timestamp,
        overall_condition=report.overall_condition.value,
        anomalies=anomalies,
        total_anomalies=len(anomalies),
        has_critical=any(a.severity.value == "Critical" for a in anomalies),
        has_warning=any(a.severity.value == "Warning" for a in anomalies),
        phase_imbalance_status="Disabled: Single-phase RMS hardware telemetry only. Phase-level data is not fabricated.",
        is_mock_data=True
    )
