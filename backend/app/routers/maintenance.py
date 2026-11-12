import uuid
from datetime import datetime, timezone
from typing import List, Optional
from fastapi import APIRouter, HTTPException, Query
from app.models.inspection import (
    InspectionRecord, CreateInspectionRequest, UpdateInspectionRequest, InspectionStatus
)
from app.services.storage import storage

router = APIRouter(prefix="/maintenance", tags=["Maintenance & Inspection"])

@router.get("/inspections", response_model=List[InspectionRecord])
def get_inspections(
    transformer_id: Optional[str] = Query(None, description="Filter by transformer ID"),
    status: Optional[InspectionStatus] = Query(None, description="Filter by inspection status (Pending, Acknowledged, Completed)")
):
    """
    Returns inspection recommendations and work orders, newest first.
    """
    return storage.get_inspections(transformer_id=transformer_id, status=status)

@router.get("", response_model=List[InspectionRecord])
def get_maintenance_overview(
    transformer_id: Optional[str] = Query(None, description="Filter by transformer ID"),
    status: Optional[InspectionStatus] = Query(None, description="Filter by inspection status")
):
    """Alias for /maintenance/inspections"""
    return storage.get_inspections(transformer_id=transformer_id, status=status)

@router.post("/inspections", response_model=InspectionRecord)
def create_inspection(req: CreateInspectionRequest):
    """
    Manually create an inspection requirement for a transformer.
    """
    spec = storage.get_transformer(req.transformer_id)
    if not spec:
        raise HTTPException(status_code=404, detail=f"Transformer {req.transformer_id} not found")

    now = datetime.now(timezone.utc)
    record_id = f"INSP-{int(now.timestamp()) % 100000:05d}"
    
    new_record = InspectionRecord(
        id=record_id,
        transformer_id=req.transformer_id,
        transformer_name=spec.name,
        reason=req.reason,
        priority=req.priority,
        status=InspectionStatus.PENDING,
        detected_at=now,
        recommended_action=req.recommended_action,
        assigned_technician=req.assigned_technician,
        notes=req.notes or "",
        is_mock_data=True
    )
    storage.add_inspection(new_record)
    return new_record

@router.patch("/inspections/{inspection_id}", response_model=InspectionRecord)
def update_inspection(inspection_id: str, req: UpdateInspectionRequest):
    """
    Update inspection status (Acknowledged, Completed), assign technician, or append notes.
    """
    updates = req.model_dump(exclude_unset=True)
    now = datetime.now(timezone.utc)

    if req.status == InspectionStatus.COMPLETED and "completed_at" not in updates:
        updates["completed_at"] = now
    elif req.status == InspectionStatus.ACKNOWLEDGED and "acknowledged_at" not in updates:
        updates["acknowledged_at"] = now

    updated = storage.update_inspection(inspection_id, updates)
    if not updated:
        raise HTTPException(status_code=404, detail=f"Inspection record {inspection_id} not found")
    return updated
