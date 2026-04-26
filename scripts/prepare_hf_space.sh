#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SPACE_DIR="$ROOT_DIR/dist/huggingface-space"

mkdir -p "$SPACE_DIR"
mkdir -p "$SPACE_DIR/data"
mkdir -p "$SPACE_DIR/ml"
mkdir -p "$SPACE_DIR/predictive-service/data"

cp "$ROOT_DIR/deployment/huggingface-space/app.py" "$SPACE_DIR/app.py"
cp "$ROOT_DIR/deployment/huggingface-space/Dockerfile" "$SPACE_DIR/Dockerfile"
cp "$ROOT_DIR/deployment/huggingface-space/README.md" "$SPACE_DIR/README.md"
cp "$ROOT_DIR/deployment/huggingface-space/requirements.txt" "$SPACE_DIR/requirements.txt"
cp "$ROOT_DIR/ml/train_pothole_risk_model.py" "$SPACE_DIR/ml/train_pothole_risk_model.py"
cp "$ROOT_DIR/ml/requirements.txt" "$SPACE_DIR/ml/requirements.txt"
cp "$ROOT_DIR/data/sample_bay_area_311_potholes.csv" "$SPACE_DIR/data/sample_bay_area_311_potholes.csv"
cp "$ROOT_DIR/data/sample_bay_area_environmental_features.csv" "$SPACE_DIR/data/sample_bay_area_environmental_features.csv"
cp "$ROOT_DIR/data/DATA_SOURCES.md" "$SPACE_DIR/data/DATA_SOURCES.md"
cp "$ROOT_DIR/predictive-service/data/risk_grid.sample.geojson" "$SPACE_DIR/predictive-service/data/risk_grid.sample.geojson"

if [[ "${INCLUDE_GENERATED_GRID:-0}" == "1" && -f "$ROOT_DIR/predictive-service/data/risk_grid.geojson" ]]; then
  cp "$ROOT_DIR/predictive-service/data/risk_grid.geojson" "$SPACE_DIR/predictive-service/data/risk_grid.geojson"
fi

printf "Prepared Hugging Face Space files in %s\n" "$SPACE_DIR"
