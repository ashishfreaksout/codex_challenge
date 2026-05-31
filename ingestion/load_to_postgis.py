#!/usr/bin/env python3
"""Load available raw 311 and OSM files into PostgreSQL/PostGIS.

The loader is safe to run repeatedly. It upserts 311 records by
service_request_id and OSM roads by osm_id. Missing input files are skipped so
you can load one source at a time while building the pipeline.
"""

from __future__ import annotations

import argparse
import csv
import json
import os
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from dotenv import load_dotenv
from sqlalchemy import create_engine, text


DEFAULT_DATABASE_URL = "postgresql+psycopg2://postgres:postgres@localhost:5433/road_risk"
DEFAULT_POTHOLES_PATH = Path("data/raw/sanjose_311_potholes.json")
DEFAULT_OSM_PATH = Path("data/raw/osm_roads_sanjose.json")
SCHEMA_PATH = Path("sql/create_postgis_tables.sql")


def main() -> None:
    load_dotenv()
    args = parse_args()
    engine = create_engine(database_url(args.database_url), future=True)

    if args.init_schema:
        initialize_schema(engine)

    pothole_count = load_potholes(engine, args.potholes, args.pothole_source)
    road_count = load_roads(engine, args.osm_roads)
    print(f"Load complete. 311 rows loaded/upserted: {pothole_count}; OSM roads loaded/upserted: {road_count}")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--database-url", help="SQLAlchemy PostgreSQL URL.")
    parser.add_argument(
        "--potholes",
        type=Path,
        default=DEFAULT_POTHOLES_PATH,
        help=f"Raw 311 JSON/CSV path. Default: {DEFAULT_POTHOLES_PATH}",
    )
    parser.add_argument(
        "--pothole-source",
        help="Optional source label stored on loaded 311 rows.",
    )
    parser.add_argument(
        "--osm-roads",
        type=Path,
        default=DEFAULT_OSM_PATH,
        help=f"Raw OSM roads JSON path. Default: {DEFAULT_OSM_PATH}",
    )
    parser.add_argument(
        "--init-schema",
        action="store_true",
        help="Run sql/create_postgis_tables.sql before loading data.",
    )
    return parser.parse_args()


def database_url(cli_value: str | None) -> str:
    return cli_value or os.getenv("ROAD_RISK_DATABASE_URL") or DEFAULT_DATABASE_URL


def initialize_schema(engine) -> None:
    if not SCHEMA_PATH.exists():
        print(f"Schema file is missing: {SCHEMA_PATH}")
        return

    raw_connection = engine.raw_connection()
    try:
        with raw_connection.cursor() as cursor:
            cursor.execute(SCHEMA_PATH.read_text(encoding="utf-8"))
        raw_connection.commit()
        print(f"Initialized PostGIS schema from {SCHEMA_PATH}")
    finally:
        raw_connection.close()


def load_potholes(engine, path: Path, source_label: str | None) -> int:
    records = read_records(path, key="records")
    if not records:
        print(f"No 311 input records found at {path}; skipping pothole load.")
        return 0

    loaded = 0
    default_source = source_label or infer_pothole_source(path)
    with engine.begin() as connection:
        for record in records:
            normalized = normalize_pothole_record(record, default_source)
            if not normalized:
                continue
            connection.execute(POTHOLE_UPSERT_SQL, normalized)
            loaded += 1
    return loaded


def load_roads(engine, path: Path) -> int:
    records = read_records(path, key="roads")
    if not records:
        print(f"No OSM road records found at {path}; skipping road load.")
        return 0

    loaded = 0
    with engine.begin() as connection:
        for record in records:
            normalized = normalize_road_record(record)
            if not normalized:
                continue
            connection.execute(OSM_ROAD_UPSERT_SQL, normalized)
            loaded += 1
    return loaded


def read_records(path: Path, key: str) -> list[dict[str, Any]]:
    if not path.exists():
        return []

    if path.suffix.lower() == ".csv":
        with path.open("r", encoding="utf-8", newline="") as file:
            return list(csv.DictReader(file))

    payload = json.loads(path.read_text(encoding="utf-8"))
    if isinstance(payload, list):
        return [item for item in payload if isinstance(item, dict)]
    if isinstance(payload, dict) and isinstance(payload.get(key), list):
        return [item for item in payload[key] if isinstance(item, dict)]
    return []


def normalize_pothole_record(record: dict[str, Any], default_source: str) -> dict[str, Any] | None:
    latitude = number_from(record, "latitude", "lat", "y")
    longitude = number_from(record, "longitude", "long", "lng", "x")
    if latitude is None or longitude is None:
        return None

    opened_at = value_from(record, "opened_at", "requested_datetime", "created_at", "opened")
    service_request_id = value_from(record, "service_request_id", "request_id", "case_id")
    if not service_request_id:
        service_request_id = f"generated-{latitude:.6f}-{longitude:.6f}-{opened_at or 'unknown'}"

    return {
        "service_request_id": str(service_request_id),
        "status": value_from(record, "status", "request_status"),
        "category": value_from(record, "category", "service_request_type", "service_name", "service_code"),
        "description": value_from(record, "description", "notes", "description_text"),
        "address": value_from(record, "address", "street_address"),
        "latitude": latitude,
        "longitude": longitude,
        "opened_at": parse_datetime(opened_at),
        "closed_at": parse_datetime(value_from(record, "closed_at", "closed_datetime", "updated_datetime")),
        "source": value_from(record, "source") or default_source,
    }


