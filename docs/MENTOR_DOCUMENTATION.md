# TRANSFORMER AI — Real-Time Transformer Monitoring, Anomaly Detection & Condition Assessment System
## Complete Technical Project Documentation & Mentor Presentation Guide

---

## 1. Project Title & Executive Summary (The "Elevator Pitch")

**System Name:** **TRANSFORMER AI — Real-Time Transformer Monitoring, Anomaly Detection & Condition Assessment System**  
**Role:** AI-Assisted Smart Grid Decision-Support & Asset Condition Evaluation Platform  
**Target Audience:** Electrical Power Engineers, Substation Operators, Grid Asset Managers, and Maintenance Technicians.

### The Problem It Solves:
Distribution transformers ($240.0\text{ V}_{\text{rms}}$ rated low-voltage distribution side) are critical, capital-intensive power delivery assets. Unplanned outages, voltage excursions, chronic overloading, and insulation overheating lead to equipment damage, premature aging, and costly localized blackouts. 
Traditional substation monitoring systems are often rigid, sounding raw alarms only when hard trip limits are breached, without offering early deviation insights, multi-tier condition assessments, or structured inspection workflows.

### The Solution:
**TRANSFORMER AI** delivers a high-precision, automated condition assessment and anomaly detection platform that:
1. **Monitors Core Electrical Parameters:** Continuously reads RMS Output Voltage ($V_{\text{rms}}$), RMS Output Current ($I_{\text{rms}}$), Winding Hotspot Temperature ($^\circ\text{C}$), and Moisture ($\% \text{ RH}$).
2. **Performs Dual Independent Voltage Assessments:**
   - **Rated Voltage Deviation Check:** Compares measured voltage against rated $240.0\text{ V}_{\text{rms}}$ using the formula:
     $$\text{Voltage Deviation } (\%) = \left(\frac{V_{\text{meas}} - V_{\text{rated}}}{V_{\text{rated}}}\right) \times 100$$
     Evaluated against permissible limits: $-10\%$ to $+6\%$.
   - **Independent Statutory Supply Voltage Check:** Validates whether measured supply falls within the government-mandated range ($216\text{ V}$ to $254\text{ V}$). Both checks are presented separately so operators understand rated performance vs statutory compliance.
3. **Assesses Output Current & Loading:** Compares measured current against rated current with a configurable $+10\%$ limit, and classifies loading into Normal ($<80\%$), High ($80\%-100\%$), or Overloaded ($>100\%$).
4. **Tracks Winding Hotspot Temperature & Moisture:** Exposes direct sensor hotspot temperature with clear thermal thresholds ($<80^\circ\text{C}$ Normal, $80-95^\circ\text{C}$ Elevated, $>95^\circ\text{C}$ Overheating). *(In accordance with electrical design principles, Top Oil $60^\circ\text{C}$ and Average Winding $65^\circ\text{C}$ temperature baselines are design ratings and are omitted from live telemetry).*
5. **Detects Dedicated Anomalies with Debouncing:** Identifies Over-voltage, Under-voltage, Over-current, Hotspot Overheating, and Sudden Load Variations (surges or drops $>25\%$ against rolling baseline), suppressing duplicate alert spam.
6. **Classifies Transformer Condition into 4 Tiers:** Evaluates Sensor Connectivity, Voltage Behaviour, Loading Condition, and Thermal Condition to assign an Overall Status: `Healthy`, `Warning`, `Critical`, or `Inspection Required`.
7. **Drives Inspection & Maintenance Workflows:** Automatically recommends technical inspections for abnormal readings or fluctuations (distinguishing abnormal telemetry from confirmed physical breakdown), tracking work orders from `Pending` $\rightarrow$ `Acknowledged` $\rightarrow$ `Completed`.
8. **Built for Future Hardware Telemetry:** Features clearly documented API endpoints and frontend hooks ready to connect directly to physical IoT sensor edge gateways.

---

## 2. Technology Stack Breakdown & Architecture

