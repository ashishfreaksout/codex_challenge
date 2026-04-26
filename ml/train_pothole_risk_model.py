#!/usr/bin/env python3
"""Train a Bay Area pothole risk model from fused civic and environmental data.

Live San Jose 311 data is useful for current reports. This training script is
for the historical probability surface: it joins historical pothole labels with
rainfall, drainage, pavement, traffic, and water-retention predictors before
emitting the GeoJSON risk grid consumed by the Node prediction service.
"""

from __future__ import annotations

import argparse
import csv
import json
import math
from collections import defaultdict
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Iterable, Optional

try:
    import numpy as np
    from sklearn.ensemble import HistGradientBoostingClassifier
    from sklearn.inspection import permutation_importance
    from sklearn.pipeline import make_pipeline
    from sklearn.preprocessing import StandardScaler
except ImportError as exc:  # pragma: no cover - setup guidance
    raise SystemExit(
        "Missing ML dependencies. Install them with: python3 -m pip install -r ml/requirements.txt"
    ) from exc


MODEL_VERSION = "pothole-risk-fused-hist-gradient-v2"
BAY_AREA_BOUNDS = {
    "west": -122.52,
    "south": 37.23,
    "east": -121.74,
    "north": 37.94,
}
RAINY_MONTHS = {1, 2, 3}
EARTH_METERS_PER_DEGREE_LAT = 111_320
DEFAULT_MAX_ENVIRONMENT_DISTANCE_METERS = 9_000

BAY_WATER_EXCLUSION_POLYGONS = [
    [
        (-122.43, 37.82),
        (-122.42, 37.72),
        (-122.39, 37.66),
        (-122.33, 37.58),
        (-122.26, 37.52),
        (-122.20, 37.55),
        (-122.17, 37.64),
        (-122.19, 37.74),
        (-122.25, 37.84),
        (-122.34, 37.87),
        (-122.43, 37.82),
    ],
    [
        (-122.22, 37.58),
        (-122.12, 37.56),
        (-122.03, 37.51),
        (-121.94, 37.44),
        (-121.94, 37.38),
        (-122.03, 37.36),
        (-122.12, 37.40),
        (-122.20, 37.48),
        (-122.22, 37.58),
    ],
    [
        (-122.49, 37.94),
        (-122.39, 37.88),
        (-122.24, 37.86),
        (-122.08, 37.88),
        (-122.04, 37.94),
        (-122.49, 37.94),
    ],
    [
        (-122.52, 37.23),
        (-122.52, 37.94),
        (-122.50, 37.94),
        (-122.50, 37.80),
        (-122.48, 37.68),
        (-122.43, 37.54),
        (-122.38, 37.38),
        (-122.37, 37.23),
        (-122.52, 37.23),
    ],
]

ENVIRONMENT_FEATURES = [
    "rain_30d_mm",
    "rain_90d_mm",
    "heavy_rain_days_30d",
    "impervious_surface_pct",
    "slope_mean_pct",
    "flow_accumulation_index",
    "topographic_wetness_index",
    "distance_to_storm_drain_m",
    "storm_drain_density_250m",
    "flood_311_count_24m",
    "pavement_condition_index",
    "days_since_last_resurfaced",
    "traffic_aadt",
    "truck_route_score",
    "road_class_score",
]

MODEL_FEATURES = [
    "prior_pothole_count_24m",
    "seasonality_weight",
    "infrastructure_decay",
    *ENVIRONMENT_FEATURES,
]
FEATURE_INDEX = {name: index for index, name in enumerate(MODEL_FEATURES)}

FEATURE_DESCRIPTIONS = {
    "prior_pothole_count_24m": "Historical pothole reports in the same grid cell over 24 months.",
    "seasonality_weight": "Rainy-season multiplier for January through March.",
    "infrastructure_decay": "Risk recovery since the most recent fixed or closed report.",
    "rain_30d_mm": "Recent accumulated rainfall.",
    "rain_90d_mm": "Seasonal accumulated rainfall.",
    "heavy_rain_days_30d": "Count of recent heavy-rain days.",
    "impervious_surface_pct": "Hardscape percentage, used as a runoff proxy.",
    "slope_mean_pct": "Mean slope. Flatter roads are more prone to standing water.",
    "flow_accumulation_index": "Relative upstream runoff concentration.",
    "topographic_wetness_index": "Relative wetness and ponding tendency.",
    "distance_to_storm_drain_m": "Distance to nearest drain or catch basin.",
    "storm_drain_density_250m": "Drain/catch-basin density near the cell.",
    "flood_311_count_24m": "Nearby drainage or flooding complaints over 24 months.",
    "pavement_condition_index": "MTC/local pavement condition score; lower means worse pavement.",
    "days_since_last_resurfaced": "Approximate pavement age since last resurfacing.",
    "traffic_aadt": "Annual average daily traffic or local proxy.",
    "truck_route_score": "Relative heavy-vehicle exposure.",
    "road_class_score": "Road hierarchy proxy from local counts or OSM class.",
}

