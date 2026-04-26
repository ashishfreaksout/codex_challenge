---
title: Bay Area Pothole Prediction API
colorFrom: blue
colorTo: yellow
sdk: docker
app_port: 7860
pinned: false
---

# Bay Area Pothole Prediction API

FastAPI service for the Bay Area Pothole Tracker prediction layer.

## Endpoints

```text
GET  /health
GET  /api/v1/model-metadata
GET  /api/v1/predictive-map?bbox=-122.45,37.70,-122.35,37.82&minScore=0.42&limit=1000
POST /api/v1/report
POST /api/v1/refresh
```

The service exposes the same API shape as the local Node prediction service. It builds a Bay Area risk grid from the included historical pothole and environmental sample data if no prebuilt `risk_grid.geojson` is present.

## Runtime Variables

```text
GRID_SIZE_METERS=300
MAX_ENVIRONMENT_DISTANCE_METERS=9000
RISK_GRID_PATH=/app/predictive-service/data/risk_grid.geojson
GENERATED_RISK_GRID_PATH=/tmp/risk_grid.geojson
```
