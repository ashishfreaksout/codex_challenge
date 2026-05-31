# Bay Area Pothole Tracker

Expo React Native app for tracking potholes across the Bay Area with Google Maps or an OpenStreetMap web preview, mock 311 data, local report state, search, status filtering, and AI probability hotspots.

## Hosted Web Demo

Public web app:

```text
https://ashishfreaksout.github.io/codex_challenge/
```

The hosted web build uses the OpenStreetMap/CARTO fallback so it can be viewed publicly without exposing a Google Maps browser key. See [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) for the GitHub Pages deployment workflow.

## Project Case Study

For a visual project overview, development story, architecture diagram, and human/Codex collaboration summary, see [PROJECT_CASE_STUDY.md](PROJECT_CASE_STUDY.md).

Additional documentation:

- [Model evaluation notebook](docs/model_evaluation.ipynb)
- [Prediction API reference](docs/API.md)
- [Web deployment guide](docs/DEPLOYMENT.md)
- [Testing checklist](docs/TESTING.md)
- [Screenshot guide](docs/screenshots/README.md)
- [Data source notes](data/DATA_SOURCES.md)

## Run

```bash
npm install
npm run start
```

Use `npm run web` for the browser build, or `npm run android` after creating native projects with Expo.

To build the static web app for GitHub Pages:

```bash
EXPO_NO_DOTENV=1 EXPO_PUBLIC_PREDICTION_SERVICE_URL=https://ashishfreaksout-bay-area-pothole-prediction-api.hf.space npm run export:web:pages
```

## Android APK

The included `eas.json` has a `preview` profile that exports an internal APK:

```bash
npx eas-cli build -p android --profile preview
```

## Configuration

Create `.env` from `.env.example` and set `EXPO_PUBLIC_GOOGLE_MAPS_API_KEY`. The native app uses the same key through `app.config.js`; the web map uses it through `MapComponent.web.js`. Keep `.env` local only; it is ignored by Git so demo or production API keys are not committed.

Without a Google Maps key, the web app shows an OpenStreetMap-based Bay Area preview with the mock pothole data so the UI can still be reviewed. Add the key to switch the web build to Google Maps.

Native Android APKs default to `EXPO_PUBLIC_NATIVE_TILE_PROVIDER=osm`, which renders OpenStreetMap tiles through the native map view. Set `EXPO_PUBLIC_NATIVE_TILE_PROVIDER=google` only after the Google Maps Android SDK key is enabled for the APK package and signing SHA-1.

If `EXPO_PUBLIC_BAY_AREA_311_ENDPOINT` and `EXPO_PUBLIC_SAN_JOSE_311_ENDPOINT` are unset, the app uses the mock Bay Area 311 response in `src/data/MockData.js`. When an endpoint is available, `src/services/sanJose311Api.js` normalizes its records into the same pothole shape used by the mock local repository.

## Geospatial Data Engineering Upgrade

This repo now includes a geospatial data engineering layer around the existing pothole app. The goal is to show a road-risk pipeline without rewriting the working Expo frontend or the current prediction service.

Architecture flow:

```text
Bay Area pothole/service request samples or live San Jose 311 data + OpenStreetMap road data
-> Python ingestion scripts
-> PostgreSQL/PostGIS raw tables
-> transformation layer
-> road_risk_features table
-> FastAPI data service
-> GeoJSON output for frontend map visualization
```

The existing backend is a Node/Express prediction service in `predictive-service/src/server.js`. For the data engineering upgrade, the safer option is a separate FastAPI data service in `data_service/main.py` because the new work is Python/PostGIS-heavy and should not break the current mobile/web prediction API.

### PostGIS Setup

Start PostgreSQL/PostGIS on host port `5433`:

```bash
docker compose up -d postgis
```

Database settings:

```text
database: road_risk
user: postgres
password: postgres
host port: 5433
container port: 5432
```

The schema lives in `sql/create_postgis_tables.sql` and creates:

- `raw_311_pothole_reports`
- `raw_osm_roads`
- `road_risk_features`

Install the Python data-service dependencies:

```bash
python3 -m venv .venv
.venv/bin/pip install -r requirements.txt
```

### Ingestion Scripts

