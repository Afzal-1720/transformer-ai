-- ====================================================================
-- TRANSFORMER AI — Smart Grid Intelligence Platform
-- PostgreSQL / Supabase Schema Definition
-- ====================================================================

-- 1. Transformers Fleet Asset Registry
CREATE TABLE IF NOT EXISTS transformers (
    id VARCHAR(32) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    zone VARCHAR(128) NOT NULL,
    rated_capacity_kva NUMERIC(10, 2) NOT NULL,
    primary_voltage_kv NUMERIC(8, 3) NOT NULL,
    secondary_voltage_kv NUMERIC(8, 3) NOT NULL,
    cooling_type VARCHAR(32) DEFAULT 'ONAN',
    installation_year INT DEFAULT 2018,
    latitude NUMERIC(9, 6) DEFAULT 37.7749,
    longitude NUMERIC(9, 6) DEFAULT -122.4194,
    connected_substations TEXT[] DEFAULT ARRAY[]::TEXT[],
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Telemetry Time-Series Readings
CREATE TABLE IF NOT EXISTS telemetry_readings (
    id BIGSERIAL PRIMARY KEY,
    transformer_id VARCHAR(32) REFERENCES transformers(id) ON DELETE CASCADE,
    timestamp TIMESTAMPTZ NOT NULL,
    voltage_v NUMERIC(10, 2) NOT NULL,
    voltage_kv NUMERIC(8, 3) NOT NULL,
    current_a NUMERIC(10, 2) NOT NULL,
    active_power_kw NUMERIC(10, 2) NOT NULL,
    apparent_power_kva NUMERIC(10, 2) NOT NULL,
    reactive_power_kvar NUMERIC(10, 2) NOT NULL,
    power_factor NUMERIC(4, 3) NOT NULL,
    frequency_hz NUMERIC(5, 2) DEFAULT 50.0,
    oil_temp_c NUMERIC(5, 2) NOT NULL,
    winding_temp_c NUMERIC(5, 2) NOT NULL,
    ambient_temp_c NUMERIC(5, 2) NOT NULL,
    load_percentage NUMERIC(5, 2) NOT NULL,
    communication_status VARCHAR(16) DEFAULT 'ONLINE',
    is_simulated BOOLEAN DEFAULT TRUE
);

CREATE INDEX IF NOT EXISTS idx_telemetry_tx_time ON telemetry_readings(transformer_id, timestamp DESC);

-- 3. Operational Alerts
CREATE TABLE IF NOT EXISTS alerts (
    id VARCHAR(32) PRIMARY KEY,
    transformer_id VARCHAR(32) REFERENCES transformers(id) ON DELETE CASCADE,
    zone VARCHAR(128) NOT NULL,
    severity VARCHAR(16) NOT NULL, -- INFO, WARNING, HIGH, CRITICAL
    category VARCHAR(32) NOT NULL, -- OVERLOAD, TEMPERATURE, VOLTAGE, ANOMALY, COMMUNICATION
    triggering_metric VARCHAR(64) NOT NULL,
    triggering_value NUMERIC(10, 2) NOT NULL,
    threshold_value NUMERIC(10, 2) NOT NULL,
    unit VARCHAR(16) NOT NULL,
    message TEXT NOT NULL,
    recommended_action TEXT NOT NULL,
    status VARCHAR(16) DEFAULT 'ACTIVE', -- ACTIVE, ACKNOWLEDGED, RESOLVED
    created_at TIMESTAMPTZ DEFAULT NOW(),
    acknowledged_at TIMESTAMPTZ,
    resolved_at TIMESTAMPTZ,
    is_simulated BOOLEAN DEFAULT TRUE
);

CREATE INDEX IF NOT EXISTS idx_alerts_status ON alerts(status, created_at DESC);

-- 4. Maintenance Work Orders
CREATE TABLE IF NOT EXISTS maintenance_tasks (
    id VARCHAR(32) PRIMARY KEY,
    transformer_id VARCHAR(32) REFERENCES transformers(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    priority VARCHAR(16) NOT NULL, -- P1_CRITICAL, P2_HIGH, P3_MEDIUM, P4_ROUTINE
    status VARCHAR(16) DEFAULT 'OPEN', -- OPEN, IN_PROGRESS, COMPLETED, CANCELLED
    assigned_technician VARCHAR(128) NOT NULL,
    scheduled_date DATE NOT NULL,
    completed_date DATE,
    notes TEXT DEFAULT '',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    is_simulated BOOLEAN DEFAULT TRUE
);

CREATE INDEX IF NOT EXISTS idx_tasks_status ON maintenance_tasks(status, priority);
