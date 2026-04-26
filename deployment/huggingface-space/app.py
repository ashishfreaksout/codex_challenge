from __future__ import annotations

import json
import math
import os
import subprocess
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Optional

from fastapi import Body, FastAPI, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel


APP_DIR = Path(__file__).resolve().parent
ROOT_DIR = Path(os.environ.get("POTHOLE_PROJECT_ROOT", APP_DIR)).resolve()

if not (ROOT_DIR / "data").exists():
    repo_root_candidate = APP_DIR.parents[1] if len(APP_DIR.parents) > 1 else APP_DIR
    if (repo_root_candidate / "data").exists():
        ROOT_DIR = repo_root_candidate

RISK_GRID_PATH = Path(
    os.environ.get(
        "RISK_GRID_PATH",
        ROOT_DIR / "predictive-service" / "data" / "risk_grid.geojson",
    )
)
SAMPLE_GRID_PATH = ROOT_DIR / "predictive-service" / "data" / "risk_grid.sample.geojson"
GENERATED_GRID_PATH = Path(os.environ.get("GENERATED_RISK_GRID_PATH", "/tmp/risk_grid.geojson"))
TRAINING_SCRIPT_PATH = ROOT_DIR / "ml" / "train_pothole_risk_model.py"
DEFAULT_POTHOLE_CSV = ROOT_DIR / "data" / "sample_bay_area_311_potholes.csv"
DEFAULT_ENVIRONMENTAL_CSV = ROOT_DIR / "data" / "sample_bay_area_environmental_features.csv"

GRID_SIZE_METERS = int(os.environ.get("GRID_SIZE_METERS", "300"))
MAX_ENVIRONMENT_DISTANCE_METERS = float(os.environ.get("MAX_ENVIRONMENT_DISTANCE_METERS", "9000"))

