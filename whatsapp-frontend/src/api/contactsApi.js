import { apiClient } from "./apiClient.js";

export const contactsApi = {
  getContacts: (params = {}) => apiClient.get("/api/contacts", params),
  getContact: (id) => apiClient.get(`/api/contacts/${encodeURIComponent(id)}`),
  getContactMessages: (id, params = {}) =>
    apiClient.get(`/api/contacts/${encodeURIComponent(id)}/messages`, params),
  getContactStats: (id) =>
    apiClient.get(`/api/contacts/${encodeURIComponent(id)}/stats`),
};

export default contactsApi;
