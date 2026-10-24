# DemandWise V1 — Business Demand Analysis Engine

DemandWise V1 is a student-level business demand analysis project designed to analyze local business opportunities in **Coimbatore, Tamil Nadu**. It combines machine learning demand estimation, external geographic competitor retrieval via OpenStreetMap, independent startup budget feasibility calculation, bilingual (English/Tamil) LLM explanations, and an interactive modern dark-mode frontend dashboard.

> **Current Phase**: **Phase 6 — Animated Frontend Dashboard (React / Vite / Tailwind)**
> Backend and Frontend are fully integrated, tested, and running.

---

## 🗺️ Spatial Service Distinction Architecture

DemandWise clearly distinguishes between three fundamentally different spatial services:

1. **Map Tiles (Display Layer)**:
   - Rendered $256 \times 256$ pixel raster or vector images (e.g. OpenStreetMap Carto tiles at `https://tile.openstreetmap.org/{z}/{x}/{y}.png`).
   - Purpose: Visual map display in web UI map canvases (Leaflet, MapLibre). Map tiles do **not** provide POI lists, competitor metadata, or search capabilities.
2. **Geocoding (Address $\leftrightarrow$ Coordinate Layer)**:
   - Forward geocoding converts text addresses to latitude/longitude coordinates; reverse geocoding converts coordinates to street addresses (e.g., Nominatim).
3. **Place Search (Spatial POI Layer — Implemented in Phase 3)**:
   - Structured spatial queries retrieving points-of-interest (POI) based on tags, categories (`cafe`, `hotel`, `retail`), and radial proximity around coordinates.
   - Implemented via the OpenStreetMap Overpass API (`/api/interpreter`).

---

## ⚙️ End-to-End Orchestration Architecture (Phase 5)

The Phase 5 orchestrator (`app/services/orchestrator.py`) provides a single, cohesive business analysis pipeline executed at `POST /api/analysis`:

1. **Stage 1 (Budget Feasibility)**: Deterministic, rule-based startup cost breakdown and surplus/deficit calculation.
2. **Stage 2 (Competitor Search)**: Real-time point-of-interest discovery via OpenStreetMap Overpass API with deduplication, distance sorting, and top-5 preview extraction. Gracefully degrades if external service is unreachable.
3. **Stage 3 (ML Demand Prediction)**: Supervised RandomForest inference estimating synthetic monthly visits based on business category, spatial coordinates, budget, floor area, competitor density, and college proximity. Gracefully degrades if model is unavailable.
4. **Stage 4 (Bilingual LLM Explanation)**: Bilingual (English/Tamil) narrative synthesis of budget, competitors, and ML prediction with deterministic rule-based template fallback.
5. **Observability & Diagnostics**: Tracks per-stage execution status (`success`, `degraded`, `error`) and latency in milliseconds.

---

## 🤖 Multilingual LLM Explanation Service (Phase 4)

The Phase 4 explanation service synthesizes results from the ML demand model, OpenStreetMap competitors, and budget feasibility into clear, objective, and actionable explanations in **English (`en`)** or **Tamil (`ta`)**.

### Key Architectural Guarantees:
- **Provider Agnostic**: Connects to any OpenAI-compatible API endpoint (OpenAI, Ollama, Groq, OpenRouter, vLLM) via `httpx`.
- **Strict Data Integrity**: Numerical predictions, competitor counts, and budget calculations remain immutable ground-truth. The LLM cannot alter them.
- **Zero Fabrication**: The LLM is instructed only to reference verified competitors from OpenStreetMap; it is prohibited from inventing businesses or guaranteeing profits.
- **Synthetic Disclosure**: Every explanation discloses that the ML demand prediction is produced by a synthetic demo pipeline.
- **Backend Security**: API keys are configured via environment variables and reside strictly on the backend. They are never exposed to clients or in `GET /api/config`.
- **Deterministic Fallback (High Availability)**: If the LLM API key is unconfigured, or if the external provider times out or errors, the service automatically generates a structured, high-quality rule-based explanation in the requested language. ML and budget services remain 100% operational.

