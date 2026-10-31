export const API_BASE_URL = (() => {
  if (import.meta.env.VITE_API_BASE_URL) {
    return import.meta.env.VITE_API_BASE_URL.replace(/\/$/, "");
  }
  // When running in the browser, relative path "" allows same-origin requests
  // and Vite proxying, eliminating CORS and IPv6 resolution mismatches
  if (typeof window !== "undefined") {
    return "";
  }
  return "http://127.0.0.1:3000";
})();

export function getApiKey() {
  try {
    return localStorage.getItem("connector_api_key") || "";
  } catch {
    return "";
  }
}

export function setApiKey(key) {
  try {
    if (key) {
      localStorage.setItem("connector_api_key", key.trim());
    } else {
      localStorage.removeItem("connector_api_key");
    }
  } catch (e) {
    console.error("Failed to persist API key", e);
  }
}

function buildHeaders(extraHeaders = {}) {
  const headers = {
    Accept: "application/json",
    ...extraHeaders,
  };
  const key = getApiKey();
  if (key) {
    headers["x-api-key"] = key;
  }
  return headers;
}

function buildQuery(params = {}) {
  const searchParams = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== "") {
      searchParams.append(key, String(value));
    }
  }
  const queryStr = searchParams.toString();
  return queryStr ? `?${queryStr}` : "";
}

export async function request(endpoint, options = {}) {
  const url = `${API_BASE_URL}${endpoint}`;
  const response = await fetch(url, {
    ...options,
    headers: buildHeaders(options.headers),
  });

  if (!response.ok) {
    let errorMsg = `HTTP ${response.status} ${response.statusText}`;
    try {
      const errorJson = await response.json();
      if (errorJson.error) {
        errorMsg = errorJson.error;
      }
    } catch {
      // response wasn't JSON
    }
    const error = new Error(errorMsg);
    error.status = response.status;
    throw error;
  }

  const contentType = response.headers.get("content-type") || "";
  if (contentType.includes("application/json")) {
    return response.json();
  }
  return response.text();
}

export const apiClient = {
  get: (path, params) => request(`${path}${buildQuery(params)}`, { method: "GET" }),
  post: (path, body) =>
    request(path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: body ? JSON.stringify(body) : undefined,
    }),
  delete: (path) => request(path, { method: "DELETE" }),
  getRawUrl: (path, params) => `${API_BASE_URL}${path}${buildQuery(params)}`,
};

export default apiClient;
