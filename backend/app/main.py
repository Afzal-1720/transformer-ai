import asyncio
import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.config import settings
from app.services.simulator import simulator
from app.services.storage import storage
from app.routers import (
    health, transformers, dashboard, alerts, predictions, anomalies, load_balancing, maintenance, simulation
)

logger = logging.getLogger("transformer_ai")
logging.basicConfig(level=logging.INFO)

async def simulation_loop():
    """Background task advancing simulated grid state according to speed multiplier."""
    logger.info("Starting background grid simulation loop...")
    while True:
        try:
            if not storage.sim_paused:
                simulator.tick()
            # Calculate sleep interval based on speed multiplier
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
    # Startup: Initialize simulator fleet and 48-hour history
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
    description="AI-powered transformer condition monitoring, ML forecasting, Isolation Forest anomaly detection, explainable risk assessment, and load-transfer decision support.",
    lifespan=lifespan
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allows all origins for local dev and preview deploys
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers under /api
app.include_router(health.router, prefix=settings.API_PREFIX)
app.include_router(transformers.router, prefix=settings.API_PREFIX)
app.include_router(dashboard.router, prefix=settings.API_PREFIX)
app.include_router(alerts.router, prefix=settings.API_PREFIX)
app.include_router(predictions.router, prefix=settings.API_PREFIX)
app.include_router(anomalies.router, prefix=settings.API_PREFIX)
app.include_router(load_balancing.router, prefix=settings.API_PREFIX)
app.include_router(maintenance.router, prefix=settings.API_PREFIX)
app.include_router(simulation.router, prefix=settings.API_PREFIX)

@app.get("/")
def root():
    return {
        "title": settings.PROJECT_NAME,
        "version": settings.VERSION,
        "status": "online",
        "documentation": "/docs",
        "simulation_mode": True,
        "disclaimer": "Academic and demonstration prototype using simulated electrical grid telemetry. Not connected to physical grid assets."
    }
