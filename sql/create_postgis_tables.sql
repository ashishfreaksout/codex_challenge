CREATE EXTENSION IF NOT EXISTS postgis;

CREATE TABLE IF NOT EXISTS raw_311_pothole_reports (
  report_id BIGSERIAL PRIMARY KEY,
  service_request_id TEXT UNIQUE,
  status TEXT,
  category TEXT,
  description TEXT,
  address TEXT,
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  opened_at TIMESTAMPTZ,
  closed_at TIMESTAMPTZ,
  source TEXT,
  loaded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  geom GEOMETRY(Point, 4326)
);

CREATE INDEX IF NOT EXISTS idx_raw_311_pothole_reports_geom
  ON raw_311_pothole_reports
  USING GIST (geom);

CREATE INDEX IF NOT EXISTS idx_raw_311_pothole_reports_opened_at
  ON raw_311_pothole_reports (opened_at);

CREATE INDEX IF NOT EXISTS idx_raw_311_pothole_reports_status
  ON raw_311_pothole_reports (status);

CREATE TABLE IF NOT EXISTS raw_osm_roads (
  road_id BIGSERIAL PRIMARY KEY,
  osm_id TEXT UNIQUE,
  name TEXT,
  highway_type TEXT,
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  geometry_geojson JSONB,
  loaded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  geom GEOMETRY(Geometry, 4326)
);

CREATE INDEX IF NOT EXISTS idx_raw_osm_roads_geom
  ON raw_osm_roads
  USING GIST (geom);

CREATE INDEX IF NOT EXISTS idx_raw_osm_roads_highway_type
  ON raw_osm_roads (highway_type);

CREATE INDEX IF NOT EXISTS idx_raw_osm_roads_name
  ON raw_osm_roads (name);

CREATE TABLE IF NOT EXISTS road_risk_features (
  risk_id BIGSERIAL PRIMARY KEY,
  road_segment_id TEXT,
  street_name TEXT,
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  report_count INTEGER NOT NULL DEFAULT 0,
  recent_report_count INTEGER NOT NULL DEFAULT 0,
  days_since_last_report INTEGER,
  risk_score DOUBLE PRECISION NOT NULL DEFAULT 0,
  risk_level TEXT NOT NULL DEFAULT 'Low',
  geometry_source TEXT NOT NULL DEFAULT 'report_cluster',
  matched_osm_road_count INTEGER NOT NULL DEFAULT 0,
  avg_match_distance_m DOUBLE PRECISION,
  geometry_geojson JSONB,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  geom GEOMETRY(Geometry, 4326)
);

ALTER TABLE road_risk_features
  ADD COLUMN IF NOT EXISTS geometry_source TEXT NOT NULL DEFAULT 'report_cluster';

ALTER TABLE road_risk_features
  ADD COLUMN IF NOT EXISTS matched_osm_road_count INTEGER NOT NULL DEFAULT 0;

ALTER TABLE road_risk_features
  ADD COLUMN IF NOT EXISTS avg_match_distance_m DOUBLE PRECISION;

CREATE INDEX IF NOT EXISTS idx_road_risk_features_geom
  ON road_risk_features
  USING GIST (geom);

CREATE INDEX IF NOT EXISTS idx_road_risk_features_score
  ON road_risk_features (risk_score DESC);

CREATE INDEX IF NOT EXISTS idx_road_risk_features_level
  ON road_risk_features (risk_level);

CREATE INDEX IF NOT EXISTS idx_road_risk_features_source
  ON road_risk_features (geometry_source);
