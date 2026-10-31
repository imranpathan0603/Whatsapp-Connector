import React from "react";
import { Menu, RefreshCw, Smartphone, QrCode, Wifi, WifiOff } from "lucide-react";
import StatusBadge from "./StatusBadge.jsx";

export function Header({
  title,
  breadcrumb = "Dashboard",
  onOpenMenu,
  connectionStatus,
  onRefresh,
  refreshing = false,
  onNavigate,
}) {
  const isConnected = connectionStatus?.connected === true;
  const statusType = connectionStatus?.status || "disconnected";
  const accountId = connectionStatus?.account;
  const phone = connectionStatus?.phone;

  return (
    <header className="app-topbar">
      <div className="topbar-left">
        <button
          className="topbar-menu-trigger"
          onClick={onOpenMenu}
          aria-label="Open navigation menu"
        >
          <Menu size={22} />
        </button>

        <div className="topbar-title-block">
          <div className="topbar-breadcrumb">
            <span>Connector</span>
            <span className="breadcrumb-divider">/</span>
            <span className="breadcrumb-current">{title}</span>
          </div>
          <h1 className="topbar-page-heading">{title}</h1>
        </div>
      </div>

      <div className="topbar-right">
        <div
          className="topbar-status-clickable"
          onClick={() => onNavigate && onNavigate("connection")}
          title="Click to view WhatsApp Connection"
        >
          <StatusBadge status={statusType} size="md" />
          {isConnected && (phone || accountId) && (
            <span className="topbar-account-pill">
              <Smartphone size={13} />
              {phone || accountId}
            </span>
          )}
        </div>

        <button
          className="topbar-refresh-btn"
          onClick={onRefresh}
          disabled={refreshing}
          title="Refresh current data"
        >
          <RefreshCw size={15} className={refreshing ? "spin-icon" : ""} />
          <span className="refresh-text">{refreshing ? "Refreshing..." : "Refresh"}</span>
        </button>
      </div>
    </header>
  );
}

export default Header;
