# Testing Checklist

This checklist documents what should be verified before presenting or submitting the project.

## 1. Local Setup

```bash
npm install
python3 -m pip install -r ml/requirements.txt
```

Expected result:

- JavaScript dependencies install successfully.
- Python ML dependencies install successfully.

## 2. Train the Prediction Grid

```bash
npm run predictive:train
```

Expected result:

- `predictive-service/data/risk_grid.geojson` is generated.
- The console reports the number of scored cells.
- Generated cells do not appear in the Bay water basin.

## 3. Run the Prediction Service

```bash
npm run predictive:serve
```

Check:

```bash
curl http://localhost:4000/health
curl "http://localhost:4000/api/v1/predictive-map?minScore=0.5&limit=10"
```

Expected result:

- `/health` returns `ok: true`.
- `/api/v1/predictive-map` returns a GeoJSON `FeatureCollection`.

## 4. Run the PostGIS Road Risk Data Service

Start PostGIS and build the geospatial feature table:

```bash
docker compose up -d postgis
.venv/bin/pip install -r requirements.txt
.venv/bin/python ingestion/fetch_sanjose_311.py --demo
npm run data:fetch:osm:bay-area
npm run data:refresh:bay-area-demo
```

Run the API:

```bash
.venv/bin/uvicorn data_service.main:app --reload --port 8000
```

Verify:

```bash
curl http://localhost:8000/health
curl http://localhost:8000/risk-summary
curl "http://localhost:8000/risk-grid?min_score=0.0&limit=5"
curl "http://localhost:8000/api/v1/predictive-map?minScore=0.0&limit=5"
```

Expected result:

- `raw_osm_roads` is greater than `0` when OSM ingestion succeeds.
- `road_risk_features` is greater than `0`.
- `/risk-summary` reports most Bay Area features as `osm_road_segment` after the broader OSM fetch.
- `/risk-grid` returns native OSM road `LineString` features when matched.
- `/api/v1/predictive-map` returns buffered polygon features compatible with the existing frontend overlay.

## 5. Run the Web App

```bash
npm run web
```

Expected result:

- The app loads in the browser.
- Live pothole markers display.
- Predicted hotspot mode displays probability cells.
- Search and filter controls remain readable.

To preview the PostGIS-backed risk layer in the existing predicted tab:

```bash
EXPO_PUBLIC_PREDICTION_SERVICE_URL=http://localhost:8000 npm run web
```

## 6. Build Static Web App

```bash
EXPO_NO_DOTENV=1 EXPO_PUBLIC_PREDICTION_SERVICE_URL=https://ashishfreaksout-bay-area-pothole-prediction-api.hf.space npm run export:web:pages
```

Expected result:

- `dist/index.html` is generated.
- `dist/.nojekyll` exists.
- Expo bundle paths use `./_expo/...` so GitHub Pages project hosting works.
- The exported build does not depend on the local `.env` file.

## 7. GitHub Pages Deployment

The `Deploy Web App` workflow should run after pushes to `main`.

Expected result:

- GitHub Actions completes successfully.
- The web app opens at `https://ashishfreaksout.github.io/codex_challenge/`.
- The map renders using OpenStreetMap/CARTO tiles.
- Predicted hotspots load from the hosted prediction service.

If the GitHub Pages URL returns 404, enable Pages in repository settings with source `Deploy from a branch`, branch `gh-pages`, folder `/ (root)`.

## 8. Android Actual App

Build command:

```bash
npx eas-cli build -p android --profile preview
```

Expected result:

- The APK installs as the actual app package.
- Map tiles render.
- Live tab displays pothole markers.
- Predicted tab displays heatmap cells.
- 3D Nav tab displays road/heading view.
- Pinch zoom works in Live, Predicted, and 3D Nav modes.
- Location button recenters on the user location when permission is granted.

## 9. Android Sandbox App

Build command:

```bash
EXPO_PUBLIC_ENABLE_3D_SANDBOX_NAVIGATION=true npx eas-cli build -p android --profile preview
```

Expected result:

- The APK installs separately as the sandbox package.
- The app opens directly into the 3D sandbox navigation experience.
- Driver movement can be simulated without physically driving.
- A warning appears when entering a high-risk area.

After building the sandbox version, reset the EAS preview environment flag to `false` before future normal builds.

## 10. Model Evaluation Notebook

Regenerate the notebook and figures:

```bash
python3 scripts/generate_evaluation_notebook.py
```

Expected result:

- `docs/model_evaluation.ipynb` updates.
- `docs/model_metrics.csv` updates.
- Model plots update in `docs/figures/`.

Review:

- Model comparison chart.
- ROC curve.
- Confusion matrix.
- Feature importance.
- Risk grid distribution.
- Live-vs-predicted comparison.

## 11. Manual UI Review

Check:

- No important text overlaps on mobile.
- Tab labels fit on Android.
- Report button does not cover critical map details.
- Warning banner is visible but not permanent.
- Hotspot opacity allows streets to remain visible.
- The app does not look cluttered while driving.

## 12. Known Prototype Limitations

- Sample datasets are small.
- Prediction service updates are not yet persisted to a database.
- Free hosted services may sleep.
- The land/water mask is approximate.
- Formal validation should use a future holdout period from official data.
