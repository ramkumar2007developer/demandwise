# 📊 DemandWise 2.0 — AI-Powered Business Location Intelligence & Feasibility Platform

[![Python 3.12+](https://img.shields.io/badge/Python-3.12+-3776AB?style=flat&logo=python&logoColor=white)](https://www.python.org/)
[![FastAPI 0.110+](https://img.shields.io/badge/FastAPI-0.110+-009688?style=flat&logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com/)
[![scikit-learn 1.5+](https://img.shields.io/badge/scikit--learn-1.5+-F7931E?style=flat&logo=scikit-learn&logoColor=white)](https://scikit-learn.org/)
[![React 18+](https://img.shields.io/badge/React-18+-61DAFB?style=flat&logo=react&logoColor=black)](https://react.dev/)
[![TypeScript 5+](https://img.shields.io/badge/TypeScript-5.0+-3178C6?style=flat&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Vite 5+](https://img.shields.io/badge/Vite-5.0+-646CFF?style=flat&logo=vite&logoColor=white)](https://vitejs.dev/)
[![Tests 180 Passing](https://img.shields.io/badge/Tests-180%20Passing-2ea44f?style=flat&logo=pytest&logoColor=white)]()
[![License MIT](https://img.shields.io/badge/License-MIT-0366d6?style=flat)](LICENSE)
[![Status Active](https://img.shields.io/badge/Status-Phase%206%20--%20Active-orange?style=flat)]()

A commercial-grade, research-quality AI platform for urban business feasibility, demand forecasting, real-time competitor discovery, and financial risk assessment in **Coimbatore, Tamil Nadu**. DemandWise 2.0 fuses geospatial OpenStreetMap live POI intelligence with machine-learning demand regression and rule-based budget simulation, then gates predictions through a bilingual LLM synthesis layer — delivering both quantitative feasibility metrics and structured, human-readable operational briefings in **English** and **Tamil**.

**Interactive Web Application**: [http://localhost:5173](http://localhost:5173) &bull; **API Documentation**: [http://127.0.0.1:8000/docs](http://127.0.0.1:8000/docs)

---

## ✨ Key Features

- 🗺️ **Real-Time OSM Overpass Competitor Discovery**: Live radial POI search (up to 2 km) with automated multi-mirror failover across public Overpass endpoints, Haversine proximity ranking, and strict zero-fabrication guarantees.
- 📈 **Calibrated ML Demand Forecasting**: Supervised scikit-learn regression pipeline estimating monthly visit volume indices based on business classification, floor area, pedestrian footfall density, competitor saturation, and campus proximity.
- 💰 **Independent Financial Feasibility Engine**: Deterministic startup budgeting that computes itemized setup costs, commercial equipment, advance rent, working capital, and variance (Surplus / Feasible / Deficit) independent of the ML model.
- 🤖 **Bilingual Natural Language Strategy Engine**: Synthesizes spatial dynamics, competitor barriers, and financial viability into structured operational recommendations in English and Tamil with zero-hallucination guardrails and deterministic fallback.
- 📍 **Multi-Location Spatial Comparison**: Side-by-side multi-site matrix comparing candidate zones across investment feasibility, competitor density, and relative demand ranking.
- 📄 **Executive PDF Report Generator**: Client-side A4 report generation with high-contrast executive styling, multi-page pagination, full Tamil Unicode shaping (Mukta Malar font), and complete cost breakdown tables.
- 🧪 **180/180 Tests Passing**: Comprehensive test coverage across pytest (124 backend tests covering Overpass failover, geocoding, boundary checks, ML inference, and orchestration) and Vitest (56 frontend tests covering UI workflows and PDF generation).
- 🔒 **Leakage-Free Data & Security Architecture**: Backend-enforced API key encapsulation (Groq / OpenAI keys never exposed to browser), strict Coimbatore geo-bounding box validation (`10.85°N–11.20°N`, `76.80°E–77.20°E`), and input sanitization.

---

## 🏗️ System Architecture & Orchestration

The Phase 5 orchestrator (`app/services/orchestrator.py`) executes a sequential, fault-tolerant business analysis pipeline at `POST /api/analysis`:

```
User Input (Location, Category, Budget, Floor Area, Proximity)
   │
   ├──▶ [Stage 1: Budget Feasibility]
   │       └── Deterministic startup cost breakdown & surplus/deficit rating
   │
   ├──▶ [Stage 2: Competitor Place Search (OpenStreetMap)]
   │       └── Multi-mirror Overpass query, Haversine distance, deduplication
   │
   ├──▶ [Stage 3: ML Demand Prediction (scikit-learn)]
   │       └── RandomForestRegressor inference for monthly visit index
   │
   └──▶ [Stage 4: Bilingual Strategy Synthesis (LLM)]
           └── English / Tamil operational briefing (Groq/OpenAI with template fallback)
                   │
                   ▼
         Aggregated JSON Response + Stage Latency Metrics
```

---

## 🗺️ Spatial Service Distinction Architecture

DemandWise clearly distinguishes between three fundamentally different spatial services:

1. **Map Tiles (Display Layer)**:
   - Rendered $256 \times 256$ pixel raster tiles (`https://tile.openstreetmap.org/{z}/{x}/{y}.png`).
   - Purpose: Visual map canvas in Leaflet. Tiles do **not** provide POI lists or search data.
2. **Geocoding (Address $\leftrightarrow$ Coordinate Layer)**:
   - Forward and reverse geocoding via Nominatim for coordinate resolution.
3. **Place Search (Spatial POI Layer — Implemented in Phase 3)**:
   - Structured spatial queries retrieving points-of-interest based on tags, categories (`cafe`, `hotel`, `retail`), and radial proximity around coordinates.
   - Handled via OpenStreetMap Overpass API (`/api/interpreter`) with sequential mirror failover.

---

## 📁 Project Directory Structure

```text
demandwise2.0/
├── app/
│   ├── main.py              # FastAPI application factory & CORS configuration
│   ├── config.py            # Environment settings with pydantic-settings
│   ├── api/
│   │   └── routes.py        # /api/health, /api/predict, /api/competitors, /api/analysis
│   ├── core/
│   │   ├── exceptions.py    # Standardized JSON exception handlers
│   │   └── geo.py           # Coimbatore bounding box validation & Haversine math
│   ├── services/
│   │   ├── orchestrator.py  # End-to-end pipeline orchestration & observability
│   │   ├── competitors.py   # OSM Overpass client with mirror failover & cache
│   │   ├── budget.py        # Independent startup budget feasibility model
│   │   └── llm.py           # Bilingual LLM explanation service with fallback
│   └── schemas/
│       ├── analysis.py      # Full analysis request/response data contracts
│       ├── competitors.py   # Competitor item & search schemas
│       ├── budget.py        # Budget line items & feasibility categories
│       └── explain.py       # Explanation context & LLM output schemas
├── ml/
│   ├── dataset.py           # Synthetic dataset generator & schema validator
│   ├── features.py          # Shared feature engineering pipeline
│   ├── train.py             # RandomForest model training CLI
│   ├── predict.py           # ML inference engine
│   └── evaluate.py          # Spatial-group validation metrics (MAE/RMSE)
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── DashboardModal.tsx       # Main analytics & control modal
│   │   │   ├── LocationComparison.tsx   # Multi-site side-by-side comparison
│   │   │   └── MapView.tsx              # Interactive Leaflet map canvas
│   │   ├── services/
│   │   │   ├── api.ts                   # Typed Axios API client
│   │   │   └── reportGenerator.ts       # Executive A4 PDF export engine
│   │   └── assets/fonts/
│   │       ├── MuktaMalar-Regular.ttf   # Embedded Latin + Tamil Unicode font
│   │       └── tamilFont.ts             # Base64-encoded font asset
│   └── package.json
├── tests/                   # 124 backend unit & integration tests
├── requirements.txt         # Pinned Python package dependencies
└── README.md                # Project documentation
```

---

## ⚡ Quick Start & Running Commands

### 1. Backend Server (FastAPI)

```powershell
# Navigate to the project root directory:
cd c:\Users\Hp\OneDrive\Desktop\demandwise2.0

# Activate virtual environment:
.\.venv\Scripts\Activate.ps1

# Run the FastAPI backend server:
.\.venv\Scripts\python.exe -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
```

- **Interactive API Documentation (Swagger)**: [http://127.0.0.1:8000/docs](http://127.0.0.1:8000/docs)
- **Alternative Documentation (ReDoc)**: [http://127.0.0.1:8000/redoc](http://127.0.0.1:8000/redoc)

### 2. Frontend Development Server (React + Vite)

```powershell
# Open a separate terminal and navigate to the frontend directory:
cd c:\Users\Hp\OneDrive\Desktop\demandwise2.0\frontend

# Start Vite dev server:
npm run dev
```

- **Local Application URL**: [http://localhost:5173](http://localhost:5173)

---

## 📡 REST API Reference

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/health` | Service health status and timestamp |
| `GET` | `/api/config` | Bounding box, supported languages, categories |
| `POST` | `/api/predict` | Supervised ML demand prediction |
| `POST` | `/api/competitors` | Real-time OpenStreetMap Overpass competitor search |
| `POST` | `/api/budget/feasibility` | Startup cost breakdown & feasibility rating |
| `POST` | `/api/explain` | Bilingual AI strategic narrative synthesis |
| `POST` | `/api/analysis` | Integrated end-to-end business feasibility orchestration |

---

## 🧪 Automated Testing

DemandWise maintains high testing standards across both the Python backend and React frontend:

### Backend Tests (pytest)
```powershell
pytest -v
```
- **124 tests passing**: Covers Overpass mirror failover, request retries, bounding-box enforcement, budget calculations, scikit-learn model inference, bilingual LLM fallback, and pipeline orchestration.

### Frontend Tests (Vitest)
```powershell
cd frontend
npm test -- --run
```
- **56 tests passing**: Covers landing page components, modal interactions, API client error states, multi-location comparison, and executive PDF generation across English and Tamil scenarios.

---

## 🛡️ Data Integrity & Attribution

- **Zero Competitor Fabrication**: All competitor POIs are retrieved directly from OpenStreetMap. No synthetic competitor names or counts are ever generated.
- **OpenStreetMap Attribution**: Map tiles and spatial data are &copy; [OpenStreetMap contributors](https://www.openstreetmap.org/copyright) under the Open Database License (ODbL).
- **Synthetic Training Data Disclosure**: The demand prediction model is calibrated on synthetic training data for comparative indexing and research benchmarking.

---

## 📄 License

This project is licensed under the **MIT License**.
