import { apiClient } from "./apiClient.js";

export const chatsApi = {
  getChats: (params = {}) => apiClient.get("/api/chats", params),
  getChat: (chatId) => apiClient.get(`/api/chats/${encodeURIComponent(chatId)}`),
  getChatMessages: (chatId, params = {}) =>
    apiClient.get(`/api/chats/${encodeURIComponent(chatId)}/messages`, params),
  getChatStats: (chatId) =>
    apiClient.get(`/api/chats/${encodeURIComponent(chatId)}/stats`),
  getChatMedia: (chatId, params = {}) =>
    apiClient.get(`/api/chats/${encodeURIComponent(chatId)}/media`, params),
  getChatLinks: (chatId, params = {}) =>
    apiClient.get(`/api/chats/${encodeURIComponent(chatId)}/links`, params),
  getChatParticipants: (chatId) =>
    apiClient.get(`/api/chats/${encodeURIComponent(chatId)}/participants`),
  getChatTranscript: (chatId, limit = 500) =>
    apiClient.get(`/api/chats/${encodeURIComponent(chatId)}/transcript`, { limit }),
  getChatTimeline: (chatId, params = {}) =>
    apiClient.get(`/api/chats/${encodeURIComponent(chatId)}/timeline`, params),
};

export const getChats = chatsApi.getChats;
export const getChat = chatsApi.getChat;
export const getChatMessages = chatsApi.getChatMessages;
export const getChatStats = chatsApi.getChatStats;
export const getChatMedia = chatsApi.getChatMedia;
export const getChatLinks = chatsApi.getChatLinks;
export const getChatParticipants = chatsApi.getChatParticipants;
export const getChatTranscript = chatsApi.getChatTranscript;
export const getChatTimeline = chatsApi.getChatTimeline;

export default chatsApi;
