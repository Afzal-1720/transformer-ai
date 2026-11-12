import os
from typing import List
from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    PROJECT_NAME: str = "TRANSFORMER AI — Real-Time Transformer Monitoring & Condition Assessment System"
    VERSION: str = "2.0.0"
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
    SIMULATION_INTERVAL_SEC: float = 2.5
    HISTORY_HOURS: int = 48

    # =========================================================================
    # CENTRALIZED ELECTRICAL & THERMAL THRESHOLDS
    # =========================================================================

    # 1. Output Voltage (Vrms) Permissible Deviation Limits
    # Voltage Deviation (%) = ((Measured Voltage - Rated Voltage) / Rated Voltage) * 100
    VOLTAGE_DEV_MIN_PCT: float = -10.0   # Permissible lower deviation limit (-10%)
    VOLTAGE_DEV_MAX_PCT: float = +6.0    # Permissible upper deviation limit (+6%)

    # 2. Government-Specified Statutory Supply Voltage Limits (Separate Check)
    # Permissible Supply Range: 216 V to 254 V
    SUPPLY_VOLTAGE_MIN: float = 216.0    # Under-voltage statutory threshold (<216 V)
    SUPPLY_VOLTAGE_MAX: float = 254.0    # Over-voltage statutory threshold (>254 V)

    # 3. Output Current (Arms) Permissible Deviation Limit (Configurable Backend Threshold)
    # Current Deviation (%) = ((Measured Current - Rated Current) / Rated Current) * 100
    # Note: Clearly identified as a configurable threshold, not an official government statutory limit.
    CURRENT_DEV_MAX_PCT: float = 10.0    # Over-current threshold (+10.0% above rated Arms)

    # 4. Loading Thresholds (%)
    # Loading (%) = (Measured Current / Rated Current) * 100
    LOADING_HIGH_PCT: float = 80.0       # High loading threshold (80%)
    LOADING_OVERLOAD_PCT: float = 100.0  # Overload threshold (100%)

    # 5. Winding Hotspot Temperature Thresholds (°C)
    # Derived from actual temperature sensor reading
    HOTSPOT_TEMP_NORMAL_MAX_C: float = 80.0    # Normal maximum operating hotspot temp (°C)
    HOTSPOT_TEMP_ELEVATED_MAX_C: float = 95.0  # Elevated thermal warning threshold (°C)
    HOTSPOT_TEMP_CRITICAL_C: float = 105.0     # Critical overheating threshold (°C)

    # 6. Sudden Load Variation Threshold (%)
    # Percentage change between latest current and recent baseline
    SUDDEN_CURRENT_VARIATION_PCT: float = 25.0 # Sudden current shift trigger (25%)

    # 7. Moisture Thresholds (% RH - Relative Saturation in Insulation)
    MOISTURE_WARNING_PCT: float = 25.0   # Moisture warning threshold (25% RH)
    MOISTURE_CRITICAL_PCT: float = 35.0  # Moisture critical threshold (35% RH)

    # 8. Phase Imbalance Feature Flag
    # Kept disabled: The current hardware only provides single RMS voltage and current.
    # We do not fabricate phase-level readings.
    PHASE_IMBALANCE_ENABLED: bool = False

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

settings = Settings()
