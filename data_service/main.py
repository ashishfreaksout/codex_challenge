"""FastAPI service for the PostGIS-backed road risk feature table.

This service is separate from the existing Node prediction service. It exposes
data-engineering outputs from PostGIS while leaving the current frontend and
prediction overlay untouched.
"""

from __future__ import annotations

import json
import os
from typing import Any, Optional

import geojson
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import create_engine, text
from sqlalchemy.exc import SQLAlchemyError


load_dotenv()

DEFAULT_DATABASE_URL = "postgresql+psycopg2://postgres:postgres@localhost:5433/road_risk"
DATABASE_URL = os.getenv("ROAD_RISK_DATABASE_URL", DEFAULT_DATABASE_URL)

engine = create_engine(DATABASE_URL, pool_pre_ping=True, future=True)

app = FastAPI(
    title="Geospatial Road Risk Data Service",
    version="0.1.0",
    description="PostGIS-backed API for road risk summaries and GeoJSON map layers.",
)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
def health() -> dict[str, Any]:
    try:
        with engine.connect() as connection:
            connection.execute(text("SELECT 1"))
            raw_311_count = connection.execute(text("SELECT COUNT(*) FROM raw_311_pothole_reports")).scalar_one()
            raw_road_count = connection.execute(text("SELECT COUNT(*) FROM raw_osm_roads")).scalar_one()
            feature_count = connection.execute(text("SELECT COUNT(*) FROM road_risk_features")).scalar_one()
    except SQLAlchemyError as exc:
        return {
            "ok": False,
            "database": "unavailable",
            "error": str(exc.__class__.__name__),
        }

    return {
        "ok": True,
        "database": "road_risk",
        "postgis": True,
        "raw_311_pothole_reports": raw_311_count,
        "raw_osm_roads": raw_road_count,
        "road_risk_features": feature_count,
    }


@app.get("/risk-summary")
def risk_summary() -> dict[str, Any]:
    try:
        with engine.connect() as connection:
            totals = connection.execute(SUMMARY_TOTALS_SQL).mappings().one()
            levels = connection.execute(SUMMARY_LEVELS_SQL).mappings().all()
            top_segments = connection.execute(SUMMARY_TOP_SEGMENTS_SQL).mappings().all()
    except SQLAlchemyError as exc:
        raise HTTPException(status_code=503, detail=f"PostGIS query failed: {exc}") from exc

    return {
        "total_segments": totals["total_segments"],
        "avg_risk_score": round(float(totals["avg_risk_score"] or 0), 4),
        "max_risk_score": round(float(totals["max_risk_score"] or 0), 4),
        "osm_matched_segments": totals["osm_matched_segments"],
        "report_cluster_segments": totals["report_cluster_segments"],
        "risk_levels": [dict(row) for row in levels],
        "top_segments": [dict(row) for row in top_segments],
    }


@app.get("/risk-grid")
def risk_grid(
    min_score: float = Query(default=0.0, ge=0.0, le=1.0),
    limit: int = Query(default=5000, ge=1, le=25000),
    bbox: Optional[str] = Query(
        default=None,
        description="Optional bounds as west,south,east,north.",
    ),
) -> dict[str, Any]:
    bounds = parse_bbox(bbox)
    try:
        with engine.connect() as connection:
            rows = connection.execute(
                RISK_GRID_SQL,
                {
                    "min_score": min_score,
                    "limit": limit,
                    "west": bounds[0] if bounds else None,
                    "south": bounds[1] if bounds else None,
                    "east": bounds[2] if bounds else None,
                    "north": bounds[3] if bounds else None,
                    "has_bbox": bounds is not None,
                },
            ).mappings().all()
    except SQLAlchemyError as exc:
        raise HTTPException(status_code=503, detail=f"PostGIS query failed: {exc}") from exc

    features = []
    for row in rows:
        geometry = parse_json(row["geometry"])
        if not geometry:
            continue

        features.append(
            geojson.Feature(
                id=row["risk_id"],
                geometry=geometry,
                properties={
                    "risk_id": row["risk_id"],
                    "road_segment_id": row["road_segment_id"],
                    "street_name": row["street_name"],
                    "latitude": row["latitude"],
                    "longitude": row["longitude"],
                    "report_count": row["report_count"],
                    "recent_report_count": row["recent_report_count"],
                    "days_since_last_report": row["days_since_last_report"],
                    "risk_score": row["risk_score"],
                    "risk_level": row["risk_level"],
                    "geometry_source": row["geometry_source"],
                    "matched_osm_road_count": row["matched_osm_road_count"],
                    "avg_match_distance_m": row["avg_match_distance_m"],
                    "updated_at": row["updated_at"].isoformat() if row["updated_at"] else None,
                },
            )
        )

    return geojson.FeatureCollection(
        features,
        properties={
            "source": "road_risk_features",
            "min_score": min_score,
            "bbox": bounds,
            "returned_feature_count": len(features),
        },
    )


