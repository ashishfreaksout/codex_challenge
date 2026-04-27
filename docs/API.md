# Prediction API Reference

This project has a prediction service that serves the pothole probability layer separately from the React Native app. The local Node.js service and the Hugging Face/FastAPI service use the same endpoint shape so the frontend can switch between them with `EXPO_PUBLIC_PREDICTION_SERVICE_URL`.

## Base URL

Local development:

```text
http://localhost:4000
```

Hosted deployment example:

```text
https://<your-hugging-face-space>.hf.space
```

## Health Check

```http
GET /health
```

Returns service status, active grid path, feature count, model version, model type, and data source count.

Example response:

```json
{
  "ok": true,
  "feature_count": 20946,
  "data_path": "predictive-service/data/risk_grid.geojson",
  "model_version": "pothole-risk-fused-hist-gradient-v2",
  "model_type": "HistGradientBoostingClassifier",
  "data_source_count": 5
}
```

## Model Metadata

```http
GET /api/v1/model-metadata
```

Returns descriptive model information used by the app and documentation.

Important fields:

| Field | Meaning |
|---|---|
| `model_version` | Version label for the current model pipeline. |
| `model_type` | Trained model type or fallback model type. |
| `target` | What the prediction score represents. |
| `feature_schema` | Input features used by the model. |
| `feature_descriptions` | Human-readable descriptions of each feature. |
| `feature_importance` | Relative importance values when available. |
| `prediction_mask` | Road/land/water filtering metadata. |
| `data_sources` | Source categories used by the model. |

## Predictive Map

```http
GET /api/v1/predictive-map
```

Returns GeoJSON polygons for pothole probability hotspots.

Query parameters:

| Parameter | Type | Default | Description |
|---|---:|---:|---|
| `bbox` | string | none | Optional viewport bounds as `west,south,east,north`. |
| `minScore` | number | `0.25` | Minimum `probability_score` to return. |
| `limit` | number | `5000` | Maximum number of cells returned. |

Example:

```http
GET /api/v1/predictive-map?bbox=-122.45,37.70,-121.85,37.95&minScore=0.5&limit=900
```

Each returned GeoJSON feature includes:

| Property | Meaning |
|---|---|
| `cell_id` | Grid cell identifier. |
| `probability_score` | Pothole risk probability from `0.0` to `1.0`. |
| `risk_band` | `low`, `medium`, or `high`. |
| `fill_color` | Suggested map overlay color. |
| `fill_opacity` | Suggested overlay opacity. |
| `risk_explanation` | Top risk drivers for that cell when available. |
| `center` | Cell center latitude/longitude. |

## Report New Pothole

```http
POST /api/v1/report
Content-Type: application/json
```

Request body:

```json
{
  "latitude": 37.3382,
  "longitude": -121.8863,
  "severity": "High",
  "notes": "Large pothole near intersection",
  "source": "mobile-app"
}
```

The service updates nearby risk cells in memory and returns the affected cells.

Example response:

```json
{
  "ok": true,
  "recalculated_cells": 4,
  "cells": [
    {
      "cell_id": "41:86",
      "probability_score": 0.7421
    }
  ]
}
```

Production note: in-memory recalculation is useful for the prototype. A production version should persist new reports in Firestore, Postgres/PostGIS, or another hosted database.

## Refresh Risk Grid

Available in the FastAPI/Hugging Face service:

```http
POST /api/v1/refresh
```

Rebuilds the risk grid from the bundled training inputs. In production, this should be triggered after updated 311, rainfall, pavement, drainage, and traffic datasets are loaded.
