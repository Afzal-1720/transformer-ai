from datetime import datetime, date
from enum import Enum
from typing import Optional, List, Dict
from pydantic import BaseModel, Field

class TaskPriority(str, Enum):
    P1_CRITICAL = "P1_CRITICAL"
    P2_HIGH = "P2_HIGH"
    P3_MEDIUM = "P3_MEDIUM"
    P4_ROUTINE = "P4_ROUTINE"

class TaskStatus(str, Enum):
    OPEN = "OPEN"
    IN_PROGRESS = "IN_PROGRESS"
    COMPLETED = "COMPLETED"
    CANCELLED = "CANCELLED"

class ConditionCategory(str, Enum):
    GOOD = "GOOD"
    FAIR = "FAIR"
    DEGRADED = "DEGRADED"
    CRITICAL = "CRITICAL"

class MaintenanceTask(BaseModel):
    id: str
    transformer_id: str
    title: str
    description: str
    priority: TaskPriority
    status: TaskStatus
    assigned_technician: str
    scheduled_date: str
    completed_date: Optional[str] = None
    notes: Optional[str] = ""
    created_at: datetime
    is_simulated: bool = True

class CreateTaskRequest(BaseModel):
    transformer_id: str
    title: str
    description: str
    priority: TaskPriority = TaskPriority.P3_MEDIUM
    assigned_technician: str = "Field Team Delta"
    scheduled_date: str
    notes: Optional[str] = ""

class UpdateTaskRequest(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    priority: Optional[TaskPriority] = None
    status: Optional[TaskStatus] = None
    assigned_technician: Optional[str] = None
    scheduled_date: Optional[str] = None
    completed_date: Optional[str] = None
    notes: Optional[str] = None

class AssetHealthRecord(BaseModel):
    transformer_id: str
    transformer_name: str
    zone: str
    rated_capacity_kva: float
    health_score: float = Field(..., description="Calculated asset condition index (0 to 100)")
    condition_category: ConditionCategory
    maintenance_priority: TaskPriority
    last_inspection_date: str
    next_inspection_date: str
    open_tasks_count: int
    health_score_breakdown: Dict[str, float]
    is_simulated: bool = True
