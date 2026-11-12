from fastapi import APIRouter
from pydantic import BaseModel, Field
from app.services.storage import storage
from app.services.simulator import simulator

router = APIRouter(prefix="/simulation", tags=["Simulation Controls"])

class SpeedPayload(BaseModel):
    speed_multiplier: float = Field(..., ge=0.2, le=20.0)

@router.get("/status")
def get_simulation_status():
    return {
        "is_paused": storage.sim_paused,
        "speed_multiplier": storage.sim_speed_multiplier,
        "active_anomalies": storage.get_active_anomalies(),
        "is_mock_data": True
    }

@router.post("/tick")
def trigger_tick():
    results = simulator.tick()
    return {
        "status": "ticked",
        "updated_units": len(results),
        "is_mock_data": True
    }

@router.post("/pause")
def pause_simulation():
    storage.set_simulation_pause(True)
    return {"status": "paused", "is_paused": True}

@router.post("/resume")
def resume_simulation():
    storage.set_simulation_pause(False)
    return {"status": "resumed", "is_paused": False}

@router.post("/speed")
def set_speed(payload: SpeedPayload):
    storage.set_simulation_speed(payload.speed_multiplier)
    return {"status": "speed_updated", "speed_multiplier": storage.sim_speed_multiplier}

@router.post("/reset")
def reset_simulation():
    storage.telemetry_history.clear()
    storage.alerts.clear()
    storage.inspections.clear()
    storage.injected_anomalies.clear()
    simulator.initialize_system()
    return {"status": "reset", "message": "Simulation reset to pristine baseline with 48h telemetry."}
