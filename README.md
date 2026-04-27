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
npx eas-cli build -p android --profile preview
```

## Configuration

Create `.env` from `.env.example` and set `EXPO_PUBLIC_GOOGLE_MAPS_API_KEY`. The native app uses the same key through `app.config.js`; the web map uses it through `MapComponent.web.js`. Keep `.env` local only; it is ignored by Git so demo or production API keys are not committed.

Without a Google Maps key, the web app shows an OpenStreetMap-based Bay Area preview with the mock pothole data so the UI can still be reviewed. Add the key to switch the web build to Google Maps.

Native Android APKs default to `EXPO_PUBLIC_NATIVE_TILE_PROVIDER=osm`, which renders OpenStreetMap tiles through the native map view. Set `EXPO_PUBLIC_NATIVE_TILE_PROVIDER=google` only after the Google Maps Android SDK key is enabled for the APK package and signing SHA-1.

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
