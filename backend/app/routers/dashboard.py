from collections import defaultdict
from fastapi import APIRouter
from app.services.storage import storage
from app.services.condition_evaluator import condition_evaluator
from app.models.transformer import OverallCondition
from app.models.alert import AlertStatus, AlertSeverity

router = APIRouter(prefix="/dashboard", tags=["Dashboard"])

@router.get("/summary")
def get_dashboard_summary():
    """
    Returns fleet-wide executive summary for the main Dashboard page.
    """
    specs = storage.get_transformers()
    total_transformers = len(specs)

    online_count = 0
    inspection_required_count = 0
    critical_count = 0
    warning_count = 0
    healthy_count = 0

    total_load_pct = 0.0
    valid_count = 0

    unit_summaries = []

    for spec in specs:
        telemetry = storage.get_latest_telemetry(spec.id)
        if not telemetry:
            continue

        if telemetry.sensor_status == "ONLINE":
            online_count += 1

        history = storage.get_telemetry_history(spec.id, limit=10)
        anomalies = condition_evaluator.detect_anomalies(spec, telemetry, history)
        detail = condition_evaluator.create_transformer_detail(
            spec, telemetry, history, active_anomalies_count=len(anomalies)
        )

        total_load_pct += detail.loading_pct
        valid_count += 1

        if detail.overall_condition == OverallCondition.HEALTHY:
            healthy_count += 1
        elif detail.overall_condition == OverallCondition.WARNING:
            warning_count += 1
        elif detail.overall_condition == OverallCondition.CRITICAL:
            critical_count += 1

        if detail.inspection_required:
            inspection_required_count += 1

        unit_summaries.append({
            "id": spec.id,
            "name": spec.name,
            "substation": spec.substation,
            "vrms": telemetry.vrms,
            "irms": telemetry.irms,
            "voltage_dev_pct": detail.voltage_deviation_pct,
            "voltage_status": detail.voltage_deviation_status,
            "supply_status": detail.supply_voltage_status,
            "current_dev_pct": detail.current_deviation_pct,
            "loading_pct": detail.loading_pct,
            "loading_condition": detail.loading_condition,
            "winding_hotspot_temperature": telemetry.winding_hotspot_temperature,
            "moisture": telemetry.moisture,
            "thermal_condition": detail.thermal_condition,
            "sensor_status": telemetry.sensor_status,
            "overall_condition": detail.overall_condition.value,
            "inspection_required": detail.inspection_required,
            "condition_explanation": detail.condition_explanation,
            "recommended_action": detail.recommended_action
        })

    avg_load_pct = round(total_load_pct / max(valid_count, 1), 1)

    # Active alerts
    active_alerts = storage.get_alerts(status=AlertStatus.ACTIVE)
    critical_alerts_count = len([a for a in active_alerts if a.severity == AlertSeverity.CRITICAL])

    # Pending inspections
    pending_inspections = storage.get_pending_inspections_count()

    # Aggregate 24-point load & thermal trend from history of the first transformer
    sample_id = specs[0].id if specs else None
    history_sample = storage.get_telemetry_history(sample_id, limit=24) if sample_id else []
    
    trend = []
    for point in history_sample:
        trend.append({
            "timestamp": point.timestamp.isoformat(),
            "avg_vrms": round(point.vrms, 1),
            "avg_irms": round(point.irms, 1),
            "hotspot_temp_c": round(point.winding_hotspot_temperature, 1),
            "moisture_pct": round(point.moisture, 1)
        })

    # Overall fleet status determination
    if critical_count > 0 or critical_alerts_count > 0:
        fleet_status = "CRITICAL"
        fleet_status_desc = f"{critical_count} transformer(s) operating under critical anomaly conditions. Immediate inspection required."
    elif inspection_required_count > 0:
        fleet_status = "INSPECTION_REQUIRED"
        fleet_status_desc = f"{inspection_required_count} unit(s) flagged for engineering inspection due to abnormal readings or fluctuations."
    elif warning_count > 0:
        fleet_status = "WARNING"
        fleet_status_desc = f"{warning_count} unit(s) exhibiting minor operational deviations."
    else:
        fleet_status = "HEALTHY"
        fleet_status_desc = "All monitored transformers operating within normal voltage, current, and thermal limits."

    return {
        "kpis": {
            "total_transformers": total_transformers,
            "online_transformers": online_count,
            "offline_transformers": total_transformers - online_count,
            "transformers_requiring_inspection": inspection_required_count,
            "active_critical_alerts": critical_alerts_count,
            "total_active_alerts": len(active_alerts),
            "pending_inspections": pending_inspections,
            "avg_load_percentage": avg_load_pct
        },
        "fleet_condition": {
            "status": fleet_status,
            "description": fleet_status_desc,
            "healthy": healthy_count,
            "warning": warning_count,
            "critical": critical_count,
            "inspection_required": inspection_required_count
        },
        "transformer_summaries": unit_summaries,
        "recent_alerts": active_alerts[:6],
        "telemetry_trend": trend,
        "is_mock_data": True
    }
