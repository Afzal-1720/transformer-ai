from datetime import datetime, timezone
from fastapi import APIRouter
from app.config import settings
from app.services.storage import storage

router = APIRouter(prefix="/health", tags=["Health"])

@router.get("")
def get_health():
    return {
        "status": "healthy",
        "service": settings.PROJECT_NAME,
        "version": settings.VERSION,
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "is_simulated": True,
        "sim_paused": storage.sim_paused,
        "sim_speed": storage.sim_speed_multiplier,
        "active_transformers": len(storage.get_transformers())
    }
