import asyncio
import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.config import settings
from app.services.simulator import simulator
from app.services.storage import storage
from app.routers import (
    health, transformers, dashboard, alerts, anomalies, maintenance, simulation
)

logger = logging.getLogger("transformer_ai")
logging.basicConfig(level=logging.INFO)

async def simulation_loop():
    """Background task advancing simulated grid state according to speed multiplier."""
    logger.info("Starting background transformer telemetry simulation loop...")
    while True:
        try:
            if not storage.sim_paused:
                simulator.tick()
            base_interval = settings.SIMULATION_INTERVAL_SEC
            actual_interval = max(0.2, base_interval / storage.sim_speed_multiplier)
            await asyncio.sleep(actual_interval)
        except asyncio.CancelledError:
            break
        except Exception as e:
            logger.error(f"Error in simulation loop: {e}")
            await asyncio.sleep(2.0)

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: Initialize transformer fleet and baseline telemetry
    logger.info("Initializing Transformer Fleet Telemetry Simulation...")
    simulator.initialize_system()
    
    # Start background simulation task
    sim_task = asyncio.create_task(simulation_loop())
    
    yield
    
    # Shutdown
    sim_task.cancel()
    try:
        await sim_task
    except asyncio.CancelledError:
        pass

app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.VERSION,
    description="Real-Time Transformer Electrical Monitoring, Voltage/Current Deviation Checking, Anomaly Detection, Condition Assessment & Inspection Recommendation System.",
    lifespan=lifespan
)

# CORS middleware for development and production origins
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers under /api
app.include_router(health.router, prefix=settings.API_PREFIX)
app.include_router(transformers.router, prefix=settings.API_PREFIX)
app.include_router(dashboard.router, prefix=settings.API_PREFIX)
app.include_router(alerts.router, prefix=settings.API_PREFIX)
app.include_router(anomalies.router, prefix=settings.API_PREFIX)
app.include_router(maintenance.router, prefix=settings.API_PREFIX)
app.include_router(simulation.router, prefix=settings.API_PREFIX)

@app.get("/")
def root():
    return {
        "title": settings.PROJECT_NAME,
        "version": settings.VERSION,
        "status": "online",
        "documentation": "/docs",
        "is_mock_data": True,
        "disclaimer": "Academic and demonstration prototype using hardcoded mock transformer sensor telemetry. Hardware sensor integration API placeholder available."
    }