| Layer | Technologies | Justification & Architectural Role |
| :--- | :--- | :--- |
| **Frontend Framework** | **React 19 + TypeScript + Vite** | Component-driven architecture, type safety matching backend Pydantic models, sub-second HMR development, and optimized production bundle. |
| **Styling & Design System** | **Tailwind CSS v4** | Industrial SCADA dark theme (`#020617` surface, charcoal `#0f172a` panels, electric cyan `#00F2FE` accents, amber `#f59e0b` warnings, rose `#ef4444` alarms). Fully responsive with focus states. |
| **Data Visualization** | **Recharts (SVG)** | Time-series charts for $V_{\text{rms}}$, $I_{\text{rms}}$, hotspot temperature, and moisture dynamics with reference lines for statutory and rated thresholds. |
| **Navigation & Routing** | **React Router v7** | Single-page application (SPA) routing across the 4 core views: `/`, `/monitoring`, `/anomalies`, and `/maintenance`. |
| **Backend Framework** | **FastAPI (Python 3.11 / 3.13)** | High-throughput asynchronous REST API, automated OpenAPI/Swagger interactive documentation (`/docs`), and Pydantic v2 schemas. |
| **Data Processing & Physics** | **NumPy, pandas** | Physics calculations, rolling baselines, voltage standard deviations, and telemetry transformations. |
| **Testing & Quality** | **Pytest + TestClient** | Automated regression testing covering all mathematical deviation formulas, statutory checks, anomaly generators, and REST routes. |
| **Data Storage** | **Synchronized In-Memory Store** | Thread-safe in-memory cache pre-populated with 8 transformers (`TX-001` through `TX-008`), historical telemetry buffers, active anomalies, and inspection work orders. Optional PostgreSQL schema included. |

---

## 3. How the Live Telemetry & Simulation Works

Because this academic/demo system is not connected to dangerous $11\text{ kV} / 240\text{ V}$ physical equipment, the backend runs an asynchronous **physics-informed synthetic telemetry generator**:

```
 ┌─────────────────────────────────────────────────────────────┐
 │       FastAPI Lifespan Async Background Task (Tick Loop)    │
 │       Runs every 2.0s / speed_multiplier (1x to 10x)        │
 └──────────────────────────────┬──────────────────────────────┘
                                │
                                ▼
 ┌─────────────────────────────────────────────────────────────┐
 │           PHYSICS-INFORMED TELEMETRY GENERATOR              │
 │                                                             │
 │ 1. Rated Specifications:                                    │
 │    - All units rated at V_rated = 240.0 Vrms                │
 │    - S_rated = 25 kVA to 100 kVA                            │
 │    - I_rated = (S_rated * 1000) / 240.0 Arms (e.g. 104.2 A) │
 │                                                             │
 │ 2. Voltage Physics:                                         │
 │    - Base voltage: 240.0 V ± diurnal grid fluctuations      │
 │    - Internal impedance drop: ΔV = f(Load Ratio)            │
 │                                                             │
 │ 3. Current & Sudden Variation Engine:                       │
 │    - Base current follows daily load demand                 │
 │    - Rolling 10-point baseline maintained                   │
 │    - Injected or stochastic surges > 25% trigger            │
 │      "Sudden Load Variation" with % change computed         │
 │                                                             │
 │ 4. Winding Hotspot Temperature:                             │
 │    - Direct sensor reading: T_hotspot = T_amb + ΔT(Load)^1.8│
 │    - Hotspot monitored: <80°C Normal, 80-95°C Elevated,     │
 │      >95°C Overheating alarm.                               │
 │    - Design baselines (Top Oil 60°C, Avg Winding 65°C) are  │
 │      internal design values and strictly omitted from live  │
 │      telemetry displays per standard guidelines.            │
 │                                                             │
 │ 5. Dielectric Moisture:                                     │
 │    - Moisture monitored in % RH (Acceptable <35% RH)        │
 └──────────────────────────────┬──────────────────────────────┘
                                │
                                ▼
 ┌─────────────────────────────────────────────────────────────┐
 │          CONDITION EVALUATOR & ANOMALY DETECTOR             │
 │                                                             │
 │ - Evaluates Voltage Deviation: (V - 240) / 240 * 100        │
 │ - Evaluates Statutory Supply Range: 216 V to 254 V          │
 │ - Evaluates Current Deviation & Configured +10% Limit       │
 │ - Evaluates Thermal Hotspot Condition                       │
 │ - Evaluates 4 Operating Dimensions:                         │
 │   1. Sensor Connectivity (Online / Stale / Offline)         │
 │   2. Voltage Behaviour (Stable / Fluctuating / Over / Under)│
 │   3. Loading Condition (Normal / High / Overloaded)         │
 │   4. Thermal Condition (Normal / Elevated / Overheating)    │
 │ - Synthesizes Overall Condition:                            │
 │   HEALTHY | WARNING | CRITICAL | INSPECTION_REQUIRED        │
 │ - Auto-generates Inspection Orders on Abnormal Readings     │
 │ - Debounces alerts to prevent repetitive spam               │
 └──────────────────────────────┬──────────────────────────────┘
                                │ HTTP Polling (every 2.5s)
                                ▼
 ┌─────────────────────────────────────────────────────────────┐
 │             FRONTEND REACT APPLICATION (SPA)                │
 │  - Real-time updates without full-page reloads              │
 │  - Simulation badge clearly identifying "MOCK DATA MODE"    │
 └─────────────────────────────────────────────────────────────┘
```

