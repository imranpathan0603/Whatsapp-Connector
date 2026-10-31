import { apiClient } from "./apiClient.js";

export const groupsApi = {
  getGroups: (params = {}) => apiClient.get("/api/groups", params),
  getGroup: (id) => apiClient.get(`/api/groups/${encodeURIComponent(id)}`),
  getGroupMessages: (id, params = {}) =>
    apiClient.get(`/api/groups/${encodeURIComponent(id)}/messages`, params),
  getGroupParticipants: (id) =>
    apiClient.get(`/api/groups/${encodeURIComponent(id)}/participants`),
  syncGroups: () => apiClient.post("/api/sync/groups"),
};

export default groupsApi;
