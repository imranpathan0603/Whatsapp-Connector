import { apiClient, API_BASE_URL } from "./apiClient.js";

export const connectionApi = {
  getStatus: () => apiClient.get("/api/status"),
  getQr: () => apiClient.get("/api/connection/qr"),
  connect: () => apiClient.post("/api/connection/connect"),
  reconnect: () => apiClient.post("/api/connection/reconnect"),
  logout: () => apiClient.post("/api/connection/logout"),
  clearData: () => apiClient.post("/api/connection/clear-data"),
  getEventsUrl: () => `${API_BASE_URL}/api/connection/events`,
};

export default connectionApi;
