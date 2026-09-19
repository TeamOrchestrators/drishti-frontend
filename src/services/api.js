// When in development, relative /api requests route through Vite's local dev server proxy.
// Same-origin requests avoid CORS preflight and access-control errors.
// In production, leave VITE_API_URL unset so requests remain relative. Vercel
// proxies /api/* to EC2, keeping the browser on HTTPS and avoiding CORS.
// VITE_FORCE_DIRECT_URL remains available only for deliberate local debugging.
const isDev = import.meta.env.DEV;
const configuredUrl = (import.meta.env.VITE_API_URL || "").replace(/\/+$/, "");

export const BASE_URL = isDev && !import.meta.env.VITE_FORCE_DIRECT_URL ? "" : configuredUrl;

export async function apiRequest(endpoint, options = {}) {
  const method = (options.method || "GET").toUpperCase();
  const cleanEndpoint = endpoint.startsWith("/") ? endpoint : `/${endpoint}`;
  let url = endpoint.startsWith("http://") || endpoint.startsWith("https://")
    ? endpoint
    : `${BASE_URL}${cleanEndpoint}`;
  const headers = { ...(options.headers || {}) };

  // CRITICAL FOR CORS: Only attach Content-Type on requests that have a body (POST, PUT, etc.)
  // Never send Content-Type on GET requests, as non-standard Content-Type forces the browser to send an OPTIONS preflight!
  if (options.body && !headers["Content-Type"]) {
    headers["Content-Type"] = "application/json";
  }

  const response = await fetch(url, {
    ...options,
    method,
    headers,
  });

  if (!response.ok) {
    let errorDetail = response.status === 502
      ? "Backend server is unavailable or restarting (502 Bad Gateway). Please verify your backend server."
      : `Request failed with status ${response.status}`;
    try {
      const text = await response.text();
      if (text) {
        try {
          const data = JSON.parse(text);
          if (data && (data.error || data.message)) {
            errorDetail = data.error || data.message;
          } else if (typeof data === "string") {
            errorDetail = data;
          }
        } catch {
          // Plain text response from Go backend or proxy (e.g. database error)
          if (!text.trim().startsWith("<!DOCTYPE") && !text.trim().startsWith("<html")) {
            errorDetail = text.trim();
          }
        }
      }
    } catch {
      // response could not be read
    }
    throw new Error(errorDetail);
  }

  if (response.status === 204) return null;
  const text = await response.text();
  if (!text || !text.trim()) return null;
  try {
    return JSON.parse(text);
  } catch {
    if (text.trim().startsWith("<!DOCTYPE") || text.trim().startsWith("<html")) {
      throw new Error("Received HTML instead of JSON from API server. Please check backend connection.");
    }
    return text;
  }
}

export const expeditionsApi = {
  getAll: () => apiRequest("/api/expeditions"),
  getFormOptions: () => apiRequest("/api/expeditions/form-options"),
  create: (data) =>
    apiRequest("/api/expeditions", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  update: (id, data) =>
    apiRequest(`/api/expeditions/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),
};

export const personnelApi = {
  getAll: () => apiRequest("/api/personnel"),
  getAssignmentFormOptions: () => apiRequest("/api/personnel/assignment-form-options"),
  assignExpedition: (data) =>
    apiRequest("/api/personnel/expedition-assignment", {
      method: "POST",
      body: JSON.stringify(data),
    }),
};

export const cargoApi = {
  getAll: () => apiRequest("/api/cargo"),
  create: (data) =>
    apiRequest("/api/cargo", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  createBatch: (data) =>
    apiRequest("/api/logistics-batches", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  assignLogisticsBatch: (cargoId, batchId) =>
    apiRequest(`/api/cargo/${cargoId}/logistics-batch`, {
      method: "PUT",
      body: JSON.stringify({ logistics_batch_id: batchId }),
    }),
};

export const BHARTI_STATION_ID = "a1148ece-5c3f-4999-a3e8-344450614bbd";

export const inventoryApi = {
  getInventory: (stationId) => {
    const cleanId =
      typeof stationId === "string" &&
      stationId.trim() &&
      stationId !== "undefined" &&
      stationId !== "null" &&
      !stationId.includes("object")
        ? stationId.trim()
        : BHARTI_STATION_ID;
    return apiRequest(`/api/inventory?station_id=${cleanId}`);
  },
  getStationInventory: (stationId) => {
    const cleanId =
      typeof stationId === "string" &&
      stationId.trim() &&
      stationId !== "undefined" &&
      stationId !== "null" &&
      !stationId.includes("object")
        ? stationId.trim()
        : BHARTI_STATION_ID;
    return apiRequest(`/api/inventory?station_id=${cleanId}`);
  },
  addItem: (stationId, data) => {
    const cleanId =
      typeof stationId === "string" &&
      stationId.trim() &&
      stationId !== "undefined" &&
      stationId !== "null" &&
      !stationId.includes("object")
        ? stationId.trim()
        : BHARTI_STATION_ID;
    return apiRequest(`/api/inventory/items?station_id=${cleanId}`, {
      method: "POST",
      body: JSON.stringify(data),
    });
  },
  adjustStock: (stationId, inventoryId, data) =>
    apiRequest(`/api/stations/${stationId}/inventory/${inventoryId}/stock`, {
      method: "POST",
      body: JSON.stringify(data),
    }),
};

export const emergencyApi = {
  getAll: () => apiRequest("/api/emergencies"),
  getActive: () => apiRequest("/api/emergencies/active"),
  updateStatus: (id, status) =>
    apiRequest(`/api/emergencies/${id}/status`, {
      method: "PATCH",
      body: JSON.stringify({ status }),
    }),
  resolve: (id) =>
    apiRequest(`/api/emergencies/${id}/resolve`, {
      method: "POST",
    }),
};

export const emergencySimulatorApi = {
  getFormOptions: () => apiRequest("/api/emergency/device/simulate/form-options"),
  registerDevice: (data) =>
    apiRequest("/api/emergency/device/simulate/register", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  sendHeartbeat: (deviceId, data) =>
    apiRequest(`/api/emergency/device/simulate/${deviceId}/heartbeat`, {
      method: "POST",
      body: JSON.stringify(data),
    }),
  initiateSOS: (deviceId, data) =>
    apiRequest(`/api/emergency/device/simulate/${deviceId}/sos/initiate`, {
      method: "POST",
      body: JSON.stringify(data),
    }),
  confirmSOS: (deviceId, confirmationId, data) =>
    apiRequest(`/api/emergency/device/simulate/${deviceId}/sos/${confirmationId}/confirm`, {
      method: "POST",
      body: JSON.stringify(data),
    }),
};

