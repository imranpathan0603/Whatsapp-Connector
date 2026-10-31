import React, { useState } from "react";
import {
  Smartphone,
  QrCode,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  LogOut,
  Power,
  Shield,
  MessageSquare,
  MessagesSquare,
  Users,
  FolderKanban,
  Clock,
  Radio,
  ExternalLink,
  Trash2,
} from "lucide-react";
import QRCodePanel from "../components/QRCodePanel.jsx";
import StatusBadge from "../components/StatusBadge.jsx";
import ConfirmDialog from "../components/ConfirmDialog.jsx";
import Loading from "../components/Loading.jsx";
import ErrorMessage from "../components/ErrorMessage.jsx";

export function Connection({
  connectionState,
  onNavigate,
}) {
  const {
    status,
    qr,
    loading,
    actionLoading,
    error,
    sseActive,
    refreshStatus,
    refreshQr,
    connect,
    reconnect,
    logout,
    clearData,
  } = connectionState;

  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [showClearDataConfirm, setShowClearDataConfirm] = useState(false);
  const [actionError, setActionError] = useState("");
  const [successNotice, setSuccessNotice] = useState("");

  const isConnected = status?.connected === true;
  const isConnecting = status?.connecting === true || status?.status === "connecting" || status?.status === "reconnecting";
  const isQrAvailable = (status?.status === "qr" || qr?.available) && !isConnected;
  const isDisconnected = !isConnected && !isConnecting && !isQrAvailable;

  const handleConnect = async () => {
    setActionError("");
    setSuccessNotice("");
    try {
      await connect();
      setSuccessNotice("Connection initiated. Waiting for WhatsApp response...");
    } catch (err) {
      setActionError(err.message || "Failed to start connection");
    }
  };

  const handleReconnect = async () => {
    setActionError("");
    setSuccessNotice("");
    try {
      await reconnect();
      setSuccessNotice("Reconnecting socket with existing session credentials...");
    } catch (err) {
      setActionError(err.message || "Failed to reconnect");
    }
  };

  const handleConfirmLogout = async () => {
    setActionError("");
    try {
      await logout();
      setShowLogoutConfirm(false);
      setSuccessNotice("WhatsApp account logged out and all previous data cleaned successfully.");
    } catch (err) {
      setActionError(err.message || "Failed to log out");
    }
  };

  const handleConfirmClearData = async () => {
    setActionError("");
    try {
      await clearData();
      setShowClearDataConfirm(false);
      setSuccessNotice("All messages, contacts, chats, groups, and AI history have been wiped cleanly.");
    } catch (err) {
      setActionError(err.message || "Failed to clear archived data");
    }
  };

  return (
    <div className="connection-page-wrapper">
      <ConfirmDialog
        isOpen={showLogoutConfirm}
        title="Sign Out of WhatsApp"
        message="Are you sure you want to disconnect and log out this WhatsApp account? All session authentication files and previously archived messages, chats, contacts, and AI history will be completely wiped from disk and memory so that a new user starts fresh."
        confirmLabel="Confirm Sign Out & Clean Data"
        cancelLabel="Cancel"
        isDanger={true}
        isLoading={actionLoading}
        onConfirm={handleConfirmLogout}
        onCancel={() => setShowLogoutConfirm(false)}
      />

      <ConfirmDialog
        isOpen={showClearDataConfirm}
        title="Wipe All Archived WhatsApp Data"
        message="Are you sure you want to wipe all stored messages, chats, contacts, groups, and AI assistant history from local database and memory? Your active WhatsApp connection will remain connected."
        confirmLabel="Wipe All Data"
        cancelLabel="Cancel"
        isDanger={true}
        isLoading={actionLoading}
        onConfirm={handleConfirmClearData}
        onCancel={() => setShowClearDataConfirm(false)}
      />

      {(error || actionError) && (
        <ErrorMessage
          message={actionError || error}
          onRetry={() => {
            setActionError("");
            refreshStatus();
          }}
        />
      )}

      {successNotice && (
        <div className="success-banner-card">
          <CheckCircle2 size={18} />
          <span>{successNotice}</span>
          <button className="banner-dismiss" onClick={() => setSuccessNotice("")}>×</button>
        </div>
      )}

      {/* Main Connection Status Card */}
      <div className="connection-card-main">
        <div className="connection-header-bar">
          <div className="connection-header-left">
            <div className={`connection-header-avatar ${isConnected ? "avatar-connected" : ""}`}>
              <Smartphone size={28} />
            </div>
            <div>
              <h2>WhatsApp Connection Manager</h2>
              <p>Direct Baileys Multi-Device Web Socket Bridge</p>
            </div>
          </div>
          <div className="connection-header-right">
            <div className="sse-indicator-pill" title={sseActive ? "SSE live stream connected" : "Using polling fallback"}>
              <Radio size={14} className={sseActive ? "pulse-icon green-icon" : "muted-icon"} />
              <span>{sseActive ? "Live Events Active" : "Polling Mode"}</span>
            </div>
            <StatusBadge status={status?.status || (isConnected ? "connected" : "disconnected")} size="lg" />
          </div>
        </div>

        {/* STATE: CONNECTED */}
        {isConnected && (
          <div className="connection-state-connected">
            <div className="connected-account-hero">
              <div className="account-details-grid">
                <div className="account-detail-box">
                  <span className="account-detail-label">Connected Account ID</span>
                  <strong className="account-detail-value">{status?.account || "Unknown"}</strong>
                </div>
                {status?.accountName && (
                  <div className="account-detail-box">
                    <span className="account-detail-label">Account Name</span>
                    <strong className="account-detail-value">{status?.accountName}</strong>
                  </div>
                )}
                {status?.phone && (
                  <div className="account-detail-box">
                    <span className="account-detail-label">Phone Number</span>
                    <strong className="account-detail-value">+{status?.phone}</strong>
                  </div>
                )}
                <div className="account-detail-box">
                  <span className="account-detail-label">Session Established</span>
                  <strong className="account-detail-value">
                    {status?.lastConnected ? new Date(status.lastConnected).toLocaleString() : "Active"}
                  </strong>
                </div>
              </div>
            </div>

            {/* Sync Summary Numbers */}
            <div className="sync-stats-row">
              <div className="sync-stat-pill" onClick={() => onNavigate && onNavigate("messages")}>
                <MessageSquare size={16} />
                <span>Messages</span>
                <strong>{(status?.messageCount ?? status?.totalMessages ?? 0).toLocaleString()}</strong>
              </div>
              <div className="sync-stat-pill" onClick={() => onNavigate && onNavigate("chats")}>
                <MessagesSquare size={16} />
                <span>Chats</span>
                <strong>{(status?.chatCount ?? status?.totalChats ?? 0).toLocaleString()}</strong>
              </div>
              <div className="sync-stat-pill" onClick={() => onNavigate && onNavigate("contacts")}>
                <Users size={16} />
                <span>Contacts</span>
                <strong>{(status?.contactCount ?? status?.contacts ?? 0).toLocaleString()}</strong>
              </div>
              <div className="sync-stat-pill" onClick={() => onNavigate && onNavigate("groups")}>
                <FolderKanban size={16} />
                <span>Groups</span>
                <strong>{(status?.groupCount ?? status?.groups ?? 0).toLocaleString()}</strong>
              </div>
            </div>

            {/* Actions for connected state */}
            <div className="connection-actions-toolbar">
              <button
                className="secondary-button"
                onClick={refreshStatus}
                disabled={actionLoading}
              >
                <RefreshCw size={15} className={actionLoading ? "spin-icon" : ""} />
                Refresh Status
              </button>
              <button
                className="secondary-button"
                onClick={handleReconnect}
                disabled={actionLoading}
                title="Restart Baileys socket without clearing authentication session"
              >
                <RefreshCw size={15} />
                Reconnect Socket
              </button>
              <button
                className="secondary-button"
                onClick={() => setShowClearDataConfirm(true)}
                disabled={actionLoading}
                title="Wipe all archived messages, chats, contacts, groups, and AI history"
              >
                <Trash2 size={15} />
                Wipe Archive Data
              </button>
              <button
                className="danger-button"
                onClick={() => setShowLogoutConfirm(true)}
                disabled={actionLoading}
                title="Log out WhatsApp account, clear session credentials and wipe archived data"
              >
                <LogOut size={15} />
                Sign Out
              </button>
            </div>
          </div>
        )}

        {/* STATE: QR CODE SCAN REQUIRED */}
        {isQrAvailable && (
          <div className="connection-state-qr">
            <QRCodePanel
              qrData={qr}
              onRefresh={refreshQr}
              loading={actionLoading}
            />
          </div>
        )}

        {/* STATE: CONNECTING IN PROGRESS */}
        {isConnecting && !isQrAvailable && !isConnected && (
          <div className="connection-state-connecting">
            <div className="connecting-animation-box">
              <RefreshCw size={48} className="spin-icon connecting-main-spinner" />
              <h3>Connecting to WhatsApp...</h3>
              <p>Establishing socket handshake with WhatsApp servers via Baileys.</p>
              <span className="connecting-note">Please keep this window open. If QR authentication is needed, the QR code will display here automatically.</span>
            </div>
            <div className="connecting-actions">
              <button
                className="secondary-button"
                onClick={refreshStatus}
                disabled={actionLoading}
              >
                <RefreshCw size={14} /> Check Status
              </button>
            </div>
          </div>
        )}

        {/* STATE: DISCONNECTED */}
        {isDisconnected && (
          <div className="connection-state-disconnected">
            <div className="disconnected-illustration">
              <div className="disconnected-icon-circle">
                <Power size={44} />
              </div>
              <h3>WhatsApp is Not Connected</h3>
              <p>
                Connect your WhatsApp account to start synchronizing messages, chats, contacts, and groups directly with Baileys.
              </p>
            </div>

            <div className="disconnected-actions-center">
              <button
                className="primary-button-large"
                onClick={handleConnect}
                disabled={actionLoading}
              >
                <QrCode size={19} />
                {actionLoading ? "Initializing..." : "Connect WhatsApp"}
              </button>
              <button
                className="secondary-button"
                onClick={refreshStatus}
                disabled={actionLoading}
              >
                <RefreshCw size={15} />
                Refresh Status
              </button>
            </div>

            <div className="connection-features-list">
              <div className="feat-item">
                <Shield size={18} />
                <span>Multi-file session credentials stored in auth_info/</span>
              </div>
              <div className="feat-item">
                <RefreshCw size={18} />
                <span>Automatic reconnection on connection drops</span>
              </div>
              <div className="feat-item">
                <Clock size={18} />
                <span>Real-time SSE event publishing for state & QR updates</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Connection Architecture & Diagnostics Card */}
      <div className="connection-card-secondary">
        <div className="secondary-card-title">
          <Shield size={18} />
          <h3>Session & Security Diagnostics</h3>
        </div>
        <div className="diagnostics-grid">
          <div className="diag-row">
            <span>Authentication Engine</span>
            <strong>Baileys Multi-File Auth State</strong>
          </div>
          <div className="diag-row">
            <span>Backend Server</span>
            <strong>http://localhost:3000</strong>
          </div>
          <div className="diag-row">
            <span>Live Channel</span>
            <strong>{sseActive ? "Server-Sent Events (/api/connection/events)" : "Polling Fallback"}</strong>
          </div>
          <div className="diag-row">
            <span>Last Disconnect</span>
            <strong>
              {status?.lastDisconnect
                ? `${status.lastDisconnect.message || "Closed"} (code ${status.lastDisconnect.statusCode || "N/A"})`
                : "None recorded"}
            </strong>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Connection;
