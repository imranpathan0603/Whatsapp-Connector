import React, { useState } from "react";
import { ChevronDown, ChevronUp, ExternalLink, MessageSquareQuote, Clock, User } from "lucide-react";

export function AISourceReference({ sources = [], onSelectMessage }) {
  const [expanded, setExpanded] = useState(false);

  // Filter out any internal protocolMessage entries
  const validSources = sources.filter(
    (s) => s.text && s.text.trim() && s.text !== "[protocolMessage]" && !s.text.startsWith("[protocolMessage")
  );

  if (!validSources || validSources.length === 0) return null;

  return (
    <div className="ai-sources-container">
      <button
        type="button"
        className="ai-sources-toggle-btn"
        onClick={() => setExpanded(!expanded)}
        title="View grounded WhatsApp message sources"
      >
        <MessageSquareQuote size={13} className="ai-sources-icon" />
        <span>
          {validSources.length} grounded message source{validSources.length > 1 ? "s" : ""}
        </span>
        {expanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
      </button>

      {expanded && (
        <div className="ai-sources-list">
          {validSources.map((src, index) => {
            const timeStr = src.timestamp
              ? new Date(src.timestamp).toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                  month: "short",
                  day: "numeric",
                })
              : "Recent";

            return (
              <div key={index} className="ai-source-card">
                <div className="ai-source-meta">
                  <span className="ai-source-sender">
                    <User size={11} />
                    {src.senderName || "Unknown"}
                  </span>
                  <span className="ai-source-time">
                    <Clock size={11} />
                    {timeStr}
                  </span>
                </div>
                <p className="ai-source-text">"{src.text}"</p>
                {onSelectMessage && (
                  <button
                    type="button"
                    className="ai-source-link"
                    onClick={() => onSelectMessage(src)}
                  >
                    <span>View in Messages</span>
                    <ExternalLink size={10} />
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default AISourceReference;
