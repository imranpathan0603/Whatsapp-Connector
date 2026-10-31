import apiClient from "./apiClient.js";

/**
 * Send a prompt to the WhatsApp AI Copilot
 * @param {Object} params
 * @param {string} params.message - User prompt
 * @param {Object} [params.context] - Page context { page, selectedChatId, selectedContactName, ... }
 * @param {string} [params.conversationId] - Active session ID
 * @param {boolean} [params.resetHistory] - Reset conversation history
 * @returns {Promise<{ answer: string, sources: Array, suggestedQuestions: Array, intent: string, conversationId: string }>}
 */
export async function askAssistant({ message, context = {}, conversationId, resetHistory = false }) {
  return apiClient.post("/api/ai/assistant/chat", {
    message,
    context,
    conversationId,
    resetHistory,
  });
}

/**
 * Get active session conversation history
 * @param {string} conversationId
 * @returns {Promise<{ conversationId: string, history: Array }>}
 */
export async function getAssistantHistory(conversationId) {
  return apiClient.get("/api/ai/assistant/history", { conversationId });
}

/**
 * Clear assistant conversation history
 * @param {string} conversationId
 * @returns {Promise<{ success: boolean, conversationId: string }>}
 */
export async function clearAssistantHistory(conversationId) {
  return apiClient.delete(`/api/ai/assistant/history?conversationId=${encodeURIComponent(conversationId || "default")}`);
}

/**
 * Get executive summary for a period or specific chat
 * @param {Object} [params]
 * @param {string} [params.period] - 'today' | 'yesterday' | 'week' | 'month' | 'all'
 * @param {string} [params.chatId] - Specific chat ID
 * @param {boolean} [params.forceRefresh]
 * @returns {Promise<{ summary: Object, generatedAt: string, period: string }>}
 */
export async function getAISummary({ period = "today", chatId = "", forceRefresh = false } = {}) {
  return apiClient.get("/api/ai/summary", { period, chatId, forceRefresh });
}

/**
 * Get deep AI analytics & conversation insights
 * @param {Object} [params]
 * @param {boolean} [params.forceRefresh]
 * @returns {Promise<{ insights: Object, generatedAt: string }>}
 */
export async function getAIInsights({ forceRefresh = false } = {}) {
  return apiClient.get("/api/ai/insights", { forceRefresh });
}

export default {
  askAssistant,
  getAssistantHistory,
  clearAssistantHistory,
  getAISummary,
  getAIInsights,
};
