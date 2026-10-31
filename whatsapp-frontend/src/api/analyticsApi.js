import { apiClient } from "./apiClient.js";

export const analyticsApi = {
  getStats: () => apiClient.get("/api/stats"),
  getDaily: (params = {}) => apiClient.get("/api/analytics/daily", params),
  getHourly: (params = {}) => apiClient.get("/api/analytics/hourly", params),
  getTopSenders: (params = {}) => apiClient.get("/api/analytics/top-senders", params),
  getHealth: () => apiClient.get("/api/health"),
  getRootInfo: () => apiClient.get("/"),
};

export default analyticsApi;