Fetch or prepare San Jose 311 pothole data:

```bash
.venv/bin/python ingestion/fetch_sanjose_311.py --api-url "<san-jose-311-api-url>"
```

For local testing only, explicitly use the bundled sample file:

```bash
.venv/bin/python ingestion/fetch_sanjose_311.py --demo
```

For the Bay Area portfolio demo, load the broader bundled sample directly. It includes records across San Francisco, Oakland, Alameda, Richmond, Walnut Creek, Milpitas, Fremont/Palo Alto/Sunnyvale areas, and San Jose:

```bash
npm run data:load:bay-area-demo
npm run data:transform
```

Fetch drivable OpenStreetMap roads. The script uses 311 report coordinates to derive OSM request bounds, tries Overpass first, and falls back to the official OSM map API when Overpass is unavailable.

For San Jose-only testing:

```bash
.venv/bin/python ingestion/fetch_osm_roads.py --from-potholes data/raw/sanjose_311_potholes.json
```

For the broader Bay Area demo, use the pothole-centered fetch mode. It requests many small bboxes around the report locations, dedupes OSM road IDs, and avoids one oversized Bay Area request:

```bash
npm run data:fetch:osm:bay-area
```

Both scripts write raw local files under `data/raw/`. Those generated files are ignored by Git.

### Load And Transform

Load available raw files into PostGIS:

```bash
.venv/bin/python ingestion/load_to_postgis.py --init-schema
```

Build the explainable road-risk feature table:

```bash
.venv/bin/python transformations/build_road_risk_features.py
```

The risk score is intentionally simple and auditable. It uses total report count, recent report count, days since last report, and whether a report was matched to an OSM road segment, then assigns `Low`, `Medium`, or `High` risk levels.

### Data API Endpoints

Run the FastAPI data service:

```bash
.venv/bin/uvicorn data_service.main:app --reload --port 8000
```

Endpoints:

```text
GET http://localhost:8000/health
GET http://localhost:8000/risk-summary
GET http://localhost:8000/risk-grid
GET http://localhost:8000/api/v1/predictive-map
```

`/risk-grid` returns the native PostGIS road-risk features. When OSM matching succeeds, geometries are OSM `LineString` road segments. Optional query parameters:

```text
min_score=0.35
limit=1000
bbox=-122.05,37.20,-121.70,37.45
```

`/api/v1/predictive-map` is a compatibility endpoint for the existing frontend. It returns buffered polygons and maps `risk_score` to `probability_score`, so the current `AI Predicted Hotspots` layer can display the PostGIS-backed road-risk output if `EXPO_PUBLIC_PREDICTION_SERVICE_URL` is pointed at the FastAPI service.

Useful local command sequence:

```bash
docker compose up -d postgis
.venv/bin/pip install -r requirements.txt
.venv/bin/python ingestion/fetch_sanjose_311.py --demo
npm run data:fetch:osm:bay-area
npm run data:load:bay-area-demo
.venv/bin/python transformations/build_road_risk_features.py
.venv/bin/uvicorn data_service.main:app --reload --port 8000
```

If you load only the San Jose 311 demo file, the PostGIS prediction layer will naturally cluster around San Jose. Use `npm run data:refresh:bay-area-demo` when you want the local map to show the broader Bay Area sample layer.

To preview the PostGIS-backed road-risk layer in the existing frontend instead of the ML prediction service:

```bash
EXPO_PUBLIC_PREDICTION_SERVICE_URL=http://localhost:8000 npm run web
```

Completed Phase 2 upgrades:

- OSM ingestion now uses tighter pothole-derived bounds and a fallback API path.
- `road_risk_features` now records whether geometry came from OSM roads or fallback report clusters.
- Risk features include OSM match counts and average match distance.
- FastAPI now exposes a frontend-compatible PostGIS map endpoint at `/api/v1/predictive-map`.

Still planned:

- Add scheduled ingestion for real San Jose 311 and OSM refreshes.
- Add stronger data quality checks and pipeline tests.
- Add dbt-style transformation documentation or SQL lineage diagrams.
- Add production deployment for the PostGIS-backed API.

## Predictive Hotspots

