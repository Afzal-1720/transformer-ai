from fastapi import APIRouter, HTTPException
from app.models.load_balancing import LoadTransferRequest, LoadTransferResponse
from app.services.load_balancer import load_balancer

router = APIRouter(prefix="/load-balancing", tags=["Load Balancing"])

@router.post("/simulate", response_model=LoadTransferResponse)
def simulate_load_transfer(request: LoadTransferRequest):
    try:
        return load_balancer.simulate_transfer(request)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Simulation calculation error: {str(e)}")
