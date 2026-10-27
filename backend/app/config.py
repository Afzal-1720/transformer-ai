import os
from typing import List
from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    PROJECT_NAME: str = "TRANSFORMER AI — Smart Grid Intelligence Platform"
    VERSION: str = "1.0.0"
    API_PREFIX: str = "/api"
    HOST: str = "0.0.0.0"
    PORT: int = int(os.getenv("PORT", "8000"))
    CORS_ORIGINS: List[str] = [
        "http://localhost:5173",
        "http://localhost:3000",
        "http://127.0.0.1:5173",
        "http://127.0.0.1:3000",
        "*"
    ]
    DATABASE_URL: str | None = None
    SIMULATION_INTERVAL_SEC: float = 2.0
    HISTORY_HOURS: int = 48  # Initial generated historical hours for ML

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

settings = Settings()
