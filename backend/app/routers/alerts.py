from typing import List, Optional
from fastapi import APIRouter, HTTPException, Query
from app.models.alert import Alert, AlertStatus, AlertSeverity
from app.services.storage import storage

router = APIRouter(prefix="/alerts", tags=["Alerts"])

@router.get("", response_model=List[Alert])
def get_alerts(
    status: Optional[AlertStatus] = Query(None, description="Filter by status (ACTIVE, ACKNOWLEDGED, RESOLVED)"),
    severity: Optional[AlertSeverity] = Query(None, description="Filter by severity (INFO, WARNING, HIGH, CRITICAL)"),
    transformer_id: Optional[str] = Query(None, description="Filter by transformer ID")
):
    return storage.get_alerts(status=status, severity=severity, transformer_id=transformer_id)

@router.post("/{alert_id}/acknowledge", response_model=Alert)
def acknowledge_alert(alert_id: str):
    alert = storage.acknowledge_alert(alert_id)
    if not alert:
        raise HTTPException(status_code=404, detail=f"Alert {alert_id} not found")
    return alert

@router.post("/{alert_id}/resolve", response_model=Alert)
def resolve_alert(alert_id: str):
    alert = storage.resolve_alert(alert_id)
    if not alert:
        raise HTTPException(status_code=404, detail=f"Alert {alert_id} not found")
    return alert
