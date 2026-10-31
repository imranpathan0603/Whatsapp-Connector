import React from "react";
import {
  MessageSquare,
  X,
  ChevronRight,
  ShieldCheck,
} from "lucide-react";
import { NAV_ITEMS, AI_NAV_ITEMS } from "../navigation.js";

export function Sidebar({
  currentPage,
  onNavigate,
  isOpen,
  onClose,
  connectionStatus,
}) {
  const isConnected = connectionStatus?.connected === true;
  const statusType = connectionStatus?.status || "disconnected";

  return (
    <>
      {isOpen && <div className="sidebar-backdrop" onClick={onClose} />}

      <aside className={`app-sidebar ${isOpen ? "sidebar-open" : ""}`}>
        <div className="sidebar-brand-header">
          <div className="sidebar-brand-logo">
            <MessageSquare size={22} className="brand-icon-svg" />
          </div>
          <div className="sidebar-brand-text">
            <h2>WhatsApp Connector</h2>
            <span>Baileys Bridge v2.1</span>
          </div>
          <button className="sidebar-close-btn" onClick={onClose} aria-label="Close menu">
            <X size={20} />
          </button>
        </div>

        <div className="sidebar-status-banner">
          <div className="status-indicator-dot-wrap">
            <span
              className={`connection-dot ${
                isConnected
                  ? "dot-connected"
                  : statusType === "qr" || statusType === "connecting" || statusType === "reconnecting"
                  ? "dot-warning"
                  : "dot-disconnected"
              }`}
            />
          </div>
          <div className="sidebar-status-details">
            <span className="status-label-tiny">WHATSAPP</span>
            <strong className="status-value-text">
              {isConnected
                ? "Connected"
                : statusType === "qr"
                ? "Scan QR"
                : statusType === "connecting"
                ? "Connecting..."
                : statusType === "reconnecting"
                ? "Reconnecting"
                : "Disconnected"}
            </strong>
          </div>
        </div>

        <div className="sidebar-nav-section-title">NAVIGATION</div>

        <nav className="sidebar-nav-list">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const isActive = currentPage === item.id;

            return (
              <button
                key={item.id}
                className={`sidebar-nav-item ${isActive ? "active" : ""} ${
                  item.highlight ? "nav-highlight" : ""
                }`}
                onClick={() => {
                  onNavigate(item.id);
                  onClose();
                }}
              >
                <Icon size={18} className="nav-item-icon" />
                <span className="nav-item-label">{item.label}</span>
                {item.id === "connection" && !isConnected && (
                  <span className="nav-pulse-badge">Action</span>
                )}
                {isActive && <ChevronRight size={14} className="active-arrow" />}
              </button>
            );
          })}
        </nav>

        <div className="sidebar-nav-section-title sidebar-ai-section-title">
          <span>AI COPILOT</span>
          <span className="ai-section-badge">Gemini</span>
        </div>

        <nav className="sidebar-nav-list ai-nav-list">
          {AI_NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const isActive = currentPage === item.id;

            return (
              <button
                key={item.id}
                className={`sidebar-nav-item ai-nav-item ${isActive ? "active" : ""}`}
                onClick={() => {
                  onNavigate(item.id);
                  onClose();
                }}
              >
                <Icon size={18} className="nav-item-icon ai-nav-icon" />
                <span className="nav-item-label">{item.label}</span>
                {item.badge && <span className="nav-ai-chip">{item.badge}</span>}
                {isActive && <ChevronRight size={14} className="active-arrow" />}
              </button>
            );
          })}
        </nav>

        <div className="sidebar-footer">
          <div className="backend-info-pill">
            <ShieldCheck size={14} />
            <span>Baileys Multi-File Auth</span>
          </div>
          <small className="backend-endpoint-note">Express Backend :3000</small>
        </div>
      </aside>
    </>
  );
}

export default Sidebar;
