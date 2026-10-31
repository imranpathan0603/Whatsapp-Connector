import { apiClient } from "./apiClient.js";

export const searchApi = {
  searchAll: (query, scope = "all", limit = 20) =>
    apiClient.get("/api/search/all", { q: query, scope, limit }),
  searchMessages: (query, params = {}) =>
    apiClient.get("/api/search", { q: query, ...params }),
  getMedia: (params = {}) => apiClient.get("/api/media", params),
  getLinks: (params = {}) => apiClient.get("/api/links", params),
  fetchConnectorItem: (id) =>
    apiClient.get(`/api/connector/fetch/${encodeURIComponent(id)}`),
};

export default searchApi;
