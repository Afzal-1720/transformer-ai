# TRANSFORMER AI — Smart Grid Intelligence Platform

[![Python](https://img.shields.io/badge/Python-3.11%20%7C%203.13-blue.svg)](https://www.python.org/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.110+-009688.svg)](https://fastapi.tiangolo.com/)
[![scikit-learn](https://img.shields.io/badge/scikit--learn-1.4+-F7931E.svg)](https://scikit-learn.org/)
[![React](https://img.shields.io/badge/React-19%20%7C%20Vite-61DAFB.svg)](https://react.dev/)
[![Tailwind CSS](https://img.shields.io/badge/TailwindCSS-v4-38B2AC.svg)](https://tailwindcss.com/)
[![License](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

An industrial-grade, AI-powered transformer monitoring and decision-support platform designed for electrical engineers and grid operators. **TRANSFORMER AI** continuously evaluates transformer health, forecasts future electrical loads, detects multivariate operating anomalies using unsupervised machine learning, provides explainable composite risk scores, and calculates load-transfer contingency scenarios.

> **Academic Prototype & Simulation Notice**: This system uses synthetic, physics-consistent electrical grid telemetry. No physical sensors or high-voltage switchgear are actuated. All operational decisions must be verified by qualified electrical utility personnel.

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
                  │  • Telemetry Simulation Engine (Thermal/Ohmic Model)   │
                  │  • ML Forecasting Engine (scikit-learn Ridge/GBR)      │
                  │  • Anomaly Detection (Isolation Forest + Feature Attr) │
                  │  • Interpretable Risk Engine (Multi-Factor Scoring)    │
                  │  • Load Transfer Optimizer & Feeder Constraint Checker │
                  │  • Alert Engine (Hysteresis & Persistence Filter)      │
                  │  • In-Memory Store & Optional Supabase PostgreSQL      │
                  └────────────────────────────────────────────────────────┘
```

---

## 2. Core Functional Modules

### 1. Operations Dashboard
- **Calculated Dynamic KPIs**: Total units monitored, healthy count, attention/warning count, critical risk count, average grid loading %, and active alarms.
- **Interactive Fleet Telemetry Register**: Real-time table displaying ID, substation zone, rated capacity (kVA), active power (kW), line voltage (V), phase current (A), top oil temperature (°C), health score, risk level, and SCADA communication status. Includes searching, multi-criteria filtering, column sorting, and full CSV export.
- **Network Load & Thermal Trends**: 24-hour continuous area chart of aggregate active power demand (kW) and mean top oil temperature (°C).
- **Fleet Health & Zone Distribution**: Interactive donut chart for health status breakdown and grouped bar chart for installed vs active load by sector.
- **Automated Insights Panel**: Highlights highest loaded unit, most congested substation zone, and top-priority maintenance work order.

### 2. Live Monitoring
- **High-Frequency Engineering Telemetry**: Phase voltage, line current, active power ($P$ in kW), apparent power ($S$ in kVA), reactive power ($Q$ in kVAR), power factor ($\cos \varphi$), grid frequency (Hz), oil temperature, and hotspot winding temperature.
- **Sensor Data Quality & Fault Indicators**: Explicitly distinguishes genuine high readings from `STALE` (frozen telemetry) and `OFFLINE` (SCADA loss) states. Never replaces missing readings with zero.
- **Dynamic Time-Series Curves**: Recharts multi-channel line charts with configurable observation windows (15m, 1h, 6h, 24h).
- **Interactive Simulation Controls**: Play/Pause, speed adjustment (1x, 2x, 5x, 10x), and fleet baseline reset.
- **Demonstration Anomaly Injector**: Instant trigger for Sustained Overload (125%), Thermal Runaway (+35°C), Feeder Voltage Sag (-15%), Sensor Freeze (Stale), or RTU Loss (Offline).

### 3. AI Intelligence
- **Locally Executed Machine Learning**: Powered by scikit-learn.
- **Load Forecasting**: Multi-horizon predictions (1-Hour at 15m intervals, 6-Hours at 30m intervals, 24-Hours at 1h intervals) with dynamic 95% confidence intervals and comparison against a moving-average persistence baseline.
- **Chronological Holdout Evaluation**: Dynamic metrics display including Mean Absolute Error (MAE in kW), Root Mean Square Error (RMSE in kW), and Mean Absolute Percentage Error (MAPE %).
- **Isolation Forest Anomaly Detection**: Unsupervised multivariate pattern detection across load, temperature, power factor, and voltage drift. Provides exact feature attribution ranking (e.g. Temperature rate-of-rise: 42% contribution).
- **Explainable Fault-Risk Assessment**: 0-100 composite risk scoring decomposed into thermal stress (35%), sustained overload duration (30%), voltage stability (15%), active alarm history (10%), and telemetry data quality (10%). Accompanied by actionable utility decision-support checklists.

### 4. Load Balancing & Scenario Simulator
- **Decision Support Engine**: Interactive transfer scenario modeling between source and recipient transformers.
- **Constraint Validation**: Rejects transfers that would overload the recipient transformer (>100% rated capacity) or violate configurable safety thresholds (default 85%).
- **Pre vs. Post Comparison**: Side-by-side loading percentage comparison bar chart, remaining headroom (kVA) calculation, and pre/post operational risk delta.
- **Topology & Feeder Path**: Visual representation of the electrical distribution switching path (direct tie-lines or inter-zone ring feeder hops).

### 5. Maintenance & Asset Health Register
- **Asset Health Condition Index**: Transparent 0-100 score combining operational thermal stress penalties and aging life consumption. Includes an interactive formula breakdown modal.
- **Condition Classification**: Good, Fair, Degraded, Critical.
- **Inspection Prioritization**: P1 Critical, P2 High, P3 Medium, P4 Routine with calculated next-recommended inspection dates.
- **Work Order Lifecycle Management (CRUD)**: Create work orders, assign technicians, track statuses (`OPEN`, `IN_PROGRESS`, `COMPLETED`), record completion notes, filter, and export logs to CSV.

### 6. Intelligent Alerts & Event Management
- **Debounced Hysteresis Triggering**: Requires 2+ consecutive abnormal ticks to prevent alarm chatter from brief transients.
- **Severity Classification**: `INFO`, `WARNING`, `HIGH`, `CRITICAL`.
- **Operator Actions**: Interactive acknowledge and resolve workflows with timestamps and CSV export.

---

## 3. Technology Stack

| Layer | Technologies |
| :--- | :--- |
| **Frontend** | React 19, TypeScript, Vite, Tailwind CSS v4, Recharts, React Router v7, Lucide Icons |
| **Backend** | Python 3.11+, FastAPI, Pydantic v2, scikit-learn, NumPy, pandas, Uvicorn |
| **Testing** | Pytest, FastAPI TestClient, Vite Build Typecheck |
| **Storage** | Synchronized In-Memory Repository (Default, zero external dependency), Optional PostgreSQL / Supabase (`schema.sql`) |
| **Deployment** | Vercel (Frontend Hobby plan) + Render (Backend free Python web service) |

---

## 4. Local Quickstart (Windows PowerShell)

### Prerequisites
- Python 3.11 or higher installed (`python --version`)
- Node.js v18+ and npm installed (`node -v`)

### Step 1: Start Backend
```powershell
# In a new PowerShell terminal:
cd c:\Users\fmdaf\Documents\KR\backend

# Run automated test suite to verify ML models & endpoints:
python -m pytest tests/

# Start FastAPI development server:
python -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
```
The backend will initialize the synthetic fleet, generate 48 hours of historical telemetry, and expose:
- API Base: `http://127.0.0.1:8000`
- Interactive Swagger UI: `http://127.0.0.1:8000/docs`
- Health check: `http://127.0.0.1:8000/api/health`

### Step 2: Start Frontend
```powershell
# In a second PowerShell terminal:
cd c:\Users\fmdaf\Documents\KR\frontend

# Start Vite dev server:
npm.cmd run dev
```
Open your browser at `http://localhost:5173`. The Vite proxy will automatically route all `/api/*` requests to the local backend.

---

## 5. Automated Verification & Testing

### Backend Unit & Integration Tests
```powershell
cd backend
python -m pytest tests/ -v
```
Tests verify:
1. Physics consistency of synthetic telemetry ($P \le S$, valid power factors, temperature bounds).
2. scikit-learn autoregressive Ridge forecasting model training, inference, and holdout metric calculation.
3. Isolation Forest multivariate anomaly detection and feature attribution summation.
4. Explainable risk engine scoring (0-100) and risk category mapping.
5. Feasible load transfer simulation and overload rejection logic.
6. All REST API endpoints (`/health`, `/transformers`, `/dashboard/summary`, `/alerts`, `/predictions/forecast`, `/anomalies/detect`, `/load-balancing/simulate`, `/maintenance`).

### Frontend Production Build & Type Check
```powershell
cd frontend
npm.cmd run build
```
Builds the production bundle into `frontend/dist/` with 0 TypeScript or bundling errors.

---

## 6. Free-Tier Production Deployment Guide

You can deploy the full application publicly for free using **Vercel** (Frontend) and **Render** (Backend).

### Step 1: Push Project to GitHub
```powershell
git init
git add .
git commit -m "feat: initial commit of Transformer AI Smart Grid Intelligence Platform"
git branch -M main
git remote add origin https://github.com/<your-username>/<your-repo-name>.git
git push -u origin main
```

### Step 2: Deploy Backend to Render (Free Web Service)
1. Log into [Render.com](https://render.com) using your GitHub account.
2. Click **New +** -> **Web Service**.
3. Connect your repository.
4. Configure service settings:
   - **Name**: `transformer-ai-backend`
   - **Root Directory**: `backend`
   - **Runtime**: `Python 3`
   - **Build Command**: `pip install -r requirements.txt`
   - **Start Command**: `uvicorn app.main:app --host 0.0.0.0 --port $PORT`
   - **Plan**: Select **Free**.
5. Add Environment Variables:
   - `PYTHON_VERSION`: `3.11.8`
   - `CORS_ORIGINS`: `["*"]` (or restrict to your Vercel domain once generated)
   - `SIMULATION_INTERVAL_SEC`: `2.0`
6. Click **Deploy Web Service**.
7. Once deployed, copy your backend URL (e.g. `https://transformer-ai-backend.onrender.com`).
8. Verify by opening `https://transformer-ai-backend.onrender.com/api/health` in your browser.

> [!NOTE]
> **Render Free-Tier Spin-Down**: Free Render web services spin down after 15 minutes of inactivity. The first request after sleep may take 30–50 seconds to complete while the instance boots. Subsequent requests are instant.

### Step 3: Deploy Frontend to Vercel (Free Hobby Plan)
1. Log into [Vercel.com](https://vercel.com) using your GitHub account.
2. Click **Add New...** -> **Project** and select your repository.
3. Configure project settings:
   - **Framework Preset**: `Vite`
   - **Root Directory**: Click edit and select `frontend`.
4. Open the **Environment Variables** section and add:
   - `VITE_API_BASE_URL`: `https://transformer-ai-backend.onrender.com` (your Render backend URL from Step 2, no trailing slash).
5. Click **Deploy**.
6. Vercel will build the frontend using `npm run build` and publish it to a global CDN URL (e.g. `https://transformer-ai-app.vercel.app`).
7. Single-Page Application (SPA) routing is handled automatically by `frontend/vercel.json`.

### Step 4 (Optional): Supabase Free PostgreSQL Integration
If you wish to persist telemetry, alerts, and maintenance logs into a managed cloud database:
1. Create a free project at [Supabase.com](https://supabase.com).
2. Open the **SQL Editor** in Supabase and paste the contents of `backend/schema.sql`. Run the script to create tables and indexes.
3. In your Render backend dashboard, add the environment variable:
   `DATABASE_URL=postgresql://postgres:[PASSWORD]@[HOST]:5432/postgres`

---

## 7. License

Distributed under the MIT License. See `LICENSE` for details.