DATA_SOURCES = [
    {
        "name": "Historical 311 pothole labels",
        "usage": "Positive training labels and recent report frequency.",
        "production_source": "San Francisco 311, Oakland OAK311, San Jose yearly 311 service-request layers.",
    },
    {
        "name": "NOAA rainfall",
        "usage": "30-day rainfall, 90-day rainfall, and heavy-rain-day predictors.",
        "production_source": "NOAA nClimGrid-Daily or NOAA CDO daily precipitation observations.",
    },
    {
        "name": "Drainage and water retention",
        "usage": "Storm-drain distance/density, flood complaints, slope, flow accumulation, wetness.",
        "production_source": "City storm-drain GIS layers, flood/drainage 311 cases, USGS 3DEP DEM.",
    },
    {
        "name": "Pavement condition",
        "usage": "PCI and resurfacing-age predictors.",
        "production_source": "MTC Pavement Condition Index and local StreetSaver exports.",
    },
    {
        "name": "Surface and traffic load",
        "usage": "Impervious surface, road class, traffic, and truck-route predictors.",
        "production_source": "USGS/NLCD, Caltrans AADT, local traffic counts, OSM road class.",
    },
]


@dataclass(frozen=True)
class PotholeRecord:
    latitude: float
    longitude: float
    requested_at: datetime
    status: str
    fixed_at: Optional[datetime]


@dataclass(frozen=True)
class EnvironmentalSample:
    source_region: str
    latitude: float
    longitude: float
    values: dict[str, float]


@dataclass(frozen=True)
class EnvironmentalContext:
    source_region: str
    nearest_distance_m: float
    values: dict[str, float]


DEFAULT_ENVIRONMENT = EnvironmentalContext(
    source_region="Bay Area regional average",
    nearest_distance_m=0,
    values={
        "rain_30d_mm": 64,
        "rain_90d_mm": 176,
        "heavy_rain_days_30d": 4,
        "impervious_surface_pct": 82,
        "slope_mean_pct": 1.3,
        "flow_accumulation_index": 0.72,
        "topographic_wetness_index": 9.4,
        "distance_to_storm_drain_m": 275,
        "storm_drain_density_250m": 4,
        "flood_311_count_24m": 4,
        "pavement_condition_index": 68,
        "days_since_last_resurfaced": 1450,
        "traffic_aadt": 24000,
        "truck_route_score": 0.38,
        "road_class_score": 0.68,
    },
)


def main() -> None:
    args = parse_args()
    as_of = parse_datetime(args.as_of) if args.as_of else datetime.now(timezone.utc)

    bounds = parse_bounds(args.bounds)
    records = load_records(args.input, bounds)
    if not records:
        raise SystemExit(
            f"No usable pothole rows found in {args.input}. Check latitude/longitude/date columns."
        )

    environmental_samples = load_environmental_samples(args.environmental_features)
    lat_step, lon_step = grid_steps(args.grid_size_meters, bounds)
    cell_records = group_records(records, lat_step, lon_step, bounds)
    training_x, training_y = build_training_set(
        records=records,
        cell_records=cell_records,
        environmental_samples=environmental_samples,
        lat_step=lat_step,
        lon_step=lon_step,
        bounds=bounds,
        max_environment_distance_m=args.max_environment_distance_m,
    )
    model, feature_importance = train_model(training_x, training_y)

    feature_collection = build_risk_grid(
        model=model,
        cell_records=cell_records,
        environmental_samples=environmental_samples,
        bounds=bounds,
        lat_step=lat_step,
        lon_step=lon_step,
        as_of=as_of,
        grid_size_meters=args.grid_size_meters,
        training_record_count=len(records),
        feature_importance=feature_importance,
        max_environment_distance_m=args.max_environment_distance_m,
    )

    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(feature_collection, separators=(",", ":")), encoding="utf-8")
    print(
        f"Wrote {len(feature_collection['features'])} cells to {args.output} "
        f"from {len(records)} pothole records and {len(environmental_samples)} environmental samples."
    )


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Build a fused Bay Area pothole risk grid.")
    parser.add_argument(
        "--input",
        type=Path,
        default=Path("data/sample_bay_area_311_potholes.csv"),
        help="Historical 311 CSV containing pothole requests.",
    )
    parser.add_argument(
        "--environmental-features",
        type=Path,
        default=Path("data/sample_bay_area_environmental_features.csv"),
        help="CSV of pre-joined rainfall, drainage, pavement, traffic, and surface predictors.",
    )
    parser.add_argument(
        "--output",
        type=Path,
        default=Path("predictive-service/data/risk_grid.geojson"),
        help="GeoJSON output path consumed by the prediction service.",
    )
    parser.add_argument("--grid-size-meters", type=int, default=100)
    parser.add_argument("--as-of", help="ISO date used for current risk scoring.")
    parser.add_argument(
        "--max-environment-distance-m",
        type=float,
        default=DEFAULT_MAX_ENVIRONMENT_DISTANCE_METERS,
        help="Only score cells close enough to a known road/civic/environment sample.",
    )
    parser.add_argument(
        "--bounds",
        default="bay-area",
        help="Use 'bay-area' or west,south,east,north coordinates.",
    )
    return parser.parse_args()


