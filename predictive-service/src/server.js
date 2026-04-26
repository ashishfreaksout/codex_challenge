const cors = require("cors");
const express = require("express");
const fs = require("fs");
const path = require("path");

const PORT = Number(process.env.PREDICTION_SERVICE_PORT || 4000);
const DATA_PATH =
  process.env.RISK_GRID_PATH ||
  path.join(__dirname, "..", "data", "risk_grid.geojson");
const SAMPLE_DATA_PATH = path.join(__dirname, "..", "data", "risk_grid.sample.geojson");

let riskGrid = null;
let spatialIndex = null;
let RBushCtor = null;

async function main() {
  RBushCtor = (await import("rbush")).default;
  riskGrid = loadRiskGrid();
  buildSpatialIndex();

  const app = express();
  app.use(cors());
  app.use(express.json({ limit: "1mb" }));

  app.get("/health", (_, response) => {
    response.json({
      ok: true,
      feature_count: riskGrid.features.length,
      data_path: fs.existsSync(DATA_PATH) ? DATA_PATH : SAMPLE_DATA_PATH,
      model_version: riskGrid.properties?.model_version || "unknown",
      model_type: riskGrid.properties?.model_type || "unknown",
      data_source_count: Array.isArray(riskGrid.properties?.data_sources)
        ? riskGrid.properties.data_sources.length
        : 0
    });
  });

  app.get("/api/v1/model-metadata", (_, response) => {
    response.json(modelMetadata());
  });

  app.get("/api/v1/predictive-map", (request, response) => {
    const bbox = parseBbox(request.query.bbox);
    const minScore = parseNumber(request.query.minScore, 0.25);
    const limit = parseInt(request.query.limit || "5000", 10);
    const candidates = searchFeatures(bbox)
      .map((feature) => applyGradientWeighting(feature))
      .filter((feature) => feature.properties.probability_score >= minScore)
      .sort((a, b) => b.properties.probability_score - a.properties.probability_score)
      .slice(0, Number.isFinite(limit) ? limit : 5000);

    response.json({
      type: "FeatureCollection",
      properties: {
        ...riskGrid.properties,
        served_at: new Date().toISOString(),
        gradient_algorithm: "rbush-neighborhood-gaussian-v1",
        minScore,
        bbox: bbox ? [bbox.minX, bbox.minY, bbox.maxX, bbox.maxY] : null,
        returned_feature_count: candidates.length
      },
      features: candidates
    });
  });

  app.post("/api/v1/report", (request, response) => {
    const latitude = Number(request.body.latitude);
    const longitude = Number(request.body.longitude);

    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      response.status(400).json({ error: "latitude and longitude are required numbers" });
      return;
    }

    const severity = String(request.body.severity || "Medium");
    const changed = recalculateSector({ latitude, longitude, severity });

    response.json({
      ok: true,
      recalculated_cells: changed.length,
      cells: changed.map((feature) => ({
        cell_id: feature.properties.cell_id,
        probability_score: feature.properties.probability_score
      }))
    });
  });

  app.listen(PORT, () => {
    console.log(`Prediction service listening on http://localhost:${PORT}`);
    console.log(`GET http://localhost:${PORT}/api/v1/predictive-map`);
  });
}

function loadRiskGrid() {
  const sourcePath = fs.existsSync(DATA_PATH) ? DATA_PATH : SAMPLE_DATA_PATH;
  const parsed = JSON.parse(fs.readFileSync(sourcePath, "utf8"));

  if (parsed.type !== "FeatureCollection" || !Array.isArray(parsed.features)) {
    throw new Error(`Invalid risk grid GeoJSON at ${sourcePath}`);
  }

  return {
    ...parsed,
    features: parsed.features.map((feature, index) => normalizeFeature(feature, index))
  };
}

function modelMetadata() {
  return {
    name: riskGrid.properties?.name || "Pothole probability risk grid",
    model_version: riskGrid.properties?.model_version || "unknown",
    model_type: riskGrid.properties?.model_type || "unknown",
    target: riskGrid.properties?.target || "Pothole report probability",
    generated_at: riskGrid.properties?.generated_at || null,
    grid_size_meters: riskGrid.properties?.grid_size_meters || null,
    feature_schema: riskGrid.properties?.feature_schema || [],
    feature_descriptions: riskGrid.properties?.feature_descriptions || {},
    feature_importance: riskGrid.properties?.feature_importance || {},
    training_record_count: riskGrid.properties?.training_record_count || 0,
    environmental_sample_count: riskGrid.properties?.environmental_sample_count || 0,
    prediction_mask: riskGrid.properties?.prediction_mask || null,
    data_sources: riskGrid.properties?.data_sources || []
  };
}

function normalizeFeature(feature, index) {
  const bbox = feature.bbox || calculateBbox(feature);
  const score = clamp(Number(feature.properties?.probability_score ?? 0), 0, 1);

  return {
    ...feature,
    id: feature.id || feature.properties?.cell_id || `cell-${index}`,
    bbox,
    properties: {
      ...(feature.properties || {}),
      cell_id: feature.properties?.cell_id || feature.id || `cell-${index}`,
      probability_score: score,
      base_probability_score: score,
      risk_band: riskBand(score),
      realtime_updates: Number(feature.properties?.realtime_updates || 0)
    }
  };
}

function buildSpatialIndex() {
  spatialIndex = new RBushCtor();
  spatialIndex.load(
    riskGrid.features.map((feature, index) => ({
      minX: feature.bbox[0],
      minY: feature.bbox[1],
      maxX: feature.bbox[2],
      maxY: feature.bbox[3],
      index
    }))
  );
}

