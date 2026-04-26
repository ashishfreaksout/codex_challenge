# Bay Area Pothole Tracker

Expo React Native app for tracking potholes across the Bay Area with Google Maps or an OpenStreetMap web preview, mock 311 data, local report state, search, status filtering, and AI probability hotspots.

## Run

```bash
npm install
npm run start
```

Use `npm run web` for the browser build, or `npm run android` after creating native projects with Expo.

## Android APK

The included `eas.json` has a `preview` profile that exports an internal APK:

```bash
npx eas build -p android --profile preview
```

## Configuration

Create `.env` from `.env.example` and set `EXPO_PUBLIC_GOOGLE_MAPS_API_KEY`. The native app uses the same key through `app.config.js`; the web map uses it through `MapComponent.web.js`.

Without a Google Maps key, the web app shows an OpenStreetMap-based Bay Area preview with the mock pothole data so the UI can still be reviewed. Add the key to switch the web build to Google Maps.

If `EXPO_PUBLIC_BAY_AREA_311_ENDPOINT` and `EXPO_PUBLIC_SAN_JOSE_311_ENDPOINT` are unset, the app uses the mock Bay Area 311 response in `src/data/MockData.js`. When an endpoint is available, `src/services/sanJose311Api.js` normalizes its records into the same pothole shape used by the mock local repository.

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

The service exposes:

```text
GET  http://localhost:4000/api/v1/predictive-map
GET  http://localhost:4000/api/v1/model-metadata
POST http://localhost:4000/api/v1/report
```

The web app uses `EXPO_PUBLIC_PREDICTION_SERVICE_URL` and the `AI Predicted Hotspots` view mode to render the probability gradient layer.