---

## 4. Comprehensive Page-by-Page & Section-by-Section Breakdown

The application is structured into **four focused, purpose-built pages**:

### Page 1: Dashboard (`/`)
*The fleet-wide operational nerve center giving operators an immediate overview of all transformers.*

- **Top Navigation & Controls:** Grid simulation clock, pause/resume button, speed multiplier ($1\times, 2\times, 5\times, 10\times$), fleet reset, and active alerts drawer button.
- **Hardware Integration Banner:** Explains that the platform is currently operating in simulated sensor mode, with clear references to the hardware API endpoint (`POST /api/transformers/{id}/telemetry`).
- **Fleet KPI Metric Cards:**
  1. *Monitored Transformers:* Total monitored units (8) and online sensor count.
  2. *Inspection Required:* Live count of transformers exhibiting abnormal readings or fluctuations.
  3. *Critical Alerts:* Count of active critical threshold excursions.
  4. *Avg Fleet Load:* Mean capacity utilization across all units.
  5. *Pending Inspections:* Work orders awaiting technician assignment or dispatch.
- **Fleet Health Status Bar:** Synthesizes overall fleet condition (`Healthy`, `Warning`, `Critical`, `Inspection Required`) with an explanatory narrative and a color-coded unit count breakdown.
- **Interactive Transformer Overview Table:**
  - *Search & Filter Bar:* Filter by Substation, Overall Condition, or search by ID/Name.
  - *Transformer Identifier:* Shows ID, Name, Substation.
  - *Voltage ($V_{\text{rms}}$) & Deviation %:* Displays measured voltage and $((V_{\text{meas}} - 240) / 240) \times 100$.
  - *Statutory Range (216V–254V):* Displays independent compliance status with government permissible supply boundaries.
  - *Current ($I_{\text{rms}}$) & Deviation %:* Compares measured current against rated current and configured $+10\%$ limit.
  - *Loading % & Status:* Indicates percentage utilization and status (Normal, High, Overloaded).
  - *Winding Hotspot Temperature:* Displays direct sensor hotspot reading and thermal status.
  - *Moisture:* Telemetry in $\% \text{ RH}$.
  - *Overall Condition Badge:* Color-coded status badge.
  - *Inspection Flag:* Highlights "REQUIRED" for abnormal readings.
  - *Actions:* Quick "Monitor" button linking directly to `/monitoring?tx={id}`.
  - *Export CSV:* Instant download of the full fleet condition snapshot.
- **24-Point Fleet Telemetry Trend Chart:** Recharts multi-line graph showing historical fleet average voltage ($V_{\text{rms}}$), current ($I_{\text{rms}}$), and winding hotspot temperature ($^\circ\text{C}$).
- **Recent Abnormal Conditions Panel:** Chronological list of recent alerts, triggering metrics, thresholds, and context-specific operator actions.