def parse_bounds(value: str) -> dict[str, float]:
    if value == "bay-area":
        return BAY_AREA_BOUNDS

    parts = [parse_float(part) for part in value.split(",")]
    if len(parts) != 4 or any(part is None for part in parts):
        raise SystemExit("--bounds must be 'bay-area' or west,south,east,north")

    west, south, east, north = parts
    if west >= east or south >= north:
        raise SystemExit("--bounds coordinates must be ordered west,south,east,north")

    return {"west": west, "south": south, "east": east, "north": north}


def load_records(csv_path: Path, bounds: dict[str, float]) -> list[PotholeRecord]:
    if not csv_path.exists():
        raise SystemExit(
            f"Input CSV not found: {csv_path}. Place a 311 pothole CSV there or pass --input."
        )

    with csv_path.open("r", encoding="utf-8-sig", newline="") as handle:
        reader = csv.DictReader(handle)
        if not reader.fieldnames:
            return []
        fields = {normalize_name(field): field for field in reader.fieldnames}
        columns = detect_record_columns(fields)

        records = []
        for row in reader:
            if columns["service_type"] and not is_pothole_row(row.get(columns["service_type"], "")):
                continue

            latitude = parse_float(row.get(columns["latitude"]))
            longitude = parse_float(row.get(columns["longitude"]))
            requested_at = parse_datetime(row.get(columns["requested_at"]))

            if latitude is None or longitude is None or requested_at is None:
                continue

            if not within_bounds(latitude, longitude, bounds):
                continue

            status = str(row.get(columns["status"], "")).strip().lower()
            fixed_at = parse_datetime(row.get(columns["fixed_at"])) if columns["fixed_at"] else None
            records.append(PotholeRecord(latitude, longitude, requested_at, status, fixed_at))

    return sorted(records, key=lambda record: record.requested_at)


def load_environmental_samples(csv_path: Path) -> list[EnvironmentalSample]:
    if not csv_path.exists():
        return [EnvironmentalSample("default", 37.55, -122.05, DEFAULT_ENVIRONMENT.values)]

    with csv_path.open("r", encoding="utf-8-sig", newline="") as handle:
        reader = csv.DictReader(handle)
        if not reader.fieldnames:
            return [EnvironmentalSample("default", 37.55, -122.05, DEFAULT_ENVIRONMENT.values)]

        fields = {normalize_name(field): field for field in reader.fieldnames}
        latitude_col = first_present(fields, "latitude", "lat", "y")
        longitude_col = first_present(fields, "longitude", "long", "lng", "lon", "x")
        region_col = first_present(fields, "source_region", "region", "city", "name")

        samples = []
        for row in reader:
            latitude = parse_float(row.get(latitude_col))
            longitude = parse_float(row.get(longitude_col))
            if latitude is None or longitude is None:
                continue

            values = {}
            for feature in ENVIRONMENT_FEATURES:
                source_col = first_present(fields, feature)
                values[feature] = parse_float(row.get(source_col)) if source_col else None

            merged_values = {
                feature: values[feature]
                if values[feature] is not None
                else DEFAULT_ENVIRONMENT.values[feature]
                for feature in ENVIRONMENT_FEATURES
            }
            samples.append(
                EnvironmentalSample(
                    source_region=str(row.get(region_col) or "environment sample"),
                    latitude=latitude,
                    longitude=longitude,
                    values=merged_values,
                )
            )

    return samples or [EnvironmentalSample("default", 37.55, -122.05, DEFAULT_ENVIRONMENT.values)]


