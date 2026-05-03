const API_BASE_URL = import.meta.env.VITE_API_URL || "";

export async function extractPdfText(file) {
  return extractDocumentText(file);
}

export async function extractDocumentText(fileOrFiles) {
  const files = Array.isArray(fileOrFiles) ? fileOrFiles : [fileOrFiles];
  const formData = new FormData();
  const endpoint = files.length > 1 ? "/api/documents/extract-batch" : "/api/documents/extract";
  const formKey = files.length > 1 ? "files" : "file";

  files.forEach((file) => {
    formData.append(formKey, file);
  });

  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    method: "POST",
    body: formData,
  });

  return parseResponse(response);
}

export async function analyzeAgreement(payload) {
  const token = getStoredToken();
  const response = await fetch(`${API_BASE_URL}/api/analyze`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...authHeader(token),
    },
    body: JSON.stringify(payload),
  });

  return parseResponse(response);
}

export async function signup(payload) {
  const response = await fetch(`${API_BASE_URL}/api/auth/signup`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  return parseResponse(response);
}

export async function login(payload) {
  const response = await fetch(`${API_BASE_URL}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  return parseResponse(response);
}

export async function getCurrentUser(token) {
  const response = await fetch(`${API_BASE_URL}/api/auth/me`, {
    headers: authHeader(token),
  });

  return parseResponse(response);
}

export async function updatePreferences(token, preferences) {
  const response = await fetch(`${API_BASE_URL}/api/auth/preferences`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      ...authHeader(token),
    },
    body: JSON.stringify(preferences),
  });

  return parseResponse(response);
}

export async function listHistory(token) {
  const response = await fetch(`${API_BASE_URL}/api/history`, {
    headers: authHeader(token),
  });

  return parseResponse(response);
}

export async function saveAnalysis(token, payload) {
  const response = await fetch(`${API_BASE_URL}/api/history`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...authHeader(token),
    },
    body: JSON.stringify(payload),
  });

  return parseResponse(response);
}

export async function getSavedAnalysis(token, id) {
  const response = await fetch(`${API_BASE_URL}/api/history/${id}`, {
    headers: authHeader(token),
  });

  return parseResponse(response);
}

export async function renameSavedAnalysis(token, id, documentName) {
  const response = await fetch(`${API_BASE_URL}/api/history/${id}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      ...authHeader(token),
    },
    body: JSON.stringify({ document_name: documentName }),
  });

  return parseResponse(response);
}

export async function deleteSavedAnalysis(token, id) {
  const response = await fetch(`${API_BASE_URL}/api/history/${id}`, {
    method: "DELETE",
    headers: authHeader(token),
  });

  return parseResponse(response);
}

export function getStoredToken() {
  return window.localStorage.getItem("dont-sign-anything-token");
}

export function setStoredToken(token) {
  window.localStorage.setItem("dont-sign-anything-token", token);
}

export function clearStoredToken() {
  window.localStorage.removeItem("dont-sign-anything-token");
}

function authHeader(token) {
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function parseResponse(response) {
  const contentType = response.headers.get("content-type") || "";
  const data = contentType.includes("application/json") ? await response.json() : null;

  if (!response.ok) {
    const detail = data?.detail;
    if (Array.isArray(detail)) {
      throw new Error(detail.map((item) => item.msg).join(" "));
    }
    throw new Error(detail || "Request failed. Please try again.");
  }

  return data;
}
