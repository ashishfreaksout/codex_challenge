const DEFAULT_API_BASE_URL = "http://127.0.0.1:8000";

export function getDefaultApiBaseUrl() {
  return DEFAULT_API_BASE_URL;
}

export async function extractDocumentText(apiBaseUrl, files) {
  const selectedFiles = Array.isArray(files) ? files : [files];
  const formData = new FormData();
  const endpoint = selectedFiles.length > 1 ? "/api/documents/extract-batch" : "/api/documents/extract";
  const formKey = selectedFiles.length > 1 ? "files" : "file";

  selectedFiles.forEach((file) => {
    formData.append(formKey, {
      uri: file.uri,
      name: file.name,
      type: file.type || "application/octet-stream",
    });
  });

  const response = await fetch(`${cleanBaseUrl(apiBaseUrl)}${endpoint}`, {
    method: "POST",
    body: formData,
  });

  return parseResponse(response);
}

export async function analyzeAgreement(apiBaseUrl, token, payload) {
  return request(apiBaseUrl, "/api/analyze", {
    method: "POST",
    token,
    body: payload,
  });
}

export async function signup(apiBaseUrl, payload) {
  return request(apiBaseUrl, "/api/auth/signup", {
    method: "POST",
    body: payload,
  });
}

export async function login(apiBaseUrl, payload) {
  return request(apiBaseUrl, "/api/auth/login", {
    method: "POST",
    body: payload,
  });
}

export async function getCurrentUser(apiBaseUrl, token) {
  return request(apiBaseUrl, "/api/auth/me", { token });
}

export async function updatePreferences(apiBaseUrl, token, preferences) {
  return request(apiBaseUrl, "/api/auth/preferences", {
    method: "PUT",
    token,
    body: preferences,
  });
}

export async function listHistory(apiBaseUrl, token) {
  return request(apiBaseUrl, "/api/history", { token });
}

export async function saveAnalysis(apiBaseUrl, token, payload) {
  return request(apiBaseUrl, "/api/history", {
    method: "POST",
    token,
    body: payload,
  });
}

export async function getSavedAnalysis(apiBaseUrl, token, id) {
  return request(apiBaseUrl, `/api/history/${id}`, { token });
}

export async function deleteSavedAnalysis(apiBaseUrl, token, id) {
  return request(apiBaseUrl, `/api/history/${id}`, {
    method: "DELETE",
    token,
  });
}

async function request(apiBaseUrl, path, options = {}) {
  const headers = {
    ...(options.body ? { "Content-Type": "application/json" } : {}),
    ...(options.token ? { Authorization: `Bearer ${options.token}` } : {}),
  };

  const response = await fetch(`${cleanBaseUrl(apiBaseUrl)}${path}`, {
    method: options.method || "GET",
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  return parseResponse(response);
}

async function parseResponse(response) {
  const contentType = response.headers.get("content-type") || "";
  const data = contentType.includes("application/json") ? await response.json() : null;

  if (!response.ok) {
    const detail = data?.detail;
    if (Array.isArray(detail)) {
      throw new Error(detail.map((item) => item.msg).join(" "));
    }
    throw new Error(detail || "Request failed. Check your backend URL and try again.");
  }

  return data;
}

function cleanBaseUrl(apiBaseUrl) {
  return (apiBaseUrl || DEFAULT_API_BASE_URL).replace(/\/+$/, "");
}