def detect_record_columns(fields: dict[str, str]) -> dict[str, Optional[str]]:
    return {
        "service_type": first_present(
            fields,
            "service_request_type",
            "service_type",
            "service_name",
            "request_type",
            "category",
        ),
        "latitude": first_present(fields, "latitude", "lat", "y"),
        "longitude": first_present(fields, "longitude", "long", "lng", "lon", "x"),
        "requested_at": first_present(
            fields,
            "requested_datetime",
            "created_at",
            "opened_at",
            "request_date",
            "date",
        ),
        "fixed_at": first_present(
            fields,
            "closed_at",
            "closed_datetime",
            "updated_datetime",
            "fixed_at",
            "resolved_at",
        ),
        "status": first_present(fields, "status", "request_status", "case_status") or "",
    }


def first_present(fields: dict[str, str], *candidates: str) -> Optional[str]:
    for candidate in candidates:
        if candidate in fields:
            return fields[candidate]
    return None


def normalize_name(value: str) -> str:
    return value.strip().lower().replace(" ", "_").replace("-", "_")


def is_pothole_row(value: str) -> bool:
    return "pothole" in str(value).lower() or "street_defect" in str(value).lower()


def parse_float(value: object) -> Optional[float]:
    try:
        parsed = float(str(value).strip())
        return parsed if math.isfinite(parsed) else None
    except (TypeError, ValueError):
        return None


def parse_datetime(value: object) -> Optional[datetime]:
    if not value:
        return None

    text = str(value).strip()
    for suffix in ("Z", "z"):
        if text.endswith(suffix):
            text = f"{text[:-1]}+00:00"
            break

    for fmt in (
        None,
        "%Y-%m-%d %H:%M:%S",
        "%m/%d/%Y %H:%M:%S",
        "%m/%d/%Y %I:%M:%S %p",
        "%m/%d/%Y",
        "%Y-%m-%d",
    ):
        try:
            parsed = datetime.fromisoformat(text) if fmt is None else datetime.strptime(text, fmt)
            return parsed if parsed.tzinfo else parsed.replace(tzinfo=timezone.utc)
        except ValueError:
            continue

    return None


def grid_steps(grid_size_meters: int, bounds: dict[str, float]) -> tuple[float, float]:
    mid_lat = (bounds["north"] + bounds["south"]) / 2
    lat_step = grid_size_meters / EARTH_METERS_PER_DEGREE_LAT
    lon_step = grid_size_meters / (EARTH_METERS_PER_DEGREE_LAT * math.cos(math.radians(mid_lat)))
    return lat_step, lon_step


def cell_id_for(latitude: float, longitude: float, lat_step: float, lon_step: float, bounds: dict) -> str:
    row = math.floor((latitude - bounds["south"]) / lat_step)
    col = math.floor((longitude - bounds["west"]) / lon_step)
    return f"{row}:{col}"


def center_for_cell(row: int, col: int, lat_step: float, lon_step: float, bounds: dict) -> tuple[float, float]:
    south = bounds["south"] + row * lat_step
    west = bounds["west"] + col * lon_step
    return south + lat_step / 2, west + lon_step / 2


def group_records(
    records: Iterable[PotholeRecord], lat_step: float, lon_step: float, bounds: dict
) -> dict[str, list[PotholeRecord]]:
    grouped: dict[str, list[PotholeRecord]] = defaultdict(list)
    for record in records:
        grouped[cell_id_for(record.latitude, record.longitude, lat_step, lon_step, bounds)].append(record)
    return grouped


