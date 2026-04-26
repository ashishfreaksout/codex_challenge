const DEFAULT_PREDICTION_SERVICE_URL =
  "https://ashishfreaksout-bay-area-pothole-prediction-api.hf.space";

export function predictionServiceUrl() {
  return (
    process.env.EXPO_PUBLIC_PREDICTION_SERVICE_URL || DEFAULT_PREDICTION_SERVICE_URL
  ).replace(/\/$/, "");
}

export async function fetchPredictiveMap({ bbox, minScore = 0.25, limit = 5000 } = {}) {
  const params = new URLSearchParams({
    minScore: String(minScore),
    limit: String(limit)
  });

  if (bbox) {
    params.set("bbox", bbox.join(","));
  }

  const response = await fetch(
    `${predictionServiceUrl()}/api/v1/predictive-map?${params.toString()}`
  );

  if (!response.ok) {
    throw new Error(`Prediction service returned ${response.status}`);
  }

  return response.json();
}

export async function fetchPredictionModelMetadata() {
  const response = await fetch(`${predictionServiceUrl()}/api/v1/model-metadata`);

  if (!response.ok) {
    throw new Error(`Prediction metadata returned ${response.status}`);
  }

  return response.json();
}

export async function fetchHighRiskPredictionNearLocation(coordinate) {
  const latitudeDelta = 0.012;
  const longitudeDelta = 0.012;
  const geojson = await fetchPredictiveMap({
    bbox: [
      coordinate.longitude - longitudeDelta,
      coordinate.latitude - latitudeDelta,
      coordinate.longitude + longitudeDelta,
      coordinate.latitude + latitudeDelta
    ],
    minScore: 0.72,
    limit: 1
  });

  return geojson.features?.[0] || null;
}

export async function notifyPredictionService(report) {
  const response = await fetch(`${predictionServiceUrl()}/api/v1/report`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      latitude: report.coordinate.latitude,
      longitude: report.coordinate.longitude,
      severity: report.severity,
      notes: report.notes,
      source: report.source,
      reportedAt: report.requestedAt
    })
  });

  if (!response.ok) {
    throw new Error(`Prediction update returned ${response.status}`);
  }

  return response.json();
}
