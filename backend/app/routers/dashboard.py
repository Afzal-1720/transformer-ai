from collections import defaultdict
from fastapi import APIRouter
from app.services.storage import storage
from app.services.risk_engine import risk_engine
from app.models.transformer import HealthStatus
from app.models.alert import AlertStatus

router = APIRouter(prefix="/dashboard", tags=["Dashboard"])

@router.get("/summary")
def get_dashboard_summary():
    specs = storage.get_transformers()
    total_transformers = len(specs)

    healthy_count = 0
    warning_count = 0
    critical_count = 0
    total_load_pct = 0.0
    valid_load_count = 0

    highest_loaded = None
    max_load_pct = -1.0

    zone_stats = defaultdict(lambda: {"total_rated_kva": 0.0, "total_apparent_kva": 0.0, "active_kw": 0.0, "count": 0})

    for spec in specs:
        telemetry = storage.get_latest_telemetry(spec.id)
        if not telemetry:
            continue

        health_score, health_status, risk_level, risk_score = risk_engine.calculate_health_score(spec.id)
        
        if health_status == HealthStatus.HEALTHY:
            healthy_count += 1
        elif health_status == HealthStatus.WARNING:
            warning_count += 1
        else:
            critical_count += 1

        total_load_pct += telemetry.load_percentage
        valid_load_count += 1

        if telemetry.load_percentage > max_load_pct:
            max_load_pct = telemetry.load_percentage
            highest_loaded = {
                "id": spec.id,
                "name": spec.name,
                "zone": spec.zone,
                "load_percentage": telemetry.load_percentage,
                "apparent_power_kva": telemetry.apparent_power_kva,
                "rated_capacity_kva": spec.rated_capacity_kva,
                "temperature_c": telemetry.oil_temp_c
            }

        # Zone aggregation
        z = zone_stats[spec.zone]
        z["total_rated_kva"] += spec.rated_capacity_kva
        z["total_apparent_kva"] += telemetry.apparent_power_kva
        z["active_kw"] += telemetry.active_power_kw
        z["count"] += 1

    avg_load_pct = round(total_load_pct / max(valid_load_count, 1), 1)
    active_alerts = storage.get_alerts(status=AlertStatus.ACTIVE)

    # Format zone distribution list
    zone_distribution = []
    greatest_zone = None
    max_zone_avg_pct = -1.0

    for zone_name, data in zone_stats.items():
        avg_pct = round((data["total_apparent_kva"] / max(data["total_rated_kva"], 1.0)) * 100.0, 1)
        if avg_pct > max_zone_avg_pct:
            max_zone_avg_pct = avg_pct
            greatest_zone = {
                "zone": zone_name,
                "avg_load_pct": avg_pct,
                "total_rated_kva": round(data["total_rated_kva"], 0),
                "total_apparent_kva": round(data["total_apparent_kva"], 1)
            }

        zone_distribution.append({
            "zone": zone_name,
            "transformer_count": data["count"],
            "total_rated_kva": round(data["total_rated_kva"], 0),
            "total_apparent_kva": round(data["total_apparent_kva"], 1),
            "total_active_kw": round(data["active_kw"], 1),
            "avg_load_percentage": avg_pct
        })

    # Most urgent maintenance requirement
    maintenance_tasks = storage.get_maintenance_tasks()
    urgent_task = None
    open_tasks = [t for t in maintenance_tasks if t.status in ["OPEN", "IN_PROGRESS"]]
    if open_tasks:
        priority_order = {"P1_CRITICAL": 1, "P2_HIGH": 2, "P3_MEDIUM": 3, "P4_ROUTINE": 4}
        sorted_tasks = sorted(open_tasks, key=lambda t: priority_order.get(t.priority.value, 9))
        top_task = sorted_tasks[0]
        urgent_task = {
            "id": top_task.id,
            "transformer_id": top_task.transformer_id,
            "title": top_task.title,
            "priority": top_task.priority.value,
            "status": top_task.status.value,
            "scheduled_date": top_task.scheduled_date
        }

    # Time series aggregate trend across past readings
    # Aggregate past 24 hourly averages from history of first transformer timestamps
    first_id = specs[0].id if specs else None
    history_sample = storage.get_telemetry_history(first_id, limit=24) if first_id else []
    
    trend = []
    for point in history_sample:
        ts = point.timestamp
        # Aggregate across fleet for this point or approximate
        trend.append({
            "timestamp": ts.isoformat(),
            "total_kw": round(point.active_power_kw * (total_transformers / 1.1), 1),
            "avg_temp_c": round(point.oil_temp_c, 1),
            "avg_load_pct": round(point.load_percentage, 1)
        })

    return {
        "kpis": {
            "total_transformers": total_transformers,
            "healthy_count": healthy_count,
            "warning_count": warning_count,
            "critical_count": critical_count,
            "avg_load_percentage": avg_load_pct,
            "active_alerts_count": len(active_alerts)
        },
        "health_distribution": {
            "healthy": healthy_count,
            "warning": warning_count,
            "critical": critical_count
        },
        "zone_distribution": zone_distribution,
        "insights": {
            "highest_loaded_transformer": highest_loaded,
            "greatest_load_zone": greatest_zone,
            "most_urgent_maintenance": urgent_task
        },
        "network_load_trend": trend,
        "recent_alerts": active_alerts[:5],
        "is_simulated": True
    }
