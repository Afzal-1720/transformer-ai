from datetime import datetime
from enum import Enum
from typing import Optional, List
from pydantic import BaseModel, Field

class InspectionPriority(str, Enum):
    CRITICAL = "Critical"
    HIGH = "High"
    MEDIUM = "Medium"
    ROUTINE = "Routine"

class InspectionStatus(str, Enum):
    PENDING = "Pending"
    ACKNOWLEDGED = "Acknowledged"
    COMPLETED = "Completed"

class InspectionRecord(BaseModel):
    id: str = Field(..., description="Unique inspection identifier e.g. INSP-2026-001")
    transformer_id: str
    transformer_name: str
    reason: str
    priority: InspectionPriority
    status: InspectionStatus = InspectionStatus.PENDING
    detected_at: datetime
    recommended_action: str
    acknowledged_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    assigned_technician: str = "Substation Electrical Field Team"
    notes: Optional[str] = ""
    is_mock_data: bool = True

class CreateInspectionRequest(BaseModel):
    transformer_id: str
    reason: str
    priority: InspectionPriority = InspectionPriority.MEDIUM
    recommended_action: str
    assigned_technician: str = "Substation Electrical Field Team"
    notes: Optional[str] = ""

class UpdateInspectionRequest(BaseModel):
    status: Optional[InspectionStatus] = None
    assigned_technician: Optional[str] = None
    notes: Optional[str] = None
