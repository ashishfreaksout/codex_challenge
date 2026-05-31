#!/usr/bin/env python3
"""Build an explainable road risk feature table from raw PostGIS inputs.

Phase 1 keeps the formula intentionally simple and auditable. It groups pothole
reports to the nearest OSM road segment when roads are loaded; otherwise it
falls back to rounded report locations so the pipeline can still be tested with
only 311 data.
"""

from __future__ import annotations

import argparse
import os

from dotenv import load_dotenv
from sqlalchemy import create_engine, text


DEFAULT_DATABASE_URL = "postgresql+psycopg2://postgres:postgres@localhost:5433/road_risk"


def main() -> None:
    load_dotenv()
    args = parse_args()
    engine = create_engine(database_url(args.database_url), future=True)

    with engine.begin() as connection:
        report_count = connection.execute(
            text("SELECT COUNT(*) FROM raw_311_pothole_reports WHERE geom IS NOT NULL")
        ).scalar_one()

        if report_count == 0:
            connection.execute(text("TRUNCATE TABLE road_risk_features RESTART IDENTITY"))
            print("No pothole reports found in PostGIS. road_risk_features was cleared.")
            return

        connection.execute(BUILD_FEATURES_SQL, {"match_distance_m": args.match_distance_m})
        feature_count = connection.execute(text("SELECT COUNT(*) FROM road_risk_features")).scalar_one()

    print(f"Built {feature_count} road risk feature rows from {report_count} pothole reports.")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--database-url", help="SQLAlchemy PostgreSQL URL.")
    parser.add_argument(
        "--match-distance-m",
        type=float,
        default=75,
        help="Maximum distance for matching pothole reports to OSM roads.",
    )
    return parser.parse_args()


def database_url(cli_value: str | None) -> str:
    return cli_value or os.getenv("ROAD_RISK_DATABASE_URL") or DEFAULT_DATABASE_URL


BUILD_FEATURES_SQL = text(
    """
    TRUNCATE TABLE road_risk_features RESTART IDENTITY;

    WITH matched_reports AS (
      SELECT
        COALESCE(
          road.osm_id,
          'location-' || ROUND(report.latitude::numeric, 3)::text || ':' || ROUND(report.longitude::numeric, 3)::text
        ) AS road_segment_id,
        COALESCE(
          NULLIF(TRIM(road.name), ''),
          NULLIF(TRIM(SPLIT_PART(report.address, '&', 1)), ''),
          'Unknown road'
        ) AS street_name,
        report.opened_at,
        report.geom AS report_geom,
        road.geom AS road_geom,
        road.highway_type,
        road.match_distance_m
      FROM raw_311_pothole_reports report
      LEFT JOIN LATERAL (
        SELECT
          osm_id,
          name,
          highway_type,
          geom,
          ST_Distance(report.geom::geography, geom::geography) AS match_distance_m
        FROM raw_osm_roads
        WHERE geom IS NOT NULL
          AND ST_DWithin(report.geom::geography, geom::geography, :match_distance_m)
        ORDER BY report.geom <-> geom, match_distance_m
        LIMIT 1
      ) road ON TRUE
      WHERE report.geom IS NOT NULL
    ),
    grouped AS (
      SELECT
        road_segment_id,
        MAX(street_name) AS street_name,
        COUNT(*)::integer AS report_count,
        COUNT(*) FILTER (
          WHERE opened_at >= NOW() - INTERVAL '180 days'
        )::integer AS recent_report_count,
        EXTRACT(DAY FROM NOW() - MAX(opened_at))::integer AS days_since_last_report,
        COUNT(road_geom)::integer AS matched_osm_road_count,
        AVG(match_distance_m) AS avg_match_distance_m,
        CASE
          WHEN COUNT(road_geom) > 0 THEN
            ST_LineMerge(ST_CollectionExtract(ST_UnaryUnion(ST_Collect(road_geom)), 2))
          ELSE
            ST_Collect(report_geom)
        END AS geom
      FROM matched_reports
      GROUP BY road_segment_id
    ),
    scored AS (
      SELECT
        road_segment_id,
        street_name,
        report_count,
        recent_report_count,
        days_since_last_report,
        matched_osm_road_count,
        avg_match_distance_m,
        geom,
        LEAST(
          1.0,
          (LEAST(report_count, 10) * 0.08)
          + (LEAST(recent_report_count, 5) * 0.12)
          + (
            GREATEST(0, 1 - COALESCE(days_since_last_report, 365)::double precision / 365.0)
            * 0.25
          )
          + CASE WHEN matched_osm_road_count > 0 THEN 0.05 ELSE 0 END
        ) AS risk_score
      FROM grouped
    )
    INSERT INTO road_risk_features (
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
      geometry_geojson,
      updated_at,
      geom
    )
    SELECT
      road_segment_id,
      street_name,
      ST_Y(ST_Centroid(geom)) AS latitude,
      ST_X(ST_Centroid(geom)) AS longitude,
      report_count,
      recent_report_count,
      days_since_last_report,
      ROUND(risk_score::numeric, 4)::double precision AS risk_score,
      CASE
        WHEN risk_score >= 0.70 THEN 'High'
        WHEN risk_score >= 0.35 THEN 'Medium'
        ELSE 'Low'
      END AS risk_level,
      CASE
        WHEN matched_osm_road_count > 0 THEN 'osm_road_segment'
        ELSE 'report_cluster'
      END AS geometry_source,
      matched_osm_road_count,
      ROUND(avg_match_distance_m::numeric, 2)::double precision AS avg_match_distance_m,
      ST_AsGeoJSON(geom)::jsonb AS geometry_geojson,
      NOW() AS updated_at,
      geom
    FROM scored
    ORDER BY risk_score DESC;
    """
)


if __name__ == "__main__":
    main()