The app has a separate prediction microservice and a web overlay mode for probability hotspots.

```bash
python3 -m venv .venv
.venv/bin/pip install -r ml/requirements.txt
npm run predictive:train
npm run predictive:serve
```

`npm run predictive:train` reads `data/sample_bay_area_311_potholes.csv` plus `data/sample_bay_area_environmental_features.csv` and writes `predictive-service/data/risk_grid.geojson`. The script still supports 100m cells with `--grid-size-meters 100`; the npm script uses 300m cells so the Bay Area demo grid stays small enough for local development.

The model currently uses `HistGradientBoostingClassifier` with a weighted heuristic fallback. Predictors include 24-month pothole history, rainy-season timing, repair decay, 30/90-day rainfall, heavy-rain days, impervious surface, slope, flow accumulation, topographic wetness, storm-drain access, flooding complaints, pavement condition, resurfacing age, AADT, truck exposure, and road class. See `data/DATA_SOURCES.md` for the production data sources these sample files are shaped to match.

The training script applies a road/land prediction mask before writing GeoJSON. It excludes approximate Bay/ocean water polygons and cells too far from known road/civic/environment samples, so probability cells are not generated in the bay basin.

The mobile app also watches foreground GPS location and checks the prediction service for nearby high-risk cells. If the driver enters a high-probability area, it shows a temporary warning banner and dismisses it automatically after a few seconds. For a physical APK/IPA, set `EXPO_PUBLIC_PREDICTION_SERVICE_URL` to a reachable LAN or hosted service URL instead of `localhost`.

## Sandbox Driving Test

Dev builds show a `Test drive` button next to the recenter control. It simulates a driver moving through high-risk Downtown San Jose model cells, switches to `AI Predicted Hotspots`, pans the map with a blue driver tracker dot, and triggers the same high-risk warning banner used by live GPS.

For a production preview APK/IPA, enable the simulator explicitly:

```bash
EXPO_PUBLIC_ENABLE_SANDBOX_DRIVER=true npx eas-cli build -p android --profile preview
```

Keep `EXPO_PUBLIC_ENABLE_SANDBOX_DRIVER=false` for normal release builds.

For the 3D joystick navigation sandbox APK, build with:

```bash
EXPO_PUBLIC_GOOGLE_MAPS_API_KEY=<your-google-maps-key> EXPO_PUBLIC_ENABLE_3D_SANDBOX_NAVIGATION=true npx eas-cli build -p android --profile preview
```

That build uses the Android package `com.example.bayareapotholes.sandbox3d`, so it can be installed beside the normal app in BlueStacks or on an Android device.

The service exposes:

```text
GET  http://localhost:4000/api/v1/predictive-map
GET  http://localhost:4000/api/v1/model-metadata
POST http://localhost:4000/api/v1/report
```

The web app uses `EXPO_PUBLIC_PREDICTION_SERVICE_URL` and the `AI Predicted Hotspots` view mode to render the probability gradient layer.

## Hugging Face Deployment

For a hosted prediction API, deploy the FastAPI/Docker Space in `deployment/huggingface-space`. It keeps the same endpoint contract as the local Node service, so the app only needs `EXPO_PUBLIC_PREDICTION_SERVICE_URL` changed to the Space runtime URL.

Prepare the Space bundle:

```bash
bash scripts/prepare_hf_space.sh
```

Then create a Hugging Face Docker Space and push the generated files:

```bash
python3 -m pip install -U huggingface_hub
hf auth login
scripts/deploy_hf_space.sh ashishfreaksout/bay-area-pothole-prediction-api
```

After the Space is running, set the app to use it:

```bash
EXPO_PUBLIC_PREDICTION_SERVICE_URL=https://ashishfreaksout-bay-area-pothole-prediction-api.hf.space
```

Free Spaces can sleep when idle. The `/api/v1/refresh` endpoint rebuilds the risk grid from the bundled historical and environmental data; for production, trigger that endpoint from a scheduled job after updating the input CSVs from 311, rainfall, drainage, pavement, and traffic pipelines. User report updates sent to `/api/v1/report` adjust the in-memory nearby sector immediately, but should be persisted to Firestore or a hosted database before relying on them across restarts.