def build_training_set(
    records,
    cell_records,
    environmental_samples,
    lat_step,
    lon_step,
    bounds,
    max_environment_distance_m,
) -> tuple[np.ndarray, np.ndarray]:
    positives = []
    negatives = []
    negative_offsets = ((3, 0), (-3, 0), (0, 3), (0, -3), (5, 5), (-5, 5))

    for record in records:
        cell_id = cell_id_for(record.latitude, record.longitude, lat_step, lon_step, bounds)
        environment = environment_for(record.latitude, record.longitude, environmental_samples)
        positives.append(
            feature_vector_for_cell(
                records=cell_records.get(cell_id, []),
                as_of=record.requested_at,
                environment=environment,
                include_same_day=False,
            )
        )

        row, col = [int(value) for value in cell_id.split(":")]
        for row_offset, col_offset in negative_offsets:
            negative_row = row + row_offset
            negative_col = col + col_offset
            latitude, longitude = center_for_cell(negative_row, negative_col, lat_step, lon_step, bounds)
            if not within_bounds(latitude, longitude, bounds):
                continue

            negative_cell = f"{negative_row}:{negative_col}"
            environment = environment_for(latitude, longitude, environmental_samples)
            if not is_predictable_road_cell(
                latitude=latitude,
                longitude=longitude,
                environment=environment,
                records=cell_records.get(negative_cell, []),
                max_environment_distance_m=max_environment_distance_m,
            ):
                continue
            negatives.append(
                feature_vector_for_cell(
                    records=cell_records.get(negative_cell, []),
                    as_of=record.requested_at,
                    environment=environment,
                    include_same_day=False,
                )
            )

    x = np.array(positives + negatives, dtype=float)
    y = np.array([1] * len(positives) + [0] * len(negatives), dtype=int)
    return x, y


def train_model(x: np.ndarray, y: np.ndarray):
    if len(set(y.tolist())) < 2 or len(y) < 30:
        return None, {}

    model = make_pipeline(
        StandardScaler(),
        HistGradientBoostingClassifier(
            random_state=42,
            max_iter=180,
            learning_rate=0.045,
            max_leaf_nodes=18,
            l2_regularization=0.02,
        ),
    )
    model.fit(x, y)

    return model, estimate_feature_importance(model, x, y)


def estimate_feature_importance(model, x: np.ndarray, y: np.ndarray) -> dict[str, float]:
    try:
        result = permutation_importance(
            model,
            x,
            y,
            n_repeats=6,
            random_state=42,
            scoring="roc_auc",
        )
    except ValueError:
        return {}

    raw_importance = {
        feature: max(0.0, float(result.importances_mean[index]))
        for index, feature in enumerate(MODEL_FEATURES)
    }
    total = sum(raw_importance.values())
    if total <= 0:
        return {}

    return {
        feature: round(value / total, 4)
        for feature, value in sorted(raw_importance.items(), key=lambda item: item[1], reverse=True)
        if value > 0
    }


def build_risk_grid(
    model,
    cell_records,
    environmental_samples,
    bounds,
    lat_step,
    lon_step,
    as_of,
    grid_size_meters,
    training_record_count,
    feature_importance,
    max_environment_distance_m,
):
    features = []
    excluded_water_cells = 0
    excluded_outside_mask_cells = 0
    rows = math.ceil((bounds["north"] - bounds["south"]) / lat_step)
    cols = math.ceil((bounds["east"] - bounds["west"]) / lon_step)

    feature_rows = []
    cell_meta = []
    for row in range(rows):
        for col in range(cols):
            cell_id = f"{row}:{col}"
            records = cell_records.get(cell_id, [])
            center_lat, center_lon = center_for_cell(row, col, lat_step, lon_step, bounds)
            environment = environment_for(center_lat, center_lon, environmental_samples)
            if is_water_cell(center_lat, center_lon):
                excluded_water_cells += 1
                continue

            if not is_predictable_road_cell(
                latitude=center_lat,
                longitude=center_lon,
                environment=environment,
                records=records,
                max_environment_distance_m=max_environment_distance_m,
            ):
                excluded_outside_mask_cells += 1
                continue

            feature_row = feature_vector_for_cell(records, as_of, environment, include_same_day=True)
            feature_rows.append(feature_row)
            cell_meta.append((cell_id, row, col, records, environment))

    probabilities = predict_probabilities(model, np.array(feature_rows, dtype=float))

    for probability, feature_row, (cell_id, row, col, records, environment) in zip(
        probabilities, feature_rows, cell_meta
    ):
        south = bounds["south"] + row * lat_step
        north = min(south + lat_step, bounds["north"])
        west = bounds["west"] + col * lon_step
        east = min(west + lon_step, bounds["east"])
        center_lat = (south + north) / 2
        center_lon = (west + east) / 2
        probability = float(round(probability, 4))
        properties = properties_for_feature(feature_row, records, environment, as_of)

        features.append(
            {
                "type": "Feature",
                "id": cell_id,
                "bbox": [west, south, east, north],
                "properties": {
                    "cell_id": cell_id,
                    "probability_score": probability,
                    "risk_band": risk_band(probability),
                    "grid_size_meters": grid_size_meters,
                    "center": {"latitude": center_lat, "longitude": center_lon},
                    "model_version": MODEL_VERSION,
                    "model_type": "HistGradientBoostingClassifier" if model else "weighted-heuristic",
                    "scored_at": as_of.isoformat(),
                    **properties,
                },
                "geometry": {
                    "type": "Polygon",
                    "coordinates": [
                        [
                            [west, south],
                            [east, south],
                            [east, north],
                            [west, north],
                            [west, south],
                        ]
                    ],
                },
            }
        )

    return {
        "type": "FeatureCollection",
        "properties": {
            "name": "Bay Area fused pothole probability risk grid",
            "grid_size_meters": grid_size_meters,
            "bounds": bounds,
            "generated_at": as_of.isoformat(),
            "model_version": MODEL_VERSION,
            "model_type": "HistGradientBoostingClassifier" if model else "weighted-heuristic",
            "target": "Probability that a grid cell will receive a pothole report in the forecast window.",
            "feature_schema": MODEL_FEATURES,
            "feature_descriptions": FEATURE_DESCRIPTIONS,
            "feature_importance": feature_importance,
            "training_record_count": training_record_count,
            "environmental_sample_count": len(environmental_samples),
            "prediction_mask": {
                "type": "road-land-mask-v1",
                "max_environment_distance_m": max_environment_distance_m,
                "excluded_water_cells": excluded_water_cells,
                "excluded_outside_mask_cells": excluded_outside_mask_cells,
            },
            "data_sources": DATA_SOURCES,
        },
        "features": features,
    }


