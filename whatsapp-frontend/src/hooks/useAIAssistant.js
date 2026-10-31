import { useState, useEffect, useCallback, useRef } from "react";
import { askAssistant, getAssistantHistory, clearAssistantHistory } from "../api/assistantApi.js";

const SESSION_KEY = "whatsapp_ai_conversation_id";

function getStoredConversationId() {
  try {
    let id = sessionStorage.getItem(SESSION_KEY);
    if (!id) {
      id = "conv_" + Math.random().toString(36).substring(2, 11) + "_" + Date.now();
      sessionStorage.setItem(SESSION_KEY, id);
    }
    return id;
  } catch {
    return "conv_" + Date.now();
  }
}

export function useAIAssistant(initialContext = {}) {
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const [pageContext, setPageContext] = useState(initialContext);

  const conversationIdRef = useRef(getStoredConversationId());

  // Load existing session history on mount if available
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const res = await getAssistantHistory(conversationIdRef.current);
        if (mounted && res && Array.isArray(res.history) && res.history.length > 0) {
          const loaded = res.history.map((h, i) => ({
            id: `hist_${i}_${h.timestamp || Date.now()}`,
            role: h.role === "user" ? "user" : "assistant",
            content: h.content,
            timestamp: h.timestamp || Date.now(),
            sources: [],
            suggestions: [],
          }));
          setMessages(loaded);
        }
      } catch (e) {
        // Silent fallback for empty session history
      }
    })();

    // Listen for logout / login change to reset AI assistant memory completely
    const handleAccountReset = () => {
      const newId = "conv_" + Math.random().toString(36).substring(2, 11) + "_" + Date.now();
      try {
        sessionStorage.setItem(SESSION_KEY, newId);
      } catch {}
      conversationIdRef.current = newId;
      setMessages([]);
      setError(null);
      setUnreadCount(0);
    };

    window.addEventListener("whatsapp:data_cleared", handleAccountReset);
    window.addEventListener("whatsapp:login_changed", handleAccountReset);

    return () => {
      mounted = false;
      window.removeEventListener("whatsapp:data_cleared", handleAccountReset);
      window.removeEventListener("whatsapp:login_changed", handleAccountReset);
    };
  }, []);

  const toggleOpen = useCallback(() => {
    setIsOpen((prev) => {
      const next = !prev;
      if (next) {
        setIsMinimized(false);
        setUnreadCount(0);
      }
      return next;
    });
  }, []);

  const minimize = useCallback(() => {
    setIsMinimized(true);
  }, []);

  const restore = useCallback(() => {
    setIsMinimized(false);
    setIsOpen(true);
    setUnreadCount(0);
  }, []);

  const close = useCallback(() => {
    setIsOpen(false);
    setIsMinimized(false);
  }, []);

  const openAssistant = useCallback((initialPrompt = null) => {
    setIsOpen(true);
    setIsMinimized(false);
    setUnreadCount(0);
    if (initialPrompt && typeof initialPrompt === "string") {
      // Send promptly
      setTimeout(() => {
        sendMessage(initialPrompt);
      }, 100);
    }
  }, []);

  const sendMessage = useCallback(
    async (text, overrideContext = {}) => {
      const trimmed = (text || "").trim();
      if (!trimmed || loading) return;

      const userMsgId = "msg_user_" + Date.now();
      const userMsg = {
        id: userMsgId,
        role: "user",
        content: trimmed,
        timestamp: Date.now(),
      };

      setMessages((prev) => [...prev, userMsg]);
      setLoading(true);
      setError(null);

      const effectiveContext = {
        ...pageContext,
        ...overrideContext,
      };

      try {
        const res = await askAssistant({
          message: trimmed,
          context: effectiveContext,
          conversationId: conversationIdRef.current,
        });

        const botAnswer = res.answer || res.message?.content || "No response received.";
        const sources = res.sources || res.message?.sources || [];
        const suggestions = res.suggestedQuestions || res.message?.suggestions || [];

        const assistantMsg = {
          id: "msg_ai_" + Date.now(),
          role: "assistant",
          content: botAnswer,
          sources,
          suggestions,
          timestamp: Date.now(),
        };

        setMessages((prev) => [...prev, assistantMsg]);

        // If window is minimized or closed, increase unread count
        if (!isOpen || isMinimized) {
          setUnreadCount((c) => c + 1);
        }
      } catch (err) {
        console.error("AI Assistant request failed:", err);
        const errMsg = err.message || "Failed to contact AI service";
        setError(errMsg);

        const errorMsg = {
          id: "msg_err_" + Date.now(),
          role: "assistant",
          isError: true,
          content: `⚠️ ${errMsg}. Please ensure your backend is running.`,
          timestamp: Date.now(),
        };
        setMessages((prev) => [...prev, errorMsg]);
      } finally {
        setLoading(false);
      }
    },
    [loading, pageContext, isOpen, isMinimized]
  );

  const clearChat = useCallback(async () => {
    try {
      await clearAssistantHistory(conversationIdRef.current);
    } catch (e) {
      console.warn("Failed to clear assistant history on server", e);
    }
    // Generate fresh session ID
    const newId = "conv_" + Math.random().toString(36).substring(2, 11) + "_" + Date.now();
    try {
      sessionStorage.setItem(SESSION_KEY, newId);
    } catch {}
    conversationIdRef.current = newId;
    setMessages([]);
    setError(null);
    setUnreadCount(0);
  }, []);

  return {
    isOpen,
    isMinimized,
    messages,
    loading,
    error,
    unreadCount,
    pageContext,
    setPageContext,
    toggleOpen,
    minimize,
    restore,
    close,
    openAssistant,
    sendMessage,
    clearChat,
  };
}

export default useAIAssistant;