app = FastAPI(title="Bay Area Pothole Prediction API", version="1.0.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

risk_grid: Optional[dict[str, Any]] = None
feature_by_cell_id: dict[str, dict[str, Any]] = {}
active_grid_path: Optional[Path] = None


class ReportPayload(BaseModel):
    latitude: float
    longitude: float
    severity: str = "Medium"
    notes: Optional[str] = None
    source: Optional[str] = None
    reportedAt: Optional[str] = None


@app.on_event("startup")
def startup() -> None:
    load_or_build_risk_grid()


@app.get("/")
def root() -> dict[str, Any]:
    return {
        "name": "Bay Area Pothole Prediction API",
        "docs": "/docs",
        "health": "/health",
        "predictive_map": "/api/v1/predictive-map",
    }


@app.get("/health")
def health() -> dict[str, Any]:
    grid = current_grid()
    return {
        "ok": True,
        "feature_count": len(grid["features"]),
        "data_path": str(active_grid_path),
        "model_version": grid.get("properties", {}).get("model_version", "unknown"),
        "model_type": grid.get("properties", {}).get("model_type", "unknown"),
        "data_source_count": len(grid.get("properties", {}).get("data_sources", [])),
    }


@app.get("/api/v1/model-metadata")
def model_metadata() -> dict[str, Any]:
    properties = current_grid().get("properties", {})
    return {
        "name": properties.get("name", "Pothole probability risk grid"),
        "model_version": properties.get("model_version", "unknown"),
        "model_type": properties.get("model_type", "unknown"),
        "target": properties.get("target", "Pothole report probability"),
        "generated_at": properties.get("generated_at"),
        "grid_size_meters": properties.get("grid_size_meters"),
        "feature_schema": properties.get("feature_schema", []),
        "feature_descriptions": properties.get("feature_descriptions", {}),
        "feature_importance": properties.get("feature_importance", {}),
        "training_record_count": properties.get("training_record_count", 0),
        "environmental_sample_count": properties.get("environmental_sample_count", 0),
        "prediction_mask": properties.get("prediction_mask"),
        "data_sources": properties.get("data_sources", []),
    }


@app.get("/api/v1/predictive-map")
def predictive_map(
    bbox: Optional[str] = Query(default=None),
    minScore: float = Query(default=0.25, ge=0, le=1),
    limit: int = Query(default=5000, ge=1, le=25000),
) -> dict[str, Any]:
    bounds = parse_bbox(bbox)
    candidates = [
        apply_gradient_weighting(feature)
        for feature in search_features(bounds)
    ]
    candidates = [
        feature
        for feature in candidates
        if feature["properties"].get("probability_score", 0) >= minScore
    ]
    candidates.sort(key=lambda feature: feature["properties"].get("probability_score", 0), reverse=True)
    selected = candidates[:limit]

    return {
        "type": "FeatureCollection",
        "properties": {
            **current_grid().get("properties", {}),
            "served_at": datetime.now(timezone.utc).isoformat(),
            "gradient_algorithm": "cell-neighborhood-gaussian-v1",
            "minScore": minScore,
            "bbox": bbox_to_list(bounds) if bounds else None,
            "returned_feature_count": len(selected),
        },
        "features": selected,
    }


@app.post("/api/v1/report")
def report(payload: ReportPayload) -> dict[str, Any]:
    changed = recalculate_sector(
        latitude=payload.latitude,
        longitude=payload.longitude,
        severity=payload.severity,
    )
    return {
        "ok": True,
        "recalculated_cells": len(changed),
        "cells": [
            {
                "cell_id": feature["properties"]["cell_id"],
                "probability_score": feature["properties"]["probability_score"],
            }
            for feature in changed
        ],
    }


@app.post("/api/v1/refresh")
def refresh(_: Optional[dict[str, Any]] = Body(default=None)) -> dict[str, Any]:
    load_or_build_risk_grid(force_rebuild=True)
    return {
        "ok": True,
        "feature_count": len(current_grid()["features"]),
        "data_path": str(active_grid_path),
        "refreshed_at": datetime.now(timezone.utc).isoformat(),
    }


def load_or_build_risk_grid(force_rebuild: bool = False) -> None:
    global risk_grid, feature_by_cell_id, active_grid_path

    source_path = resolve_grid_path(force_rebuild=force_rebuild)
    with source_path.open("r", encoding="utf-8") as file:
        parsed = json.load(file)

    if parsed.get("type") != "FeatureCollection" or not isinstance(parsed.get("features"), list):
        raise RuntimeError(f"Invalid GeoJSON FeatureCollection at {source_path}")

    parsed["features"] = [
        normalize_feature(feature, index)
        for index, feature in enumerate(parsed["features"])
    ]
    risk_grid = parsed
    active_grid_path = source_path
    feature_by_cell_id = {
        feature["properties"]["cell_id"]: feature
        for feature in risk_grid["features"]
    }


def resolve_grid_path(force_rebuild: bool = False) -> Path:
    if not force_rebuild and RISK_GRID_PATH.exists():
        return RISK_GRID_PATH

    if not force_rebuild and GENERATED_GRID_PATH.exists():
        return GENERATED_GRID_PATH

    if TRAINING_SCRIPT_PATH.exists() and DEFAULT_POTHOLE_CSV.exists() and DEFAULT_ENVIRONMENTAL_CSV.exists():
        build_grid()
        return GENERATED_GRID_PATH

    if SAMPLE_GRID_PATH.exists():
        return SAMPLE_GRID_PATH

    raise RuntimeError("No risk grid or training inputs were found.")


def build_grid() -> None:
    GENERATED_GRID_PATH.parent.mkdir(parents=True, exist_ok=True)
    command = [
        sys.executable,
        str(TRAINING_SCRIPT_PATH),
        "--input",
        str(DEFAULT_POTHOLE_CSV),
        "--environmental-features",
        str(DEFAULT_ENVIRONMENTAL_CSV),
        "--output",
        str(GENERATED_GRID_PATH),
        "--grid-size-meters",
        str(GRID_SIZE_METERS),
        "--max-environment-distance-m",
        str(MAX_ENVIRONMENT_DISTANCE_METERS),
    ]
    subprocess.run(command, cwd=ROOT_DIR, check=True)


def current_grid() -> dict[str, Any]:
    if risk_grid is None:
        load_or_build_risk_grid()
    if risk_grid is None:
        raise RuntimeError("Risk grid has not been loaded.")
    return risk_grid


def normalize_feature(feature: dict[str, Any], index: int) -> dict[str, Any]:
    properties = feature.get("properties") or {}
    bbox = feature.get("bbox") or calculate_bbox(feature)
    score = clamp(float(properties.get("probability_score", 0)), 0, 1)
    cell_id = str(properties.get("cell_id") or feature.get("id") or f"cell-{index}")

    normalized = {
        **feature,
        "id": feature.get("id") or cell_id,
        "bbox": bbox,
        "properties": {
            **properties,
            "cell_id": cell_id,
            "probability_score": round(score, 4),
            "base_probability_score": round(score, 4),
            "risk_band": risk_band(score),
            "realtime_updates": int(properties.get("realtime_updates", 0)),
        },
    }
    return normalized


def search_features(bbox: Optional[dict[str, float]]) -> list[dict[str, Any]]:
    features = current_grid()["features"]
    if bbox is None:
        return features

    return [
        feature
        for feature in features
        if bbox_overlaps(feature["bbox"], bbox)
    ]


def apply_gradient_weighting(feature: dict[str, Any]) -> dict[str, Any]:
    center = feature_center(feature)
    base_score = float(feature["properties"].get("probability_score", 0))
    radius_meters = 350

    weighted_score = base_score * 1.5
    total_weight = 1.5

    for neighbor in neighbor_features(feature, radius_cells=2):
        if neighbor is feature:
            continue

        distance = haversine_meters(center, feature_center(neighbor))
        if distance > radius_meters:
            continue

        weight = math.exp(-((distance * distance) / (2 * 175 * 175)))
        weighted_score += float(neighbor["properties"].get("probability_score", 0)) * weight
        total_weight += weight

    score = clamp(max(base_score, weighted_score / total_weight), 0, 1)
    return {
        **feature,
        "properties": {
            **feature["properties"],
            "base_probability_score": round(base_score, 4),
            "probability_score": round(score, 4),
            "risk_band": risk_band(score),
            "fill_color": color_ramp(score),
            "fill_opacity": 0.4,
            "gradient_weighting_radius_meters": radius_meters,
        },
    }


def neighbor_features(feature: dict[str, Any], radius_cells: int) -> list[dict[str, Any]]:
    cell_id = feature["properties"].get("cell_id", "")
    try:
        row_text, col_text = str(cell_id).split(":", 1)
        row = int(row_text)
        col = int(col_text)
    except ValueError:
        return search_features(expand_bbox(point_bbox(feature_center(feature)), 350, feature_center(feature)["latitude"]))

    neighbors: list[dict[str, Any]] = []
    for row_offset in range(-radius_cells, radius_cells + 1):
        for col_offset in range(-radius_cells, radius_cells + 1):
            candidate = feature_by_cell_id.get(f"{row + row_offset}:{col + col_offset}")
            if candidate is not None:
                neighbors.append(candidate)
    return neighbors


def recalculate_sector(latitude: float, longitude: float, severity: str) -> list[dict[str, Any]]:
    severity_weight = {
        "low": 0.08,
        "medium": 0.14,
        "high": 0.2,
        "critical": 0.28,
    }
    bump = severity_weight.get(severity.lower(), severity_weight["medium"])
    radius_meters = 250
    search_box = expand_bbox(point_bbox({"latitude": latitude, "longitude": longitude}), radius_meters, latitude)
    nearby = search_features(search_box)
    now = datetime.now(timezone.utc).isoformat()
    changed: list[dict[str, Any]] = []

    for feature in nearby:
        distance = haversine_meters({"latitude": latitude, "longitude": longitude}, feature_center(feature))
        if distance > radius_meters:
            continue

        proximity = max(0, 1 - distance / radius_meters)
        current = float(feature["properties"].get("probability_score", 0))
        score = clamp(current + bump * proximity, 0, 1)
        feature["properties"]["probability_score"] = round(score, 4)
        feature["properties"]["base_probability_score"] = round(score, 4)
        feature["properties"]["risk_band"] = risk_band(score)
        feature["properties"]["realtime_updates"] = int(feature["properties"].get("realtime_updates", 0)) + 1
        feature["properties"]["last_realtime_report_at"] = now
        changed.append(feature)

    return changed


def calculate_bbox(feature: dict[str, Any]) -> list[float]:
    coordinates = feature.get("geometry", {}).get("coordinates", [])
    points = flatten_coordinate_pairs(coordinates)
    longitudes = [point[0] for point in points]
    latitudes = [point[1] for point in points]
    return [min(longitudes), min(latitudes), max(longitudes), max(latitudes)]


def flatten_coordinate_pairs(value: Any) -> list[list[float]]:
    if (
        isinstance(value, list)
        and len(value) >= 2
        and all(isinstance(item, (int, float)) for item in value[:2])
    ):
        return [value[:2]]

    points: list[list[float]] = []
    if isinstance(value, list):
        for item in value:
            points.extend(flatten_coordinate_pairs(item))
    return points


def feature_center(feature: dict[str, Any]) -> dict[str, float]:
    center = feature["properties"].get("center")
    if isinstance(center, dict):
        return {
            "latitude": float(center["latitude"]),
            "longitude": float(center["longitude"]),
        }

    west, south, east, north = feature["bbox"]
    return {
        "latitude": (south + north) / 2,
        "longitude": (west + east) / 2,
    }


def parse_bbox(value: Optional[str]) -> Optional[dict[str, float]]:
    if not value:
        return None

    raw_parts = value.split(",")
    if len(raw_parts) != 4:
        return None

    try:
        parts = [float(part) for part in raw_parts]
    except ValueError:
        return None

    return {
        "minX": parts[0],
        "minY": parts[1],
        "maxX": parts[2],
        "maxY": parts[3],
    }


def bbox_to_list(bbox: dict[str, float]) -> list[float]:
    return [bbox["minX"], bbox["minY"], bbox["maxX"], bbox["maxY"]]


def bbox_overlaps(feature_bbox: list[float], bbox: dict[str, float]) -> bool:
    west, south, east, north = feature_bbox
    return not (
        east < bbox["minX"]
        or west > bbox["maxX"]
        or north < bbox["minY"]
        or south > bbox["maxY"]
    )


def point_bbox(point: dict[str, float]) -> dict[str, float]:
    return {
        "minX": point["longitude"],
        "minY": point["latitude"],
        "maxX": point["longitude"],
        "maxY": point["latitude"],
    }


def expand_bbox(bbox: dict[str, float], radius_meters: float, latitude: float) -> dict[str, float]:
    lat_delta = radius_meters / 111_320
    lon_delta = radius_meters / (111_320 * math.cos(math.radians(latitude)))
    return {
        "minX": bbox["minX"] - lon_delta,
        "minY": bbox["minY"] - lat_delta,
        "maxX": bbox["maxX"] + lon_delta,
        "maxY": bbox["maxY"] + lat_delta,
    }


def haversine_meters(a: dict[str, float], b: dict[str, float]) -> float:
    earth_radius_meters = 6_371_000
    d_lat = math.radians(b["latitude"] - a["latitude"])
    d_lon = math.radians(b["longitude"] - a["longitude"])
    lat_1 = math.radians(a["latitude"])
    lat_2 = math.radians(b["latitude"])
    h = (
        math.sin(d_lat / 2) ** 2
        + math.cos(lat_1) * math.cos(lat_2) * math.sin(d_lon / 2) ** 2
    )
    return 2 * earth_radius_meters * math.asin(math.sqrt(h))


def clamp(value: float, minimum: float, maximum: float) -> float:
    return min(max(value, minimum), maximum)


def risk_band(score: float) -> str:
    if score >= 0.72:
        return "high"
    if score >= 0.42:
        return "medium"
    return "low"


def color_ramp(score: float) -> str:
    clamped = clamp(score, 0, 1)
    start = (34, 197, 94) if clamped < 0.5 else (234, 179, 8)
    end = (234, 179, 8) if clamped < 0.5 else (239, 68, 68)
    ratio = clamped / 0.5 if clamped < 0.5 else (clamped - 0.5) / 0.5
    channels = [
        round(start[index] + (end[index] - start[index]) * ratio)
        for index in range(3)
    ]
    return f"rgb({channels[0]}, {channels[1]}, {channels[2]})"
