# TRANSFORMER AI — Real-Time Transformer Monitoring, Anomaly Detection & Condition Assessment System

[![Python](https://img.shields.io/badge/Python-3.11%20%7C%203.13-blue.svg)](https://www.python.org/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.110+-009688.svg)](https://fastapi.tiangolo.com/)
[![React](https://img.shields.io/badge/React-19%20%7C%20Vite-61DAFB.svg)](https://react.dev/)
[![Tailwind CSS](https://img.shields.io/badge/TailwindCSS-v4-38B2AC.svg)](https://tailwindcss.com/)
[![License](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

An industrial-grade, AI-assisted transformer monitoring, anomaly detection, and condition assessment platform designed for electrical engineers and grid operators. **TRANSFORMER AI** continuously compares rated vs measured electrical parameters, detects abnormal voltage/current fluctuations and hotspot overheating, assesses 4-tier condition health, and tracks inspection work orders.

> **Academic Prototype & Simulation Notice**: This system uses simulated sensor telemetry. It is designed so that real-time hardware sensor data can be seamlessly integrated through documented FastAPI endpoints (`POST /api/transformers/{id}/telemetry`). Current readings are clearly identified as mock telemetry.

---

## 1. System Architecture

```
                  ┌────────────────────────────────────────────────────────┐
                  │           React 19 + Vite + TypeScript (SPA)           │
                  │  Tailwind CSS v4 • Recharts • Lucide • Dark Industrial  │
                  └───────────────┬──────────────────────▲─────────────────┘
                                  │ HTTP / REST          │ Live Telemetry
                                  ▼                      │ Polling (2.5s)
                  ┌──────────────────────────────────────┴─────────────────┐
                  │                 FastAPI REST Backend                   │
                  │   Pydantic Validation • CORS • Swagger Docs (/docs)    │
                  ├────────────────────────────────────────────────────────┤
                  │  • Telemetry Physics Simulation (240.0 Vrms, Arms)     │
                  │  • Dual Independent Voltage Assessment Engine          │
                  │    1. Rated Deviation (-10% to +6%)                    │
                  │    2. Statutory Supply Range (216V to 254V)            │
                  │  • Current Deviation & Loading Evaluation              │
                  │  • Winding Hotspot Thermal Engine (<80°C, 80-95°, >95°)│
                  │  • Sudden Load Variation Detector (Rolling Baseline)   │
                  │  • 4-Tier Condition Evaluator (Healthy/Warn/Crit/Insp) │
                  │  • Inspection & Maintenance Work Order Tracker         │
                  │  • Hardware API Gateway Placeholder Endpoints          │
                  └────────────────────────────────────────────────────────┘
```

---

## 2. Four Purpose-Built Application Pages

### 1. Operations Dashboard (`/`)
- **Fleet KPIs:** Monitored transformers (8 units), online sensors, transformers requiring inspection, active critical alerts, and average fleet load %.
- **Fleet Operating Health Status Bar:** Synthesizes overall fleet condition (`Healthy`, `Warning`, `Critical`, `Inspection Required`) with detailed diagnostic narrative.
- **Fleet Condition Table:** Searchable and filterable table displaying Rated vs Measured $V_{\text{rms}}$, Voltage Deviation %, Statutory Range Check ($216\text{ V}-254\text{ V}$), Measured $I_{\text{rms}}$, Current Deviation %, Loading %, Winding Hotspot Temperature, Moisture, Condition Badge, and Inspection Flag.
- **24-Point Fleet Telemetry Trend Chart:** Recharts multi-line graph of average voltage, current, and hotspot temperature.
- **Recent Abnormal Conditions Panel:** Chronological list of recent alerts with context-specific recommended operator actions.
- **CSV Data Export:** One-click download of fleet status.

### 2. Live Monitoring (`/monitoring`)
- **Transformer Selector:** Quick switcher across `TX-001` through `TX-008` with URL parameter synchronization (`?tx=TX-001`).
- **Sensor Connectivity Health:** Status banner for `ONLINE`, `STALE`, or `OFFLINE` sensor states.
- **Dual Independent Voltage Checks:**
  1. *Voltage Deviation % Check:* $((V_{\text{meas}} - V_{\text{rated}}) / V_{\text{rated}}) \times 100$ against $-10\%$ to $+6\%$ limits.
  2. *Statutory Supply Range Check:* Evaluates $216\text{ V} - 254\text{ V}$ government permissible supply boundaries independently.
- **Current & Load Analysis:** Compares measured current against rated current with a configurable $+10\%$ limit and loading condition category.
- **Winding Hotspot Temperature & Moisture:** Direct sensor hotspot temperature ($<80^\circ\text{C}$ Normal, $80-95^\circ\text{C}$ Elevated, $>95^\circ\text{C}$ Overheating) and moisture (% RH). *(Top Oil 60°C and Average Winding 65°C are design baselines and omitted from live telemetry).*
- **Live Recharts Curves:** Time-series waveforms with statutory boundary reference lines (216V, 240V, 254V, Rated Current, +10% limit).

### 3. Anomaly Detection & Condition Assessment (`/anomalies`)
- **Overall Condition Assessment Banner:** Synthesizes condition into `Healthy`, `Warning`, `Critical`, or `Inspection Required` with clear plain-language explanation and recommended actions.
- **4-Tier Operating Dimension Breakdown:**
  1. *Sensor Connectivity:* Online / Stale / Offline
  2. *Voltage Behaviour:* Stable / Fluctuating / Under-Voltage / Over-Voltage
  3. *Loading Condition:* Normal (<80%) / High Loading (80-100%) / Overloaded (>100%)
  4. *Thermal Condition:* Normal (<80°C) / Elevated (80-95°C) / Overheating (>95°C)
- **Active Anomalies Register:** Identifies Over-voltage, Under-voltage, Over-current, Overheating, and Sudden load variation with measured values, thresholds, and detection times.
- **Sudden Load Variation Engine:** Detects rapid current surges or drops exceeding $\pm 25\%$ compared to a rolling 10-point baseline, debounced to avoid duplicate alert spam.
- **Phase Imbalance Status:** Clearly marked as *Feature Disabled* because hardware streams single-phase RMS telemetry, maintaining engineering integrity.
- **Interactive Anomaly Simulator:** Inject/test any anomaly to observe real-time detection and inspection order generation.

### 4. Inspection & Maintenance (`/maintenance`)
- **Operational Advisory:** Clearly distinguishes abnormal sensor readings from confirmed transformer breakdown, highlighting that technical inspections are warranted before disconnecting units.
- **Work Order Management:** Full tracking of inspection work orders from `Pending` $\rightarrow$ `Acknowledged` $\rightarrow$ `Completed`.
- **Operator Actions:** One-click Acknowledge, Sign Off / Complete modal with technician findings, and manual inspection work order creator.
- **Export Audit Log:** Export full inspection history to CSV.

---

## 3. Mathematical Formulas

### Voltage Deviation Percentage
$$\text{Voltage Deviation } (\%) = \left(\frac{V_{\text{meas}} - V_{\text{rated}}}{V_{\text{rated}}}\right) \times 100$$
- $V_{\text{rated}} = 240.0\text{ V}_{\text{rms}}$
- Permissible Limits: $-10.0\%$ to $+6.0\%$

### Statutory Supply Voltage Range
- $216.0\text{ V} \le V_{\text{meas}} \le 254.0\text{ V}$: Normal Permissible Supply Range
- $V_{\text{meas}} < 216.0\text{ V}$: Under-Voltage Warning
- $V_{\text{meas}} > 254.0\text{ V}$: Over-Voltage Warning

### Current Deviation Percentage
$$\text{Current Deviation } (\%) = \left(\frac{I_{\text{meas}} - I_{\text{rated}}}{I_{\text{rated}}}\right) \times 100$$
- Configured Limit: $+10.0\%$ above rated current.

---

## 4. Quick Start

### 1. Backend Setup & Startup
```powershell
cd backend
python -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
```
Swagger API Documentation: `http://127.0.0.1:8000/docs`

### 2. Frontend Setup & Startup
```powershell
cd frontend
npm install
npm run dev
```
Client Application: `http://localhost:5173`

### 3. Run Automated Tests
```powershell
cd backend
python -m pytest tests/
```
*(6/6 automated test suites passing)*

---

## 5. Future Hardware Integration

Hardware IoT sensors (e.g. ESP32, Arduino, Raspberry Pi, Modbus/RS485 edge gateway) can ingest live electrical telemetry directly via:
```http
POST /api/transformers/{id}/telemetry
Content-Type: application/json

{
  "transformer_id": "TX-001",
  "vrms": 238.4,
  "irms": 88.2,
  "winding_hotspot_temperature": 76.5,
  "moisture": 22.4,
  "sensor_status": "ONLINE"
}
```
All endpoints and frontend services include documented integration comments and placeholders.