def properties_for_feature(
    feature_row: list[float],
    records: list[PotholeRecord],
    environment: EnvironmentalContext,
    as_of: datetime,
) -> dict:
    raw = {feature: value_for(feature_row, feature) for feature in MODEL_FEATURES}
    return {
        "temporal_frequency_24m": int(raw["prior_pothole_count_24m"]),
        "prior_pothole_count_24m": int(raw["prior_pothole_count_24m"]),
        "seasonality_weight": round_float(raw["seasonality_weight"]),
        "infrastructure_decay": round_float(raw["infrastructure_decay"]),
        "rain_30d_mm": round_float(raw["rain_30d_mm"]),
        "rain_90d_mm": round_float(raw["rain_90d_mm"]),
        "heavy_rain_days_30d": round_float(raw["heavy_rain_days_30d"]),
        "impervious_surface_pct": round_float(raw["impervious_surface_pct"]),
        "slope_mean_pct": round_float(raw["slope_mean_pct"]),
        "flow_accumulation_index": round_float(raw["flow_accumulation_index"]),
        "topographic_wetness_index": round_float(raw["topographic_wetness_index"]),
        "distance_to_storm_drain_m": round_float(raw["distance_to_storm_drain_m"]),
        "storm_drain_density_250m": round_float(raw["storm_drain_density_250m"]),
        "flood_311_count_24m": round_float(raw["flood_311_count_24m"]),
        "pavement_condition_index": round_float(raw["pavement_condition_index"]),
        "days_since_last_resurfaced": round_float(raw["days_since_last_resurfaced"]),
        "traffic_aadt": round_float(raw["traffic_aadt"]),
        "truck_route_score": round_float(raw["truck_route_score"]),
        "road_class_score": round_float(raw["road_class_score"]),
        "environment_source_region": environment.source_region,
        "environment_source_distance_m": round_float(environment.nearest_distance_m),
        "risk_explanation": top_risk_drivers(feature_row),
        "last_fixed_at": last_fixed_iso(records, as_of),
    }


def feature_vector_for_cell(
    records: list[PotholeRecord],
    as_of: datetime,
    environment: EnvironmentalContext,
    include_same_day: bool,
) -> list[float]:
    recent_count = recent_report_count(records, as_of, include_same_day)
    seasonality_weight = 1.35 if as_of.month in RAINY_MONTHS else 1.0
    decay = infrastructure_decay(records, as_of)
    return [
        recent_count,
        seasonality_weight,
        decay,
        *[environment.values[feature] for feature in ENVIRONMENT_FEATURES],
    ]


