import React, { useState, useRef, useEffect } from "react";
import { Send, Loader2 } from "lucide-react";

export function AIChatInput({ onSend, loading, pageContext = {} }) {
  const [text, setText] = useState("");
  const textareaRef = useRef(null);

  useEffect(() => {
    if (!loading && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [loading]);

  const handleInput = (e) => {
    setText(e.target.value);
    // Auto resize
    const target = e.target;
    target.style.height = "auto";
    target.style.height = Math.min(target.scrollHeight, 120) + "px";
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleSubmit = (e) => {
    if (e) e.preventDefault();
    const trimmed = text.trim();
    if (!trimmed || loading) return;

    onSend(trimmed);
    setText("");
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
  };

  const contextLabel = pageContext.selectedContactName
    ? `Contact: ${pageContext.selectedContactName}`
    : pageContext.selectedChatTitle
    ? `Chat: ${pageContext.selectedChatTitle}`
    : pageContext.page
    ? `Page: ${pageContext.page.charAt(0).toUpperCase() + pageContext.page.slice(1)}`
    : null;

  return (
    <form className="ai-chat-input-form" onSubmit={handleSubmit}>
      {contextLabel && (
        <div className="ai-input-context-badge">
          <span className="dot-indicator" />
          <span>Active Context: <strong>{contextLabel}</strong></span>
        </div>
      )}

      <div className="ai-input-row">
        <textarea
          ref={textareaRef}
          value={text}
          onChange={handleInput}
          onKeyDown={handleKeyDown}
          placeholder="Ask about your WhatsApp messages, contacts, tasks..."
          rows={1}
          disabled={loading}
          className="ai-chat-textarea"
        />

        <button
          type="submit"
          disabled={!text.trim() || loading}
          className="ai-chat-send-btn"
          title="Send message (Enter)"
        >
          {loading ? (
            <Loader2 size={16} className="ai-spin-icon" />
          ) : (
            <Send size={16} />
          )}
        </button>
      </div>

      <div className="ai-input-footer-note">
        <span>Powered by Gemini • Read-only analysis of local WhatsApp archive</span>
      </div>
    </form>
  );
}

export default AIChatInput;
