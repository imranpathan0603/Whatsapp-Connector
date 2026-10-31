import { apiClient } from "./apiClient.js";

export const messagesApi = {
  getMessages: (params = {}) => apiClient.get("/api/messages", params),
  getMessage: (id) => apiClient.get(`/api/messages/${encodeURIComponent(id)}`),
  getMessageContext: (id, params = { before: 5, after: 5 }) =>
    apiClient.get(`/api/messages/${encodeURIComponent(id)}/context`, params),
  getMessageReplies: (id) =>
    apiClient.get(`/api/messages/${encodeURIComponent(id)}/replies`),
  getExportUrl: (format = "json", params = {}) =>
    apiClient.getRawUrl("/api/export/messages", { ...params, format }),
};

export default messagesApi;
