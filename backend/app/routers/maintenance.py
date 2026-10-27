import uuid
from datetime import datetime, timezone, timedelta
from typing import List, Optional
from fastapi import APIRouter, HTTPException, Query
from app.models.maintenance import (
    MaintenanceTask, CreateTaskRequest, UpdateTaskRequest, AssetHealthRecord,
    ConditionCategory, TaskPriority, TaskStatus
)
from app.services.storage import storage
from app.services.risk_engine import risk_engine

router = APIRouter(prefix="/maintenance", tags=["Maintenance"])

@router.get("")
def get_maintenance_overview(
    transformer_id: Optional[str] = Query(None, description="Filter by transformer ID")
):
    specs = storage.get_transformers()
    tasks = storage.get_maintenance_tasks(transformer_id=transformer_id)

    asset_register: List[AssetHealthRecord] = []
    now = datetime.now()

    for spec in specs:
        if transformer_id and spec.id != transformer_id:
            continue

        health_score, health_status, risk_level, risk_score = risk_engine.calculate_health_score(spec.id)
        
        # Categorize
        if health_score >= 80.0:
            condition = ConditionCategory.GOOD
            priority = TaskPriority.P4_ROUTINE
            next_insp = (now + timedelta(days=90)).strftime("%Y-%m-%d")
        elif health_score >= 65.0:
            condition = ConditionCategory.FAIR
            priority = TaskPriority.P3_MEDIUM
            next_insp = (now + timedelta(days=30)).strftime("%Y-%m-%d")
        elif health_score >= 45.0:
            condition = ConditionCategory.DEGRADED
            priority = TaskPriority.P2_HIGH
            next_insp = (now + timedelta(days=7)).strftime("%Y-%m-%d")
        else:
            condition = ConditionCategory.CRITICAL
            priority = TaskPriority.P1_CRITICAL
            next_insp = (now + timedelta(days=1)).strftime("%Y-%m-%d")

        last_insp = (now - timedelta(days=60 + (hash(spec.id) % 90))).strftime("%Y-%m-%d")
        open_cnt = len([t for t in tasks if t.transformer_id == spec.id and t.status in [TaskStatus.OPEN, TaskStatus.IN_PROGRESS]])

        # Transparent score breakdown
        age = now.year - spec.installation_year
        breakdown = {
            "operational_stress_penalty": round(risk_score * 0.75, 1),
            "asset_age_years": age,
            "aging_derating_penalty": round(min(15.0, age * 1.5), 1),
            "baseline_health_index": 100.0,
            "final_health_score": health_score
        }

        asset_register.append(AssetHealthRecord(
            transformer_id=spec.id,
            transformer_name=spec.name,
            zone=spec.zone,
            rated_capacity_kva=spec.rated_capacity_kva,
            health_score=health_score,
            condition_category=condition,
            maintenance_priority=priority,
            last_inspection_date=last_insp,
            next_inspection_date=next_insp,
            open_tasks_count=open_cnt,
            health_score_breakdown=breakdown,
            is_simulated=True
        ))

    # Sort asset register: lowest health score first
    asset_register.sort(key=lambda a: a.health_score)

    return {
        "asset_register": asset_register,
        "tasks": tasks,
        "is_simulated": True
    }

@router.post("", response_model=MaintenanceTask)
def create_maintenance_task(req: CreateTaskRequest):
    spec = storage.get_transformer(req.transformer_id)
    if not spec:
        raise HTTPException(status_code=404, detail=f"Transformer {req.transformer_id} not found")

    task_id = f"MNT-{datetime.now().year}-{uuid.uuid4().hex[:4].upper()}"
    new_task = MaintenanceTask(
        id=task_id,
        transformer_id=req.transformer_id,
        title=req.title,
        description=req.description,
        priority=req.priority,
        status=TaskStatus.OPEN,
        assigned_technician=req.assigned_technician,
        scheduled_date=req.scheduled_date,
        notes=req.notes or "",
        created_at=datetime.now(timezone.utc),
        is_simulated=True
    )
    storage.add_maintenance_task(new_task)
    return new_task

@router.patch("/{task_id}", response_model=MaintenanceTask)
def update_maintenance_task(task_id: str, req: UpdateTaskRequest):
    updates = req.model_dump(exclude_unset=True)
    if req.status == TaskStatus.COMPLETED and "completed_date" not in updates:
        updates["completed_date"] = datetime.now().strftime("%Y-%m-%d")

    updated = storage.update_maintenance_task(task_id, updates)
    if not updated:
        raise HTTPException(status_code=404, detail=f"Maintenance task {task_id} not found")
    return updated