---

## ⚠️ Data Integrity & Synthetic Data Notices

1. **Machine Learning Pipeline (Phase 2)**:
   - The ML model is trained on **synthetic demo data**. It generates an experimental volume index (`synthetic_monthly_visits`) for pipeline verification. It is **not** real observed demand or revenue.
2. **Competitor Place Search (Phase 3)**:
   - Competitor records are retrieved live from OpenStreetMap.
   - **Zero Fabrication Guarantee**: DemandWise **never** fabricates competitor records or counts. If an area has no listed competitors on OpenStreetMap, `total_found` is strictly 0.
3. **Startup Budget Feasibility (Phase 3)**:
   - Calculations are rule-based and **completely independent** of the ML model and LLM.
   - Cost assumptions represent illustrative student planning benchmarks for Coimbatore.
4. **OpenStreetMap Attribution Requirement**:
   - All spatial competitor data, POI locations, and map tiles are sourced from OpenStreetMap under the Open Database License (ODbL).
   - **Mandatory Attribution**: **© OpenStreetMap contributors** (see [OpenStreetMap Copyright](https://www.openstreetmap.org/copyright)).
   - **Phase 6 Frontend Requirement**: The Phase 6 interactive dashboard map canvas (Leaflet/MapLibre) and competitor cards **must prominently display** the `© OpenStreetMap contributors` attribution banner.

---

## Project Structure

```text
demandwise2.0/
├── app/
│   ├── __init__.py
│   ├── main.py              # FastAPI app factory, CORS setup, and router inclusion
│   ├── config.py            # Environment-based configuration (pydantic-settings)
│   ├── api/
│   │   ├── __init__.py
│   │   └── routes.py        # /api/health, /api/config, /api/predict, /api/competitors, /api/budget/feasibility, /api/explain, /api/analysis
│   ├── core/
│   │   ├── __init__.py
│   │   ├── exceptions.py    # Structured JSON error handlers with safe serialization
│   │   └── geo.py           # Coimbatore bounding-box validation & Haversine distance
│   ├── services/
│   │   ├── __init__.py
│   │   ├── orchestrator.py  # Phase 5 end-to-end analysis orchestration & graceful degradation
│   │   ├── competitors.py   # OSM Overpass place-search, deduplication & distance calculation
│   │   ├── budget.py        # Independent startup budget feasibility & cost breakdown
│   │   └── llm.py           # Bilingual OpenAI-compatible LLM explanations & deterministic fallback
│   └── schemas/
│       ├── __init__.py
│       ├── health.py        # Health and Config response schemas
│       ├── analysis.py      # Phase 5 BusinessAnalysisRequest/Response & sub-schemas
│       ├── predict.py       # Phase 2 PredictRequest/PredictResponse schemas
│       ├── competitors.py   # Phase 3 CompetitorSearchRequest/Response schemas
│       ├── budget.py        # Phase 3 BudgetFeasibilityRequest/Response schemas
│       └── explain.py       # Phase 4 ExplanationContext and ExplanationResponse schemas
├── ml/
│   ├── __init__.py
│   ├── dataset.py           # Synthetic dataset generator and loader
│   ├── features.py          # Feature engineering shared by train and inference
│   ├── train.py             # RandomForestRegressor training pipeline + CLI
│   ├── predict.py           # Inference functions and DemandPredictionResult
│   └── evaluate.py          # MAE/RMSE evaluation with spatial-group diagnostic
├── tests/
│   ├── __init__.py
│   ├── conftest.py          # Pytest fixtures (TestClient, mock location)
│   ├── test_health.py       # Health check and error handler tests
│   ├── test_config.py       # Configuration, security & CORS preflight tests
│   ├── test_geo.py          # Bounding-box & Haversine distance unit tests
│   ├── test_validation.py   # Business request validation tests
│   ├── test_ml.py           # ML pipeline unit tests (training, inference, features)
│   ├── test_predict_api.py  # Phase 2 HTTP endpoint tests for /api/predict
│   ├── test_competitors.py  # Phase 3 Competitor search, parsing, deduplication & API tests
│   ├── test_budget.py       # Phase 3 Budget feasibility, line items & classification tests
│   ├── test_llm.py          # Phase 4 LLM explanations, Tamil/English templates & fallback tests
│   └── test_analysis.py     # Phase 5 End-to-end orchestration, sub-results & degradation tests
├── data/                    # Generated synthetic CSV datasets (git-ignored except .gitkeep)
├── artifacts/               # Trained model artifacts (git-ignored except .gitkeep)
├── .env.example             # Template for local environment variables
├── .gitignore               # Ignores .env, .venv, artifacts/*.joblib, data/*.csv
├── requirements.txt         # Pinned Python package dependencies
├── pytest.ini               # Pytest configuration
├── DEVELOPMENT_STATUS.md    # Phase-by-phase implementation tracker
└── README.md                # Project documentation and setup guide
```

---

## Windows Installation & Setup Guide

### 1. Prerequisites
- **Python 3.10+** (tested on Python 3.12 64-bit on Windows).
- **PowerShell** or **Command Prompt**.

### 2. Create and Activate Virtual Environment

```powershell
cd c:\Users\Hp\OneDrive\Desktop\demandwise2.0
python -m venv .venv
.\.venv\Scripts\Activate.ps1
```

> **Note**: If PowerShell blocks script execution, run:
> ```powershell
> Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
> ```

### 3. Install Dependencies

```powershell
python -m pip install --upgrade pip
pip install -r requirements.txt
```

### 4. Configure Environment Variables

```powershell
Copy-Item .env.example .env
```

Key configuration parameters in `.env`:
| Variable | Default | Description |
|---|---|---|
| `APP_HOST` | `127.0.0.1` | Server host |
| `APP_PORT` | `8000` | Server port |
| `COIMBATORE_MIN_LAT` | `10.85` | Geo-boundary south edge |
| `COIMBATORE_MAX_LAT` | `11.20` | Geo-boundary north edge |
| `COIMBATORE_MIN_LNG` | `76.80` | Geo-boundary west edge |
| `COIMBATORE_MAX_LNG` | `77.20` | Geo-boundary east edge |
| `ALLOWED_BUSINESS_TYPES` | `cafe,hotel,retail` | Supported business categories |
| `OVERPASS_API_URL` | `https://overpass-api.de/api/interpreter` | OpenStreetMap Overpass place-search endpoint |
| `LLM_PROVIDER` | `openai_compatible` | LLM provider identifier |
| `LLM_BASE_URL` | `https://api.openai.com/v1` | Base URL for chat completions |
| `LLM_MODEL` | `gpt-4o-mini` | Model name |
| `LLM_API_KEY` | `""` | API key (optional; deterministic fallback used if unset) |
| `LLM_TIMEOUT_SECONDS` | `15.0` | Timeout in seconds |
| `LLM_TEMPERATURE` | `0.3` | Sampling temperature |

### 5. Train the Demo ML Model (Phase 2)

```powershell
python -m ml.train
```

---

## Running the Application

```powershell
uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

- **Swagger UI**: [http://127.0.0.1:8000/docs](http://127.0.0.1:8000/docs)
- **ReDoc**: [http://127.0.0.1:8000/redoc](http://127.0.0.1:8000/redoc)

---

## API Endpoints

### Phase 1 & 2 Endpoints
- `GET /api/health`: Service health check.
- `GET /api/config`: Dynamic configuration, bounding box, supported languages, business types.
- `POST /api/predict`: Synthetic demand prediction from pre-trained RandomForestRegressor.

### Phase 3 Endpoints
- `POST /api/competitors`: Verified OpenStreetMap Overpass place-search with Haversine distance.
- `POST /api/budget/feasibility`: Independent startup budget feasibility & cost line-items.

### Phase 4 Endpoints

#### 1. `POST /api/explain` — Bilingual Explanation Service
Synthesizes structured ML, competitor, and budget data into an objective explanation in English or Tamil.

**Request Body:**
```json
{
  "business_name": "Kovai Filter Coffee",
  "business_type": "cafe",
  "language": "ta",
  "latitude": 11.0168,
  "longitude": 76.9558,
  "area_name": "RS Puram",
  "city": "Coimbatore",
  "state": "Tamil Nadu",
  "predicted_synthetic_monthly_visits": 850.5,
  "competitor_count": 3,
  "competitor_names": ["Aroma Cafe", "Cross Cut Coffee", "Chai Shai"],
  "user_budget_inr": 1200000.0,
  "total_estimated_startup_cost_inr": 950000.0,
  "budget_difference_inr": 250000.0,
  "feasibility_category": "SURPLUS"
}
```

**Response (200 OK):**
```json
{
  "language": "ta",
  "summary": "'Kovai Filter Coffee' (cafe) திட்டத்திற்கு கோயம்புத்தூரில் திட்டமிடப்பட்ட பட்ஜெட் ₹1,200,000 ஆகும். நிதி நிலை: உபரி.",
  "explanation": "### 1. திட்டச் சுருக்கம்\n'Kovai Filter Coffee' என்ற cafe வணிகம் கோயம்புத்தூர் பகுதியில் தொடங்க முன்மொழியப்பட்டுள்ளது...\n### 2. தேவை மதிப்பீடு (செயற்கை மாதிரி ஆய்வு)\n- மதிப்பிடப்பட்ட மாதாந்திர வருகை: 850.5 (செயற்கை மாதிரி)...",
  "recommendations": [
    "கோயம்புத்தூர் RS Puram பகுதியில் நேரடி சந்தை ஆய்வு மேற்கொள்ளவும்.",
    "ஆரம்பக்கட்ட செலவுகளைக் கட்டுப்படுத்த உபகரணங்களை நிதானமாக தேர்வு செய்யவும்.",
    "உள்ளூர் நகராட்சி மற்றும் FSSAI வணிக உரிமங்களை முன்கூட்டியே முறைப்படுத்தவும்."
  ],
  "explanation_mode": "template_fallback",
  "llm_provider": "openai_compatible",
  "llm_model": "gpt-4o-mini",
  "disclaimer": "மாதிரி எச்சரிக்கை: தேவை மதிப்பீடு செயற்கை தரவுகளில் பயிற்றுவிக்கப்பட்ட மாதிரி..."
}
```

#### 2. `POST /api/analysis` — Integrated Business Analysis (Phase 5)
Orchestrates budget feasibility, live OpenStreetMap competitor discovery, synthetic ML demand prediction, and bilingual LLM explanation into a single structured response with observability and graceful degradation.

**Request Body:**
```json
{
  "business_name": "Aroma Cafe",
  "business_type": "cafe",
  "language": "en",
  "budget_inr": 1000000.0,
  "location": {
    "latitude": 11.0168,
    "longitude": 76.9558,
    "city": "Coimbatore",
    "state": "Tamil Nadu"
  },
  "floor_area_sqft": 800.0,
  "near_college": 1
}
```

**Response (200 OK):**
```json
{
  "request_id": "dw-b7a42c38f190",
  "business_name": "Aroma Cafe",
  "business_type": "cafe",
  "language": "en",
  "budget_inr": 1000000.0,
  "location": {
    "latitude": 11.0168,
    "longitude": 76.9558,
    "city": "Coimbatore",
    "state": "Tamil Nadu"
  },
  "summary": "For 'Aroma Cafe' (cafe) in Coimbatore, the planned budget is ₹1,000,000 against an estimated startup cost of ₹820,000...",
  "explanation": "### 1. Executive Summary\nAroma Cafe is proposed as a cafe in Coimbatore...\n### 2. Demand Estimation...",
  "recommendations": [
    "Conduct field research on peak footfall hours in RS Puram.",
    "Optimize initial kitchen equipment sizing.",
    "Secure local commercial and FSSAI licenses early."
  ],
  "explanation_mode": "template_fallback",
  "budget_feasibility": {
    "user_budget_inr": 1000000.0,
    "total_estimated_startup_cost_inr": 820000.0,
    "budget_difference_inr": 180000.0,
    "feasibility_category": "SURPLUS",
    "is_feasible": true
  },
  "ml_prediction": {
    "predicted_synthetic_monthly_visits": 724.5,
    "dataset_status": "synthetic_demo",
    "model_name": "RandomForestRegressor_v1",
    "floor_area_sqft": 800.0,
    "competitor_count": 4,
    "near_college": 1
  },
  "competitor_count": 4,
  "competitor_names": ["Cafe Coffee Day", "The French Door", "Keventers", "Chai Point"],
  "competitors": [
    {"name": "Cafe Coffee Day", "category": "cafe", "distance_km": 0.35},
    {"name": "The French Door", "category": "cafe", "distance_km": 0.82}
  ],
  "stages": [
    {"stage": "budget_feasibility", "status": "success", "duration_ms": 1.2},
    {"stage": "competitor_search", "status": "success", "duration_ms": 845.3},
    {"stage": "ml_demand_prediction", "status": "success", "duration_ms": 32.1},
    {"stage": "llm_explanation", "status": "success", "duration_ms": 14.8}
  ],
  "warnings": [],
  "disclaimers": [
    "DEMO/SYNTHETIC NOTICE: Demand estimation is generated by a model trained on synthetic data...",
    "BUSINESS ADVISORY: DemandWise provides experimental planning benchmarks and does not guarantee financial success."
  ],
  "total_duration_ms": 894.2
}
```

---

## Automated Test Suite

Run the full automated test suite:

```powershell
.\.venv\Scripts\python.exe -m pytest -v
```

**Actual Verified Test Results (Phase 5)**:
- `tests/test_health.py`: 2 passed
- `tests/test_config.py`: 3 passed (includes API key security leak verification)
- `tests/test_geo.py`: 8 passed (boundary tests + Haversine distance unit tests)
- `tests/test_validation.py`: 11 passed (request schemas, business type normalization, budget limits)
- `tests/test_ml.py`: 8 passed (synthetic dataset generation, training, feature consistency, inference)
- `tests/test_predict_api.py`: 16 passed (predict HTTP endpoint, field validation, 503 missing model)
- `tests/test_competitors.py`: 14 passed (query building, parsing, deduplication, distance, 429/timeout/500 handling, zero-fabrication)
- `tests/test_budget.py`: 13 passed (itemized cost breakdown, surplus/feasible/deficit, custom overrides, ML/LLM independence)
- `tests/test_llm.py`: 14 passed (English & Tamil templates, mocked OpenAI API completions, timeout/error fallback, endpoint integration)
- `tests/test_analysis.py`: 22 passed (orchestration pipeline, sub-results, stage observability, graceful degradation, boundary validation, backward compatibility)
- **Total: 111 passed, 0 failures, 1 warning**

---

## Known Warning

A single `DeprecationWarning` is emitted on test runs:
```text
.venv\Lib\site-packages\starlette\testclient.py:40: DeprecationWarning:
The anyio.abc.BlockingPortal alias is deprecated, use anyio.from_thread.BlockingPortal instead.
```
**Cause**: Starlette `0.41.3` references the deprecated `anyio.abc.BlockingPortal` alias. Upstream issue in Starlette/AnyIO packaging; harmless to runtime and tests.
