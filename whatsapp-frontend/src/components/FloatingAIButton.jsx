import React, { useState } from "react";
import { Sparkles, Bot, MessageSquare } from "lucide-react";

export function FloatingAIButton({
  isOpen,
  isMinimized,
  onClick,
  unreadCount = 0,
}) {
  const [hovered, setHovered] = useState(false);

  return (
    <div className="floating-ai-button-wrapper">
      {/* Tooltip on hover */}
      {hovered && !isOpen && (
        <div className="floating-ai-tooltip" role="tooltip">
          <span>Ask WhatsApp AI</span>
          <div className="tooltip-arrow" />
        </div>
      )}

      <button
        type="button"
        className={`floating-ai-btn ${isOpen && !isMinimized ? "btn-active" : ""}`}
        onClick={onClick}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        aria-label="Ask WhatsApp AI Assistant"
        title="Ask WhatsApp AI"
      >
        <div className="ai-btn-inner-glow" />
        <div className="ai-btn-icon-container">
          <Sparkles className="ai-sparkle-primary" size={26} />
        </div>

        {/* Unread badge count */}
        {unreadCount > 0 && (
          <span className="ai-unread-badge" aria-label={`${unreadCount} new responses`}>
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}

        {/* Subtle breathing ring */}
        <span className="ai-pulse-ring" />
      </button>
    </div>
  );
}

export default FloatingAIButton;