@app.get("/api/v1/predictive-map")
def predictive_map_compatible(
    bbox: Optional[str] = Query(default=None),
    minScore: float = Query(default=0.25, ge=0.0, le=1.0),
    limit: int = Query(default=5000, ge=1, le=25000),
    bufferMeters: float = Query(default=45, ge=1, le=100),
) -> dict[str, Any]:
    """Frontend-compatible GeoJSON endpoint backed by PostGIS road risk features.

    Existing app code expects polygon features with a probability_score field.
    This endpoint buffers road lines/report points into small polygons and maps
    risk_score to probability_score so the current predicted layer can render it
    without replacing the original Node prediction service.
    """
    bounds = parse_bbox(bbox)
    try:
        with engine.connect() as connection:
            rows = connection.execute(
                PREDICTIVE_MAP_SQL,
                {
                    "min_score": minScore,
                    "limit": limit,
                    "buffer_meters": bufferMeters,
                    "west": bounds[0] if bounds else None,
                    "south": bounds[1] if bounds else None,
                    "east": bounds[2] if bounds else None,
                    "north": bounds[3] if bounds else None,
                    "has_bbox": bounds is not None,
                },
            ).mappings().all()
    except SQLAlchemyError as exc:
        raise HTTPException(status_code=503, detail=f"PostGIS query failed: {exc}") from exc

    features = []
    for row in rows:
        geometry = parse_json(row["geometry"])
        if not geometry:
            continue
        score = float(row["risk_score"] or 0)
        features.append(
            geojson.Feature(
                id=row["risk_id"],
                geometry=geometry,
                properties={
                    "cell_id": str(row["risk_id"]),
                    "road_segment_id": row["road_segment_id"],
                    "street_name": row["street_name"],
                    "probability_score": round(score, 4),
                    "risk_score": round(score, 4),
                    "risk_band": str(row["risk_level"] or "Low").lower(),
                    "risk_level": row["risk_level"],
                    "geometry_source": row["geometry_source"],
                    "matched_osm_road_count": row["matched_osm_road_count"],
                    "avg_match_distance_m": row["avg_match_distance_m"],
                    "report_count": row["report_count"],
                    "recent_report_count": row["recent_report_count"],
                    "days_since_last_report": row["days_since_last_report"],
                    "center": {
                        "latitude": row["latitude"],
                        "longitude": row["longitude"],
                    },
                    "model_version": "postgis-road-risk-features-v1",
                    "model_type": "PostGIS explainable feature table",
                },
            )
        )

    return geojson.FeatureCollection(
        features,
        properties={
            "name": "PostGIS road risk feature map",
            "model_version": "postgis-road-risk-features-v1",
            "model_type": "PostGIS explainable feature table",
            "served_at": datetime_now_iso(),
            "minScore": minScore,
            "bbox": bounds,
            "returned_feature_count": len(features),
            "data_sources": ["311 pothole/service reports", "OpenStreetMap roads", "PostGIS transformations"],
        },
    )