def recent_report_count(records: list[PotholeRecord], as_of: datetime, include_same_day: bool) -> int:
    window_start_days = 730
    minimum_days = 0 if include_same_day else 1
    return sum(
        minimum_days <= (as_of - record.requested_at).days <= window_start_days
        for record in records
    )


def infrastructure_decay(records: list[PotholeRecord], as_of: datetime) -> float:
    fixed_dates = [
        record.fixed_at or record.requested_at
        for record in records
        if ("closed" in record.status or "fixed" in record.status or record.fixed_at)
        and (record.fixed_at or record.requested_at) <= as_of
    ]
    if not fixed_dates:
        return 1.0

    days_since_fixed = max(0, (as_of - max(fixed_dates)).days)
    return min(1.0, 1 - math.exp(-days_since_fixed / 365))


def predict_probabilities(model, feature_matrix: np.ndarray) -> np.ndarray:
    heuristic = heuristic_probabilities(feature_matrix)
    if model is None:
        return heuristic

    predicted = model.predict_proba(feature_matrix)[:, 1]
    return np.clip(0.72 * predicted + 0.28 * heuristic, 0, 1)


def heuristic_probabilities(feature_matrix: np.ndarray) -> np.ndarray:
    return np.array([weighted_heuristic_score(row) for row in feature_matrix], dtype=float)


def weighted_heuristic_score(feature_row: list[float]) -> float:
    scores = component_scores(feature_row)
    return clamp(
        0.2 * scores["report history"]
        + 0.18 * scores["rainfall"]
        + 0.24 * scores["water retention"]
        + 0.18 * scores["pavement decay"]
        + 0.12 * scores["traffic load"]
        + 0.05 * scores["repair decay"]
        + 0.03 * scores["seasonality"],
        0,
        1,
    )


def component_scores(feature_row: list[float]) -> dict[str, float]:
    prior_count = value_for(feature_row, "prior_pothole_count_24m")
    seasonality = value_for(feature_row, "seasonality_weight")
    decay = value_for(feature_row, "infrastructure_decay")
    rain_30 = value_for(feature_row, "rain_30d_mm")
    rain_90 = value_for(feature_row, "rain_90d_mm")
    heavy_rain_days = value_for(feature_row, "heavy_rain_days_30d")
    impervious = value_for(feature_row, "impervious_surface_pct")
    slope = value_for(feature_row, "slope_mean_pct")
    flow = value_for(feature_row, "flow_accumulation_index")
    wetness = value_for(feature_row, "topographic_wetness_index")
    drain_distance = value_for(feature_row, "distance_to_storm_drain_m")
    drain_density = value_for(feature_row, "storm_drain_density_250m")
    flood_count = value_for(feature_row, "flood_311_count_24m")
    pci = value_for(feature_row, "pavement_condition_index")
    resurfaced_days = value_for(feature_row, "days_since_last_resurfaced")
    aadt = value_for(feature_row, "traffic_aadt")
    truck_score = value_for(feature_row, "truck_route_score")
    road_class = value_for(feature_row, "road_class_score")

    rainfall_score = clamp(
        0.48 * (rain_30 / 120)
        + 0.32 * (rain_90 / 300)
        + 0.2 * (heavy_rain_days / 8),
        0,
        1,
    )
    low_slope_stagnation = clamp(1 - slope / 6, 0, 1)
    water_retention_score = clamp(
        0.16 * (impervious / 100)
        + 0.18 * low_slope_stagnation
        + 0.18 * flow
        + 0.14 * (wetness / 12)
        + 0.15 * (drain_distance / 450)
        + 0.09 * (1 - clamp(drain_density / 8, 0, 1))
        + 0.1 * (flood_count / 9),
        0,
        1,
    )
    pavement_score = clamp(0.72 * (1 - pci / 100) + 0.28 * (resurfaced_days / 3650), 0, 1)
    traffic_score = clamp(
        0.68 * (math.log1p(max(aadt, 0)) / math.log1p(60000))
        + 0.2 * truck_score
        + 0.12 * road_class,
        0,
        1,
    )

    return {
        "report history": clamp(prior_count / 3, 0, 1),
        "rainfall": rainfall_score,
        "water retention": water_retention_score,
        "pavement decay": pavement_score,
        "traffic load": traffic_score,
        "repair decay": clamp(decay, 0, 1),
        "seasonality": clamp((seasonality - 1) / 0.35, 0, 1),
    }


