import { MOCK_SAN_JOSE_311_RESPONSE } from "../data/MockData";

const endpoint =
  process.env.EXPO_PUBLIC_BAY_AREA_311_ENDPOINT ?? process.env.EXPO_PUBLIC_SAN_JOSE_311_ENDPOINT;

export async function fetchSanJose311Potholes() {
  const records = endpoint ? await fetchRecordsFromEndpoint(endpoint) : MOCK_SAN_JOSE_311_RESPONSE;
  return records.map(normalizeSanJose311Record).filter(Boolean);
}

async function fetchRecordsFromEndpoint(url) {
  try {
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`311 request failed with ${response.status}`);
    }

    const payload = await response.json();
    return Array.isArray(payload) ? payload : payload.records || payload.data || [];
  } catch (error) {
    console.warn("Falling back to mock Bay Area 311 data:", error.message);
    return MOCK_SAN_JOSE_311_RESPONSE;
  }
}

export function normalizeSanJose311Record(record) {
  const latitude = Number(
    record.lat ??
      record.latitude ??
      record.location?.latitude ??
      record.geolocation?.latitude ??
      record.point?.latitude
  );
  const longitude = Number(
    record.long ??
      record.lng ??
      record.longitude ??
      record.location?.longitude ??
      record.geolocation?.longitude ??
      record.point?.longitude
  );

  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    return null;
  }

  const status = String(record.status ?? record.request_status ?? "open").toLowerCase();
  const serviceName = record.service_name ?? record.category ?? "Pothole";

  return {
    id:
      record.service_request_id ??
      record.request_id ??
      record.case_id ??
      `sj311-${latitude}-${longitude}`,
    source: record.source ?? (idPrefix(record) === "SJ311" ? "San Jose 311" : "Bay Area 311 mock"),
    title: `${serviceName} report`,
    status: status.includes("closed") || status.includes("fixed") ? "fixed" : "reported",
    severity: record.severity ?? inferSeverity(record.description ?? record.notes ?? ""),
    notes: record.description ?? record.notes ?? record.description_text ?? "",
    address: record.address ?? record.street_address ?? "Bay Area, CA",
    requestedAt: record.requested_datetime ?? record.created_at ?? record.opened_at ?? null,
    updatedAt: record.updated_datetime ?? record.updated_at ?? record.closed_at ?? null,
    coordinate: {
      latitude,
      longitude
    },
    raw: record
  };
}

function idPrefix(record) {
  const identifier = record.service_request_id ?? record.request_id ?? record.case_id ?? "";
  return String(identifier).split("-")[0];
}

function inferSeverity(text) {
  const normalized = text.toLowerCase();

  if (normalized.includes("deep") || normalized.includes("large")) {
    return "High";
  }

  if (normalized.includes("multiple") || normalized.includes("bike lane")) {
    return "Medium";
  }

  return "Low";
}
