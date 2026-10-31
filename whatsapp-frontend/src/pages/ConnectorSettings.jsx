import React, { useState, useEffect } from "react";
import {
  Settings,
  Server,
  Key,
  ShieldCheck,
  CheckCircle2,
  RefreshCw,
  Cpu,
  Layers,
  Terminal,
  ExternalLink,
  Save,
} from "lucide-react";
import Loading from "../components/Loading.jsx";
import ErrorMessage from "../components/ErrorMessage.jsx";
import analyticsApi from "../api/analyticsApi.js";
import { API_BASE_URL, getApiKey, setApiKey } from "../api/apiClient.js";

export function ConnectorSettings() {
  const [rootInfo, setRootInfo] = useState(null);
  const [health, setHealth] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [inputKey, setInputKey] = useState("");
  const [savedNotice, setSavedNotice] = useState("");

  const loadSettingsData = async () => {
    setLoading(true);
    setError("");
    try {
      const [rootRes, healthRes] = await Promise.all([
        analyticsApi.getRootInfo().catch(() => null),
        analyticsApi.getHealth().catch(() => null),
      ]);
      setRootInfo(rootRes);
      setHealth(healthRes);
    } catch (err) {
      setError(err.message || "Failed to load connector information");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSettingsData();
    setInputKey(getApiKey());
  }, []);

  const handleSaveApiKey = (e) => {
    e.preventDefault();
    setApiKey(inputKey);
    setSavedNotice("API key configuration updated successfully.");
    setTimeout(() => setSavedNotice(""), 3000);
  };

  const mcpTools = [
    { name: "search", desc: "Search the WhatsApp archive (messages, chats, contacts, groups)" },
    { name: "fetch", desc: "Fetch full document content & surrounding transcript by ID" },
    { name: "list_chats", desc: "List chats sorted by latest message, with type and text filters" },
    { name: "get_messages", desc: "Query messages with direction, media kind, and time range filters" },
    { name: "list_contacts", desc: "List or search synced WhatsApp contacts by name or phone" },
    { name: "list_groups", desc: "List or search participating WhatsApp groups" },
    { name: "get_stats", desc: "Archive summary metrics (messages, chats, contacts, groups)" },
  ];

  return (
    <div className="settings-page-wrapper">
      {savedNotice && (
        <div className="success-banner-card">
          <CheckCircle2 size={18} />
          <span>{savedNotice}</span>
        </div>
      )}

      {error && <ErrorMessage message={error} onRetry={loadSettingsData} />}

      {/* Backend Server Information */}
      <div className="settings-section-card">
        <div className="settings-section-header">
          <Server size={20} className="section-icon" />
          <div>
            <h3>Backend Server & Health</h3>
            <p>Connection parameters for the WhatsApp Connector backend service</p>
          </div>
        </div>

        <div className="settings-grid">
          <div className="setting-prop-box">
            <span className="prop-label">Backend Base URL</span>
            <strong className="prop-value">{API_BASE_URL}</strong>
          </div>
          <div className="setting-prop-box">
            <span className="prop-label">API Health Status</span>
            <span className={`health-pill ${health?.ok ? "health-ok" : "health-err"}`}>
              {health?.ok ? "Operational (OK)" : "Unreachable"}
            </span>
          </div>
          <div className="setting-prop-box">
            <span className="prop-label">Server Uptime</span>
            <strong className="prop-value">
              {health?.uptimeSeconds ? `${Math.floor(health.uptimeSeconds / 60)} minutes` : "—"}
            </strong>
          </div>
          <div className="setting-prop-box">
            <span className="prop-label">Server Authentication</span>
            <strong className="prop-value">{rootInfo?.auth || "API_KEY / None"}</strong>
          </div>
        </div>
      </div>

      {/* Model Context Protocol (MCP) Endpoints */}
      <div className="settings-section-card">
        <div className="settings-section-header">
          <Cpu size={20} className="section-icon" />
          <div>
            <h3>Model Context Protocol (MCP) Endpoints</h3>
            <p>JSON-RPC over HTTP integration for AI agents and developer tooling</p>
          </div>
        </div>

        <div className="mcp-endpoints-list">
          <div className="endpoint-item-box">
            <div className="endpoint-method-path">
              <span className="http-badge post">POST</span>
              <code>/mcp</code>
            </div>
            <p className="endpoint-desc">
              Local MCP JSON-RPC endpoint. Blocked automatically through reverse tunnels. Protected by API_KEY when configured.
            </p>
          </div>

          <div className="endpoint-item-box">
            <div className="endpoint-method-path">
              <span className="http-badge post">POST</span>
              <code>/mcp/:token</code>
            </div>
            <p className="endpoint-desc">
              Tunnel-accessible MCP JSON-RPC endpoint. Requires a temporary token generated via <code>node tokens.js [minutes]</code>.
            </p>
          </div>

          <div className="endpoint-item-box">
            <div className="endpoint-method-path">
              <span className="http-badge get">GET</span>
              <code>/api/connector/search?query=&scope=</code>
            </div>
            <p className="endpoint-desc">Connector search interface returning structured search documents.</p>
          </div>

          <div className="endpoint-item-box">
            <div className="endpoint-method-path">
              <span className="http-badge get">GET</span>
              <code>/api/connector/fetch/:id</code>
            </div>
            <p className="endpoint-desc">Fetch full document and transcripts (message:, chat:, contact:, group:).</p>
          </div>
        </div>

        {/* MCP Tools Table */}
        <div className="mcp-tools-subtable">
          <h4>Supported MCP Agent Tools</h4>
          <div className="tools-grid-list">
            {mcpTools.map((t) => (
              <div key={t.name} className="tool-grid-item">
                <code className="tool-name-pill">{t.name}</code>
                <p className="tool-desc-text">{t.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Client API Key Configuration */}
      <div className="settings-section-card">
        <div className="settings-section-header">
          <Key size={20} className="section-icon" />
          <div>
            <h3>Client API Authentication Key</h3>
            <p>Configure an optional API key sent with all frontend requests if the backend requires authorization</p>
          </div>
        </div>

        <form onSubmit={handleSaveApiKey} className="api-key-form">
          <div className="api-key-input-row">
            <input
              type="password"
              placeholder="Enter your x-api-key (or leave empty if no key is configured)..."
              value={inputKey}
              onChange={(e) => setInputKey(e.target.value)}
              className="api-key-input"
            />
            <button type="submit" className="primary-button-accent">
              <Save size={15} /> Save Key
            </button>
            {inputKey && (
              <button
                type="button"
                className="secondary-button"
                onClick={() => {
                  setInputKey("");
                  setApiKey("");
                  setSavedNotice("API key cleared.");
                }}
              >
                Clear
              </button>
            )}
          </div>
          <small className="setting-help-text">
            Stored locally in your browser's private localStorage. Never hardcoded or transmitted elsewhere.
          </small>
        </form>
      </div>
    </div>
  );
}

export default ConnectorSettings;