def top_risk_drivers(feature_row: list[float]) -> list[dict[str, float | str]]:
    scores = component_scores(feature_row)
    labels = {
        "report history": "Nearby historical pothole reports",
        "rainfall": "Recent and seasonal rainfall",
        "water retention": "Standing-water and drainage risk",
        "pavement decay": "Pavement condition and resurfacing age",
        "traffic load": "Traffic and heavy-vehicle exposure",
        "repair decay": "Time since last fixed report",
        "seasonality": "Rainy-season timing",
    }
    return [
        {"driver": labels[name], "score": round_float(score)}
        for name, score in sorted(scores.items(), key=lambda item: item[1], reverse=True)[:4]
    ]


def value_for(feature_row: list[float], feature: str) -> float:
    return float(feature_row[FEATURE_INDEX[feature]])


def environment_for(latitude: float, longitude: float, samples: list[EnvironmentalSample]) -> EnvironmentalContext:
    if not samples:
        return DEFAULT_ENVIRONMENT

    distances = sorted(
        (haversine_meters(latitude, longitude, sample.latitude, sample.longitude), sample)
        for sample in samples
    )
    nearest_distance, nearest_sample = distances[0]
    selected = distances[:4]
    weights = [1 / max(distance, 80) for distance, _ in selected]
    total_weight = sum(weights)

    values = {}
    for feature in ENVIRONMENT_FEATURES:
        values[feature] = sum(
            sample.values[feature] * weights[index]
            for index, (_, sample) in enumerate(selected)
        ) / total_weight

    return EnvironmentalContext(
        source_region=nearest_sample.source_region,
        nearest_distance_m=nearest_distance,
        values=values,
    )


def is_predictable_road_cell(
    latitude: float,
    longitude: float,
    environment: EnvironmentalContext,
    records: list[PotholeRecord],
    max_environment_distance_m: float,
) -> bool:
    if is_water_cell(latitude, longitude):
        return False

    if records:
        return True

    return environment.nearest_distance_m <= max_environment_distance_m


def is_water_cell(latitude: float, longitude: float) -> bool:
    return any(
        point_in_polygon(longitude, latitude, polygon)
        for polygon in BAY_WATER_EXCLUSION_POLYGONS
    )


def point_in_polygon(longitude: float, latitude: float, polygon: list[tuple[float, float]]) -> bool:
    inside = False
    previous_lon, previous_lat = polygon[-1]

    for current_lon, current_lat in polygon:
        crosses_latitude = (current_lat > latitude) != (previous_lat > latitude)
        if crosses_latitude:
            intersection_lon = (
                (previous_lon - current_lon)
                * (latitude - current_lat)
                / (previous_lat - current_lat)
                + current_lon
            )
            if longitude < intersection_lon:
                inside = not inside

        previous_lon, previous_lat = current_lon, current_lat

    return inside


def haversine_meters(lat_a: float, lon_a: float, lat_b: float, lon_b: float) -> float:
    earth_radius_meters = 6_371_000
    d_lat = math.radians(lat_b - lat_a)
    d_lon = math.radians(lon_b - lon_a)
    a_lat = math.radians(lat_a)
    b_lat = math.radians(lat_b)
    h = (
        math.sin(d_lat / 2) ** 2
        + math.cos(a_lat) * math.cos(b_lat) * math.sin(d_lon / 2) ** 2
    )
    return 2 * earth_radius_meters * math.asin(math.sqrt(h))


def risk_band(probability: float) -> str:
    if probability >= 0.72:
        return "high"
    if probability >= 0.42:
        return "medium"
    return "low"


def last_fixed_iso(records: list[PotholeRecord], as_of: datetime) -> Optional[str]:
    fixed_dates = [
        record.fixed_at or record.requested_at
        for record in records
        if ("closed" in record.status or "fixed" in record.status or record.fixed_at)
        and (record.fixed_at or record.requested_at) <= as_of
    ]
    return max(fixed_dates).isoformat() if fixed_dates else None


def within_bounds(latitude: float, longitude: float, bounds: dict) -> bool:
    return (
        bounds["south"] <= latitude <= bounds["north"]
        and bounds["west"] <= longitude <= bounds["east"]
    )


def round_float(value: float) -> float:
    return float(round(float(value), 4))


def clamp(value: float, minimum: float, maximum: float) -> float:
    return min(max(value, minimum), maximum)


if __name__ == "__main__":
    main()