def parse_bbox(value: Optional[str]) -> Optional[list[float]]:
    if not value:
        return None
    parts = [part.strip() for part in value.split(",")]
    if len(parts) != 4:
        raise HTTPException(status_code=400, detail="bbox must be west,south,east,north")
    try:
        west, south, east, north = [float(part) for part in parts]
    except ValueError as exc:
        raise HTTPException(status_code=400, detail="bbox values must be numbers") from exc
    if west >= east or south >= north:
        raise HTTPException(status_code=400, detail="bbox must satisfy west < east and south < north")
    return [west, south, east, north]


def parse_json(value: Any) -> dict[str, Any] | None:
    if isinstance(value, dict):
        return value
    if isinstance(value, str):
        return json.loads(value)
    return None


def datetime_now_iso() -> str:
    from datetime import datetime, timezone

    return datetime.now(timezone.utc).isoformat()


SUMMARY_TOTALS_SQL = text(
    """
    SELECT
      COUNT(*)::integer AS total_segments,
      COALESCE(AVG(risk_score), 0) AS avg_risk_score,
      COALESCE(MAX(risk_score), 0) AS max_risk_score,
      COUNT(*) FILTER (WHERE geometry_source = 'osm_road_segment')::integer AS osm_matched_segments,
      COUNT(*) FILTER (WHERE geometry_source = 'report_cluster')::integer AS report_cluster_segments
    FROM road_risk_features
    """
)

SUMMARY_LEVELS_SQL = text(
    """
    SELECT
      risk_level,
      COUNT(*)::integer AS segment_count,
      ROUND(AVG(risk_score)::numeric, 4)::double precision AS avg_risk_score
    FROM road_risk_features
    GROUP BY risk_level
    ORDER BY
      CASE risk_level
        WHEN 'High' THEN 1
        WHEN 'Medium' THEN 2
        ELSE 3
      END
    """
)

SUMMARY_TOP_SEGMENTS_SQL = text(
    """
    SELECT
      road_segment_id,
      street_name,
      report_count,
      recent_report_count,
      days_since_last_report,
      risk_score,
      risk_level,
      geometry_source,
      matched_osm_road_count,
      avg_match_distance_m
    FROM road_risk_features
    ORDER BY risk_score DESC, report_count DESC
    LIMIT 10
    """
)

RISK_GRID_SQL = text(
    """
    SELECT
      risk_id,
      road_segment_id,
      street_name,
      latitude,
      longitude,
      report_count,
      recent_report_count,
      days_since_last_report,
      risk_score,
      risk_level,
      geometry_source,
      matched_osm_road_count,
      avg_match_distance_m,
      updated_at,
      COALESCE(geometry_geojson, ST_AsGeoJSON(geom)::jsonb) AS geometry
    FROM road_risk_features
    WHERE risk_score >= :min_score
      AND geom IS NOT NULL
      AND (
        :has_bbox = FALSE
        OR ST_Intersects(geom, ST_MakeEnvelope(:west, :south, :east, :north, 4326))
      )
    ORDER BY risk_score DESC, report_count DESC
    LIMIT :limit
    """
)

PREDICTIVE_MAP_SQL = text(
    """
    SELECT
      risk_id,
      road_segment_id,
      street_name,
      latitude,
      longitude,
      report_count,
      recent_report_count,
      days_since_last_report,
      risk_score,
      risk_level,
      geometry_source,
      matched_osm_road_count,
      avg_match_distance_m,
      ST_AsGeoJSON(ST_Buffer(geom::geography, :buffer_meters)::geometry)::jsonb AS geometry
    FROM road_risk_features
    WHERE risk_score >= :min_score
      AND geom IS NOT NULL
      AND (
        :has_bbox = FALSE
        OR ST_Intersects(geom, ST_MakeEnvelope(:west, :south, :east, :north, 4326))
      )
    ORDER BY risk_score DESC, report_count DESC
    LIMIT :limit
    """
)