function searchFeatures(bbox) {
  if (!bbox) {
    return riskGrid.features;
  }

  return spatialIndex.search(bbox).map((item) => riskGrid.features[item.index]);
}

function applyGradientWeighting(feature) {
  const center = featureCenter(feature);
  const baseScore = Number(feature.properties.probability_score || 0);
  const radiusMeters = 350;
  const searchBox = expandBbox(pointBbox(center), radiusMeters, center.latitude);
  const neighbors = spatialIndex.search(searchBox).map((item) => riskGrid.features[item.index]);

  let weightedScore = baseScore * 1.5;
  let totalWeight = 1.5;

  neighbors.forEach((neighbor) => {
    if (neighbor === feature) {
      return;
    }

    const neighborCenter = featureCenter(neighbor);
    const distance = haversineMeters(center, neighborCenter);
    if (distance > radiusMeters) {
      return;
    }

    const weight = Math.exp(-(distance * distance) / (2 * 175 * 175));
    weightedScore += Number(neighbor.properties.probability_score || 0) * weight;
    totalWeight += weight;
  });

  const score = clamp(Math.max(baseScore, weightedScore / totalWeight), 0, 1);

  return {
    ...feature,
    properties: {
      ...feature.properties,
      base_probability_score: baseScore,
      probability_score: Number(score.toFixed(4)),
      risk_band: riskBand(score),
      fill_color: colorRamp(score),
      fill_opacity: 0.4,
      gradient_weighting_radius_meters: radiusMeters
    }
  };
}

function recalculateSector({ latitude, longitude, severity }) {
  const severityWeight = { low: 0.08, medium: 0.14, high: 0.2, critical: 0.28 };
  const bump = severityWeight[severity.toLowerCase()] || severityWeight.medium;
  const radiusMeters = 250;
  const searchBox = expandBbox(pointBbox({ latitude, longitude }), radiusMeters, latitude);
  const nearby = spatialIndex.search(searchBox).map((item) => riskGrid.features[item.index]);
  const now = new Date().toISOString();

  nearby.forEach((feature) => {
    const distance = haversineMeters({ latitude, longitude }, featureCenter(feature));
    const proximity = Math.max(0, 1 - distance / radiusMeters);
    const current = Number(feature.properties.probability_score || 0);
    const next = clamp(current + bump * proximity, 0, 1);

    feature.properties.probability_score = Number(next.toFixed(4));
    feature.properties.base_probability_score = Number(next.toFixed(4));
    feature.properties.risk_band = riskBand(next);
    feature.properties.realtime_updates = Number(feature.properties.realtime_updates || 0) + 1;
    feature.properties.last_realtime_report_at = now;
  });

  return nearby;
}

function calculateBbox(feature) {
  const coordinates = feature.geometry?.coordinates?.flat(2) || [];
  const lngs = [];
  const lats = [];

  for (let index = 0; index < coordinates.length; index += 2) {
    lngs.push(coordinates[index]);
    lats.push(coordinates[index + 1]);
  }

  return [Math.min(...lngs), Math.min(...lats), Math.max(...lngs), Math.max(...lats)];
}

function featureCenter(feature) {
  if (feature.properties?.center) {
    return {
      latitude: Number(feature.properties.center.latitude),
      longitude: Number(feature.properties.center.longitude)
    };
  }

  const [west, south, east, north] = feature.bbox;
  return {
    latitude: (south + north) / 2,
    longitude: (west + east) / 2
  };
}

function parseBbox(value) {
  if (!value) {
    return null;
  }

  const parts = String(value).split(",").map(Number);
  if (parts.length !== 4 || parts.some((part) => !Number.isFinite(part))) {
    return null;
  }

  return {
    minX: parts[0],
    minY: parts[1],
    maxX: parts[2],
    maxY: parts[3]
  };
}

function pointBbox({ latitude, longitude }) {
  return { minX: longitude, minY: latitude, maxX: longitude, maxY: latitude };
}

function expandBbox(bbox, radiusMeters, latitude) {
  const latDelta = radiusMeters / 111_320;
  const lonDelta = radiusMeters / (111_320 * Math.cos((latitude * Math.PI) / 180));

  return {
    minX: bbox.minX - lonDelta,
    minY: bbox.minY - latDelta,
    maxX: bbox.maxX + lonDelta,
    maxY: bbox.maxY + latDelta
  };
}

function haversineMeters(a, b) {
  const earthRadiusMeters = 6_371_000;
  const dLat = toRadians(b.latitude - a.latitude);
  const dLon = toRadians(b.longitude - a.longitude);
  const lat1 = toRadians(a.latitude);
  const lat2 = toRadians(b.latitude);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * earthRadiusMeters * Math.asin(Math.sqrt(h));
}

function toRadians(value) {
  return (value * Math.PI) / 180;
}

function parseNumber(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function riskBand(score) {
  if (score >= 0.72) {
    return "high";
  }
  if (score >= 0.42) {
    return "medium";
  }
  return "low";
}

function colorRamp(score) {
  const clamped = clamp(score, 0, 1);
  const start = clamped < 0.5 ? [34, 197, 94] : [234, 179, 8];
  const end = clamped < 0.5 ? [234, 179, 8] : [239, 68, 68];
  const ratio = clamped < 0.5 ? clamped / 0.5 : (clamped - 0.5) / 0.5;
  const [red, green, blue] = start.map((channel, index) =>
    Math.round(channel + (end[index] - channel) * ratio)
  );
  return `rgb(${red}, ${green}, ${blue})`;
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
