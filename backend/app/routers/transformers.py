import math
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional
from fastapi import APIRouter, Body, HTTPException, Query
from app.models.transformer import (
    SensorStatus,
    TransformerDetail,
    TelemetryReading,
    TransformerSpec,
)
from app.models.condition import TransformerConditionReport
from app.models.anomaly import AnomalySummary
from app.services.storage import storage
from app.services.condition_evaluator import condition_evaluator

router = APIRouter(prefix="/transformers", tags=["Transformers"])


def _validate_numeric(value: Any, field_name: str, *, minimum: float, maximum: float) -> float:
    if value is None or isinstance(value, bool):
        raise ValueError(f"{field_name} is required and must be numeric")
    try:
        numeric = float(value)
    except (TypeError, ValueError):
        raise ValueError(f"{field_name} must be a numeric value")
    if math.isnan(numeric) or math.isinf(numeric):
        raise ValueError(f"{field_name} must be a finite number")
    if numeric < minimum or numeric > maximum:
        raise ValueError(f"{field_name} must be between {minimum} and {maximum}")
    return numeric


def _normalize_hardware_telemetry(transformer_id: str, payload: Dict[str, Any]) -> TelemetryReading:
    if not isinstance(payload, dict):
        raise ValueError("Telemetry payload must be a JSON object")

    incoming_transformer_id = payload.get("transformer_id", transformer_id)
    if incoming_transformer_id and str(incoming_transformer_id) != transformer_id:
        raise ValueError("Transformer ID in the payload does not match the route transformer ID")

    if "temperature" in payload and "winding_hotspot_temperature" not in payload:
        payload["winding_hotspot_temperature"] = payload["temperature"]

    if "winding_hotspot_temperature" not in payload:
        raise ValueError("Missing required field: winding_hotspot_temperature")

    vrms = _validate_numeric(payload.get("vrms"), "vrms", minimum=0.0, maximum=500.0)
    irms = _validate_numeric(payload.get("irms"), "irms", minimum=0.0, maximum=500.0)
    hotspot = _validate_numeric(payload.get("winding_hotspot_temperature"), "winding_hotspot_temperature", minimum=-40.0, maximum=250.0)
    moisture = _validate_numeric(payload.get("moisture"), "moisture", minimum=0.0, maximum=100.0)

    sensor_status = payload.get("sensor_status", "ONLINE")
    if not isinstance(sensor_status, str):
        raise ValueError("sensor_status must be a string")
    sensor_status = sensor_status.upper()
    if sensor_status not in {status.value for status in SensorStatus}:
        raise ValueError(f"sensor_status must be one of: {', '.join(status.value for status in SensorStatus)}")

    timestamp_value = payload.get("timestamp")
    if timestamp_value is None:
        timestamp = datetime.now(timezone.utc)
    else:
        try:
            timestamp = datetime.fromisoformat(str(timestamp_value).replace("Z", "+00:00"))
        except ValueError as exc:
            raise ValueError("timestamp must be ISO 8601 formatted") from exc
        if timestamp.tzinfo is None:
            timestamp = timestamp.replace(tzinfo=timezone.utc)

    return TelemetryReading(
        transformer_id=transformer_id,
        timestamp=timestamp,
        vrms=vrms,
        irms=irms,
        winding_hotspot_temperature=hotspot,
        moisture=moisture,
        sensor_status=sensor_status,
        source="HARDWARE",
        is_mock_data=False,
    )


@router.post("/{transformer_id}/telemetry")
def ingest_transformer_telemetry(transformer_id: str, payload: Dict[str, Any] = Body(...)):
    """Accept validated hardware telemetry from Arduino or other serial sensors."""
    spec = storage.get_transformer(transformer_id)
    if not spec:
        raise HTTPException(status_code=404, detail=f"Transformer {transformer_id} not found")

    try:
        telemetry = _normalize_hardware_telemetry(transformer_id, payload)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    storage.record_telemetry(telemetry)
    storage.set_telemetry_source(transformer_id, "HARDWARE")
    return {
        "success": True,
        "transformer_id": transformer_id,
        "source": "HARDWARE",
        "message": "Telemetry received successfully",
        "timestamp": telemetry.timestamp.isoformat(),
    }


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
