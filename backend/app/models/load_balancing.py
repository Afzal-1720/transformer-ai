from enum import Enum
from typing import List, Optional
from pydantic import BaseModel, Field

class ScenarioVerdict(str, Enum):
    APPROVED = "APPROVED"
    WARNING = "WARNING"
    REJECTED = "REJECTED"

class LoadTransferRequest(BaseModel):
    source_id: str = Field(..., description="ID of heavily loaded or relief-seeking transformer")
    target_id: str = Field(..., description="ID of recipient transformer with spare capacity")
    transfer_kva: float = Field(..., gt=0, description="Amount of apparent load to transfer in kVA")
    safety_margin_pct: float = Field(default=85.0, ge=50.0, le=100.0, description="Safe operating threshold limit %")

class LoadTransferResponse(BaseModel):
    feasible: bool
    verdict: ScenarioVerdict
    source_id: str
    target_id: str
    transfer_kva: float
    source_name: str
    target_name: str
    source_pre_load_kva: float
    source_post_load_kva: float
    source_pre_pct: float
    source_post_pct: float
    target_pre_load_kva: float
    target_post_load_kva: float
    target_pre_pct: float
    target_post_pct: float
    target_rated_kva: float
    target_remaining_headroom_kva: float
    pre_source_risk: float
    post_source_risk: float
    pre_target_risk: float
    post_target_risk: float
    explanation: str
    safety_warnings: List[str]
    interconnection_path: List[str]
    is_simulated: bool = True