---

### Page 2: Live Monitoring (`/monitoring`)
*High-precision unit-level diagnostics and real-time waveform inspection for a selected transformer.*

- **Transformer Selector Strip:** Fast horizontal tab bar to switch between `TX-001` through `TX-008`, displaying live status dots. Synchronizes with URL query parameter (`?tx=TX-001`).
- **Active Anomaly & Sensor Health Banners:** Alerts operators if a simulated anomaly is currently injected or if sensor connectivity is `STALE` or `OFFLINE`.
- **Unit Technical Nameplate Strip:** Displays transformer rating details: Substation, Rated Capacity (kVA), Cooling Type (ONAN), Year Installed, Rated Voltage ($240.0\text{ V}_{\text{rms}}$), and Rated Current ($I_{\text{rms}}$).
- **Core Electrical Parameter Cards:**
  1. **Output Voltage ($V_{\text{rms}}$) Card:**
     - Measured RMS Voltage.
     - Rated Voltage ($240.0\text{ V}_{\text{rms}}$).
     - **Check 1: Voltage Deviation Check:** Displays percentage deviation evaluated against $-10\%$ to $+6\%$.
     - **Check 2: Statutory Supply Range Check:** Independent assessment against $216\text{ V} - 254\text{ V}$ permissible supply boundaries.
  2. **Output Current ($I_{\text{rms}}$) Card:**
     - Measured RMS Current.
     - Rated Current (e.g., $104.2\text{ Arms}$).
     - Current Deviation % evaluated against configured $+10\%$ overcurrent threshold.
     - Load utilization percentage and loading category.
  3. **Winding Hotspot Temperature Card:**
     - Measured Hotspot Temperature ($^\circ\text{C}$) directly from sensor.
     - Thermal condition: Normal ($<80^\circ\text{C}$), Elevated ($80-95^\circ\text{C}$), Overheating ($>95^\circ\text{C}$).
     - Engineering notice stating that Top Oil ($60^\circ\text{C}$) and Average Winding ($65^\circ\text{C}$) are design baselines and omitted from live telemetry.
  4. **Moisture & Operator Recommendation Card:**
     - Measured moisture in $\% \text{ RH}$ with dielectric health check.
     - Plain-language operator recommendation.
     - Inspection requirement flag.
- **Live Recharts Telemetry Curves:**
  1. *Voltage Curve ($V_{\text{rms}}$):* Time-series line chart with visual reference lines for Rated $240\text{ V}$, Statutory Min $216\text{ V}$, and Statutory Max $254\text{ V}$.
  2. *Current Curve ($I_{\text{rms}}$):* Time-series line chart with reference lines for Rated Current and the $+10\%$ Overcurrent limit.
  3. *Thermal & Moisture Dynamics:* Synchronized dual-axis plot of Winding Hotspot Temperature ($^\circ\text{C}$) and Moisture ($\% \text{ RH}$) with thermal threshold boundaries.
- **Data Export & Range Selector:** Operators can choose time-series windows (30, 60, or 120 ticks) and export the raw telemetry stream as CSV.

---

### Page 3: Anomaly Detection & Condition Assessment (`/anomalies`)
*Automated reasoning engine that identifies electrical anomalies and evaluates overall transformer health.*

- **Transformer Selector:** Select any fleet unit to review its condition diagnostics.
- **Simulate / Inject Anomaly Modal:** Allows live injection of any anomaly (Over-voltage, Under-voltage, Over-current, Hotspot Overheating, Sudden Load Variation) to test system detection and alert generation.
- **Section 1: Overall Condition Assessment Banner:**
  - Overall Condition Badge: `Healthy`, `Warning`, `Critical`, or `Inspection Required`.
  - Condition Diagnostic Summary: Plain-language explanation of why this state was assigned.
  - Recommended Operator Action: Exact electrical action prescribed for this condition.
  - Telemetry Snapshot table summarizing all current metrics.
