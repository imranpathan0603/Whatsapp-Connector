import React, { useState } from "react";
import { Sparkles, User, Copy, Check, CornerDownRight } from "lucide-react";
import AISourceReference from "./AISourceReference.jsx";

// Lightweight, safe markdown formatter
function renderFormattedMarkdown(text = "") {
  if (!text) return null;

  // Split into paragraphs / blocks
  const lines = text.split("\n");
  const elements = [];
  let currentList = [];

  const flushList = () => {
    if (currentList.length > 0) {
      elements.push(
        <ul key={`ul_${elements.length}`} className="ai-markdown-list">
          {currentList.map((li, idx) => (
            <li key={idx}>{parseInlineStyles(li)}</li>
          ))}
        </ul>
      );
      currentList = [];
    }
  };

  lines.forEach((line, index) => {
    const trimmed = line.trim();

    if (!trimmed) {
      flushList();
      return;
    }

    // Bullet points (* or -)
    if (/^[\*\-]\s+/.test(trimmed)) {
      currentList.push(trimmed.replace(/^[\*\-]\s+/, ""));
      return;
    }

    flushList();

    // Headers: ###, ##, #
    if (/^###\s+/.test(trimmed)) {
      elements.push(
        <h4 key={`h4_${index}`} className="ai-markdown-h4">
          {parseInlineStyles(trimmed.replace(/^###\s+/, ""))}
        </h4>
      );
      return;
    }
    if (/^##\s+/.test(trimmed)) {
      elements.push(
        <h3 key={`h3_${index}`} className="ai-markdown-h3">
          {parseInlineStyles(trimmed.replace(/^##\s+/, ""))}
        </h3>
      );
      return;
    }
    if (/^#\s+/.test(trimmed)) {
      elements.push(
        <h2 key={`h2_${index}`} className="ai-markdown-h2">
          {parseInlineStyles(trimmed.replace(/^#\s+/, ""))}
        </h2>
      );
      return;
    }

    // Numbered list (e.g., "1. ")
    if (/^\d+\.\s+/.test(trimmed)) {
      elements.push(
        <div key={`num_${index}`} className="ai-markdown-num-item">
          <span className="num-prefix">{trimmed.match(/^\d+\./)[0]}</span>
          <span className="num-text">{parseInlineStyles(trimmed.replace(/^\d+\.\s+/, ""))}</span>
        </div>
      );
      return;
    }

    // Regular paragraph
    elements.push(
      <p key={`p_${index}`} className="ai-markdown-p">
        {parseInlineStyles(trimmed)}
      </p>
    );
  });

  flushList();
  return elements;
}

// Inline styling parser for **bold**, *italic*, and `code`
function parseInlineStyles(str = "") {
  if (!str) return "";

  // Split by bold (**...**)
  const parts = str.split(/(\*\*[^*]+?\*\*|`[^`]+?`|\*[^*]+?\*)/g);
  return parts.map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return <strong key={i}>{part.slice(2, -2)}</strong>;
    }
    if (part.startsWith("`") && part.endsWith("`")) {
      return <code key={i} className="ai-inline-code">{part.slice(1, -1)}</code>;
    }
    if (part.startsWith("*") && part.endsWith("*")) {
      return <em key={i}>{part.slice(1, -1)}</em>;
    }
    return part;
  });
}

export function AIChatMessage({ message, onSelectSuggestion, onSelectMessage }) {
  const [copied, setCopied] = useState(false);
  const isUser = message.role === "user";
  const isError = message.isError;

  const handleCopy = () => {
    if (!message.content) return;
    navigator.clipboard.writeText(message.content).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const timeStr = message.timestamp
    ? new Date(message.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    : "";

  return (
    <div className={`ai-message-row ${isUser ? "user-row" : "assistant-row"}`}>
      <div className={`ai-message-avatar ${isUser ? "user-avatar" : "bot-avatar"}`}>
        {isUser ? <User size={15} /> : <Sparkles size={15} />}
      </div>

      <div className="ai-message-bubble-wrapper">
        <div className={`ai-message-bubble ${isUser ? "user-bubble" : "bot-bubble"} ${isError ? "error-bubble" : ""}`}>
          <div className="ai-message-text">
            {isUser ? (
              <p className="user-plain-text">{message.content}</p>
            ) : (
              renderFormattedMarkdown(message.content)
            )}
          </div>

          <div className="ai-message-footer">
            <span className="ai-message-time">{timeStr}</span>
            {!isUser && !isError && (
              <button
                type="button"
                className="ai-copy-btn"
                onClick={handleCopy}
                title="Copy response"
              >
                {copied ? <Check size={12} className="copied-check" /> : <Copy size={12} />}
                <span>{copied ? "Copied" : "Copy"}</span>
              </button>
            )}
          </div>
        </div>

        {/* Source Citations */}
        {!isUser && message.sources && message.sources.length > 0 && (
          <AISourceReference sources={message.sources} onSelectMessage={onSelectMessage} />
        )}

        {/* Dynamic Suggested Follow-ups */}
        {!isUser && message.suggestions && message.suggestions.length > 0 && (
          <div className="ai-suggestions-pill-list">
            <span className="ai-suggestions-label">
              <CornerDownRight size={11} /> Suggested:
            </span>
            {message.suggestions.map((suggestion, sIdx) => (
              <button
                key={sIdx}
                type="button"
                className="ai-suggestion-chip"
                onClick={() => onSelectSuggestion && onSelectSuggestion(suggestion)}
              >
                {suggestion}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default AIChatMessage;