def infer_pothole_source(path: Path) -> str:
    normalized_name = path.name.lower().replace("-", "_")
    if "bay_area" in normalized_name:
        return "Bay Area 311 sample"
    if "san_jose" in normalized_name or "sanjose" in normalized_name:
        return "San Jose 311"
    return "311 pothole/service reports"


def normalize_road_record(record: dict[str, Any]) -> dict[str, Any] | None:
    geometry = record.get("geometry_geojson") or record.get("geometry")
    if not isinstance(geometry, dict):
        return None

    latitude = number_from(record, "latitude", "lat")
    longitude = number_from(record, "longitude", "lon", "lng")
    if latitude is None or longitude is None:
        latitude, longitude = centroid_from_geometry(geometry)

    osm_id = value_from(record, "osm_id", "id")
    if not osm_id:
        return None

    return {
        "osm_id": str(osm_id),
        "name": value_from(record, "name"),
        "highway_type": value_from(record, "highway_type", "highway"),
        "latitude": latitude,
        "longitude": longitude,
        "geometry_geojson": json.dumps(geometry),
        "geometry_text": json.dumps(geometry),
    }


def value_from(record: dict[str, Any], *keys: str) -> Any:
    for key in keys:
        value = record.get(key)
        if value not in (None, ""):
            return value
    return None


def number_from(record: dict[str, Any], *keys: str) -> float | None:
    value = value_from(record, *keys)
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def parse_datetime(value: Any) -> str | None:
    if not value:
        return None
    text_value = str(value)
    try:
        return datetime.fromisoformat(text_value.replace("Z", "+00:00")).isoformat()
    except ValueError:
        return text_value


def centroid_from_geometry(geometry: dict[str, Any]) -> tuple[float | None, float | None]:
    coordinates = geometry.get("coordinates") or []
    flattened = flatten_coordinates(coordinates)
    if not flattened:
        return None, None
    longitudes = [point[0] for point in flattened]
    latitudes = [point[1] for point in flattened]
    return sum(latitudes) / len(latitudes), sum(longitudes) / len(longitudes)


def flatten_coordinates(value: Any) -> list[list[float]]:
    if not isinstance(value, list):
        return []
    if len(value) >= 2 and all(isinstance(item, (int, float)) for item in value[:2]):
        return [[float(value[0]), float(value[1])]]
    points: list[list[float]] = []
    for item in value:
        points.extend(flatten_coordinates(item))
    return points


POTHOLE_UPSERT_SQL = text(
    """
    INSERT INTO raw_311_pothole_reports (
      service_request_id, status, category, description, address,
      latitude, longitude, opened_at, closed_at, source, loaded_at, geom
    )
    VALUES (
      :service_request_id, :status, :category, :description, :address,
      :latitude, :longitude, :opened_at, :closed_at, :source, :loaded_at,
      ST_SetSRID(ST_MakePoint(:longitude, :latitude), 4326)
    )
    ON CONFLICT (service_request_id) DO UPDATE SET
      status = EXCLUDED.status,
      category = EXCLUDED.category,
      description = EXCLUDED.description,
      address = EXCLUDED.address,
      latitude = EXCLUDED.latitude,
      longitude = EXCLUDED.longitude,
      opened_at = EXCLUDED.opened_at,
      closed_at = EXCLUDED.closed_at,
      source = EXCLUDED.source,
      loaded_at = EXCLUDED.loaded_at,
      geom = EXCLUDED.geom
    """
).bindparams(loaded_at=datetime.now(timezone.utc).isoformat())


OSM_ROAD_UPSERT_SQL = text(
    """
    INSERT INTO raw_osm_roads (
      osm_id, name, highway_type, latitude, longitude,
      geometry_geojson, loaded_at, geom
    )
    VALUES (
      :osm_id, :name, :highway_type, :latitude, :longitude,
      CAST(:geometry_geojson AS jsonb), :loaded_at,
      ST_SetSRID(ST_GeomFromGeoJSON(:geometry_text), 4326)
    )
    ON CONFLICT (osm_id) DO UPDATE SET
      name = EXCLUDED.name,
      highway_type = EXCLUDED.highway_type,
      latitude = EXCLUDED.latitude,
      longitude = EXCLUDED.longitude,
      geometry_geojson = EXCLUDED.geometry_geojson,
      loaded_at = EXCLUDED.loaded_at,
      geom = EXCLUDED.geom
    """
).bindparams(loaded_at=datetime.now(timezone.utc).isoformat())


if __name__ == "__main__":
    main()
