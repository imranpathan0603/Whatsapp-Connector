import React, { useRef, useEffect } from "react";
import {
  Sparkles,
  Minus,
  X,
  Trash2,
  Bot,
  BrainCircuit,
  MessageSquare,
  HelpCircle,
  ExternalLink,
} from "lucide-react";
import AIChatMessage from "./AIChatMessage.jsx";
import AIChatInput from "./AIChatInput.jsx";

export function AIChatWindow({
  isOpen,
  isMinimized,
  onClose,
  onMinimize,
  onRestore,
  messages = [],
  loading = false,
  error = null,
  onSendMessage,
  onClearChat,
  pageContext = {},
  onNavigatePage,
}) {
  const messagesEndRef = useRef(null);

  // Auto scroll to bottom
  useEffect(() => {
    if (isOpen && !isMinimized && messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, loading, isOpen, isMinimized]);

  if (!isOpen) return null;

  if (isMinimized) {
    return (
      <div className="ai-chat-minimized-bar" onClick={onRestore}>
        <div className="ai-minimized-left">
          <span className="ai-badge-pulse" />
          <Sparkles size={16} className="sparkle-gold" />
          <strong>WhatsApp AI Copilot</strong>
        </div>
        <span className="ai-minimized-hint">Click to expand</span>
      </div>
    );
  }

  // Context-specific starter questions
  const getContextStarters = () => {
    const page = pageContext.page || "overview";
    switch (page) {
      case "contacts":
        return [
          pageContext.selectedContactName
            ? `What did ${pageContext.selectedContactName} discuss with me?`
            : "Who are my most active WhatsApp contacts?",
          "Show pending follow-ups with contacts",
          "Summarize discussions from this week",
        ];
      case "chats":
        return [
          pageContext.selectedChatTitle
            ? `Summarize the chat: ${pageContext.selectedChatTitle}`
            : "Which chat has the most unread messages?",
          "Find important announcements in recent chats",
          "What tasks were assigned in my groups?",
        ];
      case "messages":
        return [
          "Summarize my recent WhatsApp messages",
          "Find messages mentioning deadlines or dates",
          "Search messages for payment or bill discussions",
        ];
      case "groups":
        return [
          "What happened in my groups today?",
          "Summarize the latest hackathon group updates",
          "Who posted key notices in my groups?",
        ];
      case "analytics":
        return [
          "Explain my WhatsApp messaging trends",
          "What are my peak chat hours this week?",
          "How responsive am I compared to incoming chats?",
        ];
      default:
        return [
          "Summarize today's WhatsApp chats",
          "What did people discuss about hackathon?",
          "Show pending follow-ups & commitments",
          "What happened this week on my WhatsApp?",
        ];
    }
  };

  const starterQuestions = getContextStarters();

  return (
    <div className="ai-chat-window-container" role="region" aria-label="WhatsApp AI Copilot">
      {/* Header */}
      <header className="ai-chat-header">
        <div className="ai-header-info">
          <div className="ai-header-avatar">
            <Sparkles size={18} className="ai-sparkle-icon" />
          </div>
          <div className="ai-header-titles">
            <div className="ai-title-row">
              <h3>WhatsApp AI Assistant</h3>
            </div>
            <div className="ai-status-row">
              <span className="ai-online-dot" />
              <span className="ai-status-text">Gemini Connected</span>
            </div>
          </div>
        </div>

        <div className="ai-header-controls">
          <button
            type="button"
            className="ai-ctrl-btn"
            onClick={onClearChat}
            title="Clear Chat History"
            aria-label="Clear chat"
          >
            <Trash2 size={15} />
          </button>
          <button
            type="button"
            className="ai-ctrl-btn"
            onClick={onMinimize}
            title="Minimize"
            aria-label="Minimize"
          >
            <Minus size={16} />
          </button>
          <button
            type="button"
            className="ai-ctrl-btn ai-close-btn"
            onClick={onClose}
            title="Close Assistant"
            aria-label="Close"
          >
            <X size={16} />
          </button>
        </div>
      </header>

      {/* Messages Scroll Area */}
      <div className="ai-chat-body">
        {messages.length === 0 ? (
          <div className="ai-welcome-box">
            <div className="ai-welcome-icon-wrap">
              <BrainCircuit size={36} className="welcome-circuit-icon" />
            </div>
            <h4>Hello! I'm your WhatsApp Copilot</h4>
            <p className="ai-welcome-desc">
              Ask anything about your archived messages, contacts, groups, tasks, or analytics.
            </p>

            <div className="ai-welcome-starters">
              <span className="starters-title">
                <HelpCircle size={13} /> Suggested questions:
              </span>
              <div className="starters-list">
                {starterQuestions.map((q, idx) => (
                  <button
                    key={idx}
                    type="button"
                    className="starter-question-btn"
                    onClick={() => onSendMessage(q)}
                  >
                    <span>{q}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <div className="ai-messages-list">
            {messages.map((msg) => (
              <AIChatMessage
                key={msg.id}
                message={msg}
                onSelectSuggestion={(suggestion) => onSendMessage(suggestion)}
                onSelectMessage={(src) => {
                  if (onNavigatePage) {
                    onNavigatePage("messages");
                  }
                }}
              />
            ))}

            {loading && (
              <div className="ai-loading-indicator">
                <div className="ai-loading-avatar">
                  <Sparkles size={14} className="sparkle-spin" />
                </div>
                <div className="ai-loading-bubble">
                  <span className="loading-dot dot-1" />
                  <span className="loading-dot dot-2" />
                  <span className="loading-dot dot-3" />
                  <span className="loading-text">Analyzing WhatsApp messages...</span>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Input Area */}
      <footer className="ai-chat-footer">
        <AIChatInput
          onSend={onSendMessage}
          loading={loading}
          pageContext={pageContext}
        />
      </footer>
    </div>
  );
}

export default AIChatWindow;