- **Section 2: 4-Tier Operating Dimension Breakdown:**
  1. *Sensor Connectivity:* Evaluates heartbeat and latency (`ONLINE`, `STALE`, `OFFLINE`).
  2. *Voltage Behaviour:* Detects voltage stability, rapid standard-deviation fluctuations ($>4\text{ V}$), and deviation extremes (`STABLE`, `FLUCTUATING`, `UNDER_VOLTAGE`, `OVER_VOLTAGE`).
  3. *Loading Condition:* Evaluated against rated current capacity (`NORMAL`, `HIGH_LOADING`, `OVERLOADED`).
  4. *Thermal Condition:* Evaluates winding hotspot temperature (`NORMAL`, `ELEVATED`, `OVERHEATING`).
- **Section 3: Active Detected Anomalies List:**
  - Real-time table of detected anomalies.
  - Displays Anomaly Name, Severity (`Critical`, `Warning`, `Informational`), Parameter, Measured Value, Threshold, Fluctuation Rate %, Timestamp, and Operator Action.
  - "Create Inspection Order" one-click button to immediately dispatch a work order for this anomaly.
- **Section 4: Advanced Detection Modules:**
  - *Sudden Load Variation Engine:* Shows rolling 10-point baseline monitoring and sudden shift detection ($\pm 25\%$) with debouncing.
  - *Phase Imbalance Status:* Clearly marked as **"FEATURE DISABLED"** with an engineering explanation that single-phase RMS hardware telemetry only is provided, and synthetic phase data is not fabricated.

---

### Page 4: Inspection & Maintenance (`/maintenance`)
*Field dispatch and work order tracking module for on-site technicians and grid asset managers.*

- **Operational Guideline Banner:** Highlights that abnormal telemetry readings or fluctuations warrant an **on-site technical inspection** to check tap changers, terminal bushings, and cooling radiators, and do not necessarily mean internal transformer failure.
- **Inspection Metric Cards:** Units requiring inspection, Pending work orders, Acknowledged/In Progress orders, and Completed/Signed-off records.
- **Inspection Work Order Register:**
  - Searchable and filterable by Transformer ID, Status (`Pending`, `Acknowledged`, `Completed`), and Priority (`Critical`, `High`, `Medium`, `Routine`).
  - Columns: Order ID, Unit, Priority, Status Badge, Reason for Inspection, Recommended Action, Assigned Crew, Detection & Completion Timestamps, and Actions.
- **Operator Workflow Actions:**
  1. *Acknowledge Button:* Moves status from `Pending` to `Acknowledged` and timestamps the operator triage.
  2. *Sign Off / Complete Modal:* Opens a modal for technicians to submit final field findings and marks the work order `Completed`.
  3. *Create Inspection Work Order Modal:* Allows operators to manually dispatch a custom work order for any unit.
- **Export CSV:** Complete audit export of maintenance history.

---

## 5. Mathematical Formulas & Electrical Standards Reference

### A. Voltage Deviation Formula
$$\text{Voltage Deviation } (\%) = \left(\frac{V_{\text{meas}} - V_{\text{rated}}}{V_{\text{rated}}}\right) \times 100$$
- $V_{\text{rated}} = 240.0\text{ V}_{\text{rms}}$
- **Permissible Range:** $-10.0\%$ to $+6.0\%$
  - $[-10\%, +6\%]$: "Within Permissible Deviation" (Normal)
  - $< -10\%$: "Under-Voltage Deviation Alert"
  - $> +6\%$: "Over-Voltage Deviation Alert"

### B. Statutory Supply Voltage Limits
Independent statutory regulatory check:
- $216.0\text{ V} \le V_{\text{meas}} \le 254.0\text{ V}$: "Normal Permissible Supply Range"
- $V_{\text{meas}} < 216.0\text{ V}$: "Under-Voltage Warning"
- $V_{\text{meas}} > 254.0\text{ V}$: "Over-Voltage Warning (Not Permitted)"

