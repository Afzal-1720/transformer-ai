from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from app.models.ai import ForecastResponse, ExplainableRiskResponse
from app.services.ml_forecasting import forecasting_engine
from app.services.risk_engine import risk_engine

router = APIRouter(prefix="/predictions", tags=["Predictions & AI"])

class ForecastRequestPayload(BaseModel):
    transformer_id: str

@router.get("/{transformer_id}", response_model=ForecastResponse)
def get_transformer_forecast(transformer_id: str):
    try:
        return forecasting_engine.forecast_load(transformer_id)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Forecasting error: {str(e)}")

@router.post("/forecast", response_model=ForecastResponse)
def post_forecast(payload: ForecastRequestPayload):
    try:
        return forecasting_engine.forecast_load(payload.transformer_id)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Forecasting error: {str(e)}")

@router.get("/{transformer_id}/risk", response_model=ExplainableRiskResponse)
def get_explainable_risk(transformer_id: str):
    try:
        return risk_engine.assess_risk(transformer_id)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Risk assessment error: {str(e)}")
