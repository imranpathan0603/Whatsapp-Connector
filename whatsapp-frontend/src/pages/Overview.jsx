import React, { useState, useEffect } from "react";
import {
  MessageSquare,
  MessagesSquare,
  Users,
  FolderKanban,
  ArrowUpRight,
  ArrowDownLeft,
  Smartphone,
  Server,
  Activity,
  ChevronRight,
  RefreshCw,
  QrCode,
  Clock,
  Shield,
} from "lucide-react";
import StatCard from "../components/StatCard.jsx";
import StatusBadge from "../components/StatusBadge.jsx";
import Loading from "../components/Loading.jsx";
import ErrorMessage from "../components/ErrorMessage.jsx";
import analyticsApi from "../api/analyticsApi.js";
import messagesApi from "../api/messagesApi.js";
import chatsApi from "../api/chatsApi.js";
import { formatMessagePreview } from "../utils/formatters.js";

export function Overview({
  connectionState,
  onNavigate,
}) {
  const { status, refreshStatus } = connectionState;

  const [stats, setStats] = useState(null);
  const [recentMessages, setRecentMessages] = useState([]);
  const [recentChats, setRecentChats] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const loadData = async () => {
    try {
      const [statsData, msgsData, chatsData] = await Promise.all([
        analyticsApi.getStats().catch(() => null),
        messagesApi.getMessages({ limit: 5, order: "desc" }).catch(() => ({ data: [] })),
        chatsApi.getChats({ limit: 5 }).catch(() => ({ data: [] })),
      ]);

      setStats(statsData);
      const filteredMsgs = Array.isArray(msgsData?.data)
        ? msgsData.data.filter((m) => m.text || m.kind)
        : [];
      setRecentMessages(filteredMsgs);
      setRecentChats(Array.isArray(chatsData?.data) ? chatsData.data : []);
      setError("");
    } catch (err) {
      setError(err.message || "Failed to load overview data");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadData();
    const handleAccountChange = () => {
      loadData();
    };
    window.addEventListener("whatsapp:data_cleared", handleAccountChange);
    window.addEventListener("whatsapp:login_changed", handleAccountChange);
    return () => {
      window.removeEventListener("whatsapp:data_cleared", handleAccountChange);
      window.removeEventListener("whatsapp:login_changed", handleAccountChange);
    };
  }, []);

  const handleRefreshAll = async () => {
    setRefreshing(true);
    await Promise.all([refreshStatus(), loadData()]);
  };

  // Field mapping with fallbacks to avoid field mismatch
  const totalMessages = stats?.totalMessages ?? stats?.messageCount ?? status?.totalMessages ?? status?.messageCount ?? 0;
  const totalChats = stats?.totalChats ?? stats?.chatCount ?? status?.totalChats ?? status?.chatCount ?? 0;
  const totalContacts = stats?.contacts ?? stats?.contactCount ?? status?.contacts ?? status?.contactCount ?? 0;
  const totalGroups = stats?.groups ?? stats?.groupCount ?? status?.groups ?? status?.groupCount ?? 0;
  const sentMessages = stats?.sent ?? stats?.sentCount ?? 0;
  const receivedMessages = stats?.received ?? stats?.receivedCount ?? 0;
  const individualChats = stats?.individualChats ?? 0;
  const groupChats = stats?.groupChats ?? 0;

  const isConnected = status?.connected === true;

  return (
    <div className="overview-page-container">
      {error && <ErrorMessage message={error} onRetry={handleRefreshAll} />}

      {/* Welcome Banner */}
      <div className="overview-welcome-banner">
        <div className="welcome-banner-content">
          <div className="welcome-banner-text">
            <h2>WhatsApp Connector Overview</h2>
            <p>
              Real-time monitoring and analytics for your Baileys WhatsApp connection. All data is synchronized directly from your linked account.
            </p>
          </div>
          <div className="welcome-banner-actions">
            <button
              className="primary-button-accent"
              onClick={() => onNavigate && onNavigate("connection")}
            >
              <QrCode size={17} />
              {isConnected ? "Connection Details" : "Connect WhatsApp"}
            </button>
            <button
              className="secondary-button-light"
              onClick={handleRefreshAll}
              disabled={refreshing}
            >
              <RefreshCw size={14} className={refreshing ? "spin-icon" : ""} />
              Refresh
            </button>
          </div>
        </div>
      </div>

      {/* Primary Stats Grid */}
      <div className="overview-stats-grid">
        <StatCard
          icon={MessageSquare}
          label="Total Messages"
          value={totalMessages}
          subtitle={`${sentMessages.toLocaleString()} sent · ${receivedMessages.toLocaleString()} received`}
          color="green"
          onClick={() => onNavigate && onNavigate("messages")}
        />
        <StatCard
          icon={MessagesSquare}
          label="Total Chats"
          value={totalChats}
          subtitle={`${individualChats} individual · ${groupChats} groups`}
          color="blue"
          onClick={() => onNavigate && onNavigate("chats")}
        />
        <StatCard
          icon={Users}
          label="Total Contacts"
          value={totalContacts}
          subtitle="Synced contact book"
          color="purple"
          onClick={() => onNavigate && onNavigate("contacts")}
        />
        <StatCard
          icon={FolderKanban}
          label="Total Groups"
          value={totalGroups}
          subtitle="Participating WhatsApp groups"
          color="amber"
          onClick={() => onNavigate && onNavigate("groups")}
        />
      </div>

      {/* Secondary Stats Row: Sent vs Received, Individual vs Group */}
      <div className="overview-substats-grid">
        <div className="substat-card">
          <div className="substat-header">
            <span className="substat-title">Message Direction</span>
            <ArrowUpRight size={16} className="text-muted" />
          </div>
          <div className="substat-numbers">
            <div className="substat-col">
              <span className="substat-label">Sent</span>
              <strong className="substat-val sent-val">{sentMessages.toLocaleString()}</strong>
            </div>
            <div className="substat-divider" />
            <div className="substat-col">
              <span className="substat-label">Received</span>
              <strong className="substat-val received-val">{receivedMessages.toLocaleString()}</strong>
            </div>
          </div>
          <div className="ratio-bar-wrap">
            <div
              className="ratio-bar-sent"
              style={{
                width: `${totalMessages > 0 ? (sentMessages / totalMessages) * 100 : 50}%`,
              }}
            />
          </div>
        </div>

        <div className="substat-card">
          <div className="substat-header">
            <span className="substat-title">Chat Classification</span>
            <MessagesSquare size={16} className="text-muted" />
          </div>
          <div className="substat-numbers">
            <div className="substat-col">
              <span className="substat-label">Individual</span>
              <strong className="substat-val">{individualChats}</strong>
            </div>
            <div className="substat-divider" />
            <div className="substat-col">
              <span className="substat-label">Groups</span>
              <strong className="substat-val">{groupChats}</strong>
            </div>
          </div>
          <div className="ratio-bar-wrap">
            <div
              className="ratio-bar-individual"
              style={{
                width: `${totalChats > 0 ? (individualChats / totalChats) * 100 : 50}%`,
              }}
            />
          </div>
        </div>
      </div>

      {/* Connection Status Panel & Activity Grid */}
      <div className="overview-panels-split">
        {/* Connection Status Panel */}
        <div className="dashboard-panel">
          <div className="panel-top-row">
            <div>
              <h3>WhatsApp Connection Status</h3>
              <p>Real-time bridge connection state</p>
            </div>
            <StatusBadge status={status?.status} size="md" />
          </div>

          <div className="status-data-list">
            <div className="status-data-item">
              <span>API Server</span>
              <strong>Reachable (Port 3000)</strong>
            </div>
            <div className="status-data-item">
              <span>WhatsApp Account</span>
              <strong>{status?.account ? status.account : "Not connected"}</strong>
            </div>
            {status?.accountName && (
              <div className="status-data-item">
                <span>Account Name</span>
                <strong>{status.accountName}</strong>
              </div>
            )}
            <div className="status-data-item">
              <span>Current Connection State</span>
              <strong className="capitalize">{status?.status || "disconnected"}</strong>
            </div>
            <div className="status-data-item">
              <span>Last Connected</span>
              <strong>
                {status?.lastConnected ? new Date(status.lastConnected).toLocaleString() : "—"}
              </strong>
            </div>
          </div>

          <div className="panel-bottom-action">
            <button
              className="primary-button full-width"
              onClick={() => onNavigate && onNavigate("connection")}
            >
              <Smartphone size={16} />
              Open WhatsApp Connection
            </button>
          </div>
        </div>

        {/* Recent Activity Panel */}
        <div className="dashboard-panel">
          <div className="panel-top-row">
            <div>
              <h3>Recent Message Activity</h3>
              <p>Latest incoming & outgoing messages</p>
            </div>
            <button
              className="link-button"
              onClick={() => onNavigate && onNavigate("messages")}
            >
              View All <ChevronRight size={14} />
            </button>
          </div>

          {loading ? (
            <Loading message="Loading recent messages..." />
          ) : recentMessages.length === 0 ? (
            <div className="empty-panel-text">
              <p>No messages recorded in the archive yet.</p>
            </div>
          ) : (
            <div className="recent-activity-list">
              {recentMessages.map((msg) => (
                <div key={msg.id} className="activity-item">
                  <div className={`activity-direction-dot ${msg.fromMe ? "sent" : "received"}`}>
                    {msg.fromMe ? <ArrowUpRight size={12} /> : <ArrowDownLeft size={12} />}
                  </div>
                  <div className="activity-main">
                    <div className="activity-sender-row">
                      <strong className="activity-sender">{msg.senderName || "Sender"}</strong>
                      <span className="activity-chat">{msg.chatName || "Direct Chat"}</span>
                    </div>
                    <p className="activity-text">{formatMessagePreview(msg)}</p>
                  </div>
                  <span className="activity-time">
                    {msg.time ? new Date(msg.time).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "—"}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default Overview;