### C. Current Deviation Formula
$$\text{Current Deviation } (\%) = \left(\frac{I_{\text{meas}} - I_{\text{rated}}}{I_{\text{rated}}}\right) \times 100$$
- $I_{\text{rated}} = \frac{S_{\text{rated}} \times 1000}{V_{\text{rated}}}$
- **Configured Current Threshold:** $+10.0\%$ above rated current. Exceeding this triggers an Over-Current alert.

### D. Loading Utilization Percentage
$$\text{Loading } (\%) = \left(\frac{I_{\text{meas}}}{I_{\text{rated}}}\right) \times 100$$
- $< 80\%$: Normal
- $80\% - 100\%$: High Loading
- $> 100\%$: Overloaded

### E. Thermal Classification (Winding Hotspot)
- $< 80.0^\circ\text{C}$: Normal Thermal Condition
- $80.0^\circ\text{C} - 95.0^\circ\text{C}$: Elevated Temperature
- $> 95.0^\circ\text{C}$: Overheating Alarm

### F. Sudden Load Variation
$$\text{Variation } (\%) = \left(\frac{I_{\text{current}} - I_{\text{baseline}}}{I_{\text{baseline}}}\right) \times 100$$
- Threshold: $|\text{Variation}| \ge 25.0\%$ evaluated against a 10-point rolling current baseline.

---

## 6. Future Hardware Integration Architecture

The platform is designed to transition from mock/simulated telemetry to real hardware sensors (e.g., current transformers, voltage transducers, PT100 temperature probes, and capacitive moisture sensors connected via an ESP32, Raspberry Pi, or industrial edge SCADA gateway):

```
 [ Physical Transformer ] 
         │
         ├── PT100 Temperature Probe (Winding Hotspot)
         ├── Rogowski Coil / CT (RMS Current Arms)
         ├── Voltage Transducer (RMS Voltage Vrms)
         └── Dielectric RH Sensor (Moisture % RH)
         │
         ▼
 [ Industrial IoT / Edge Gateway ]
         │ (HTTP POST or MQTT with JSON payload)
         ▼
 [ FastAPI Hardware Endpoint: POST /api/transformers/{id}/telemetry ]
         │
         ▼
 [ Condition Evaluator & Anomaly Engine ] ──► [ React Operator Dashboard ]
```

### Hardware Payload Schema:
```json
{
  "transformer_id": "TX-001",
  "vrms": 238.4,
  "irms": 88.2,
  "winding_hotspot_temperature": 76.5,
  "moisture": 22.4,
  "sensor_status": "ONLINE"
}
```

---

## 7. How to Run & Present the Demo to Your Mentor

### Step 1: Start the Backend Server
```powershell
cd backend
python -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
```
Interactive API documentation is accessible at: `http://127.0.0.1:8000/docs`.

### Step 2: Start the Frontend Application
```powershell
cd frontend
npm run dev
```
Open `http://localhost:5173` in your browser.

### Step 3: Run the Automated Backend Pytest Suite
```powershell
cd backend
python -m pytest tests/
```
*(Demonstrates 6/6 automated test suites verifying mathematical formulas, statutory checks, and condition evaluations).*

### Step 4: Suggested Mentor Walkthrough Flow
1. **Show the Dashboard (`/`):** Point out the KPI cards, the dual voltage checks (rated deviation vs statutory 216V-254V), and the live fleet table.
2. **Open Live Monitoring (`/monitoring`):** Select a transformer, show the dual independent voltage checks, the live Recharts curves with statutory reference lines, and note that only winding hotspot temperature is displayed.
3. **Open Anomaly & Condition (`/anomalies`):** Click **"Simulate / Inject Anomaly"**, select an Over-voltage or Sudden Load Variation anomaly, and show how the condition evaluator immediately detects it, highlights the percentage change, and provides a recommended action.
4. **Trigger Inspection Order:** Click **"Create Inspection Order"** on the detected anomaly to transition directly to the **Inspection & Maintenance (`/maintenance`)** page.
5. **Complete the Work Order:** On the Inspection page, click **"Acknowledge"**, then click **"Sign Off / Complete"**, enter technician notes, and show how the record is signed off with timestamped audit history.
6. **Export Data:** Click **"Export CSV"** on any page to show the audit trail ready for grid asset management reporting.
