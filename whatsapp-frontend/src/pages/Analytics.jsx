import React, { useState, useEffect } from "react";
import {
  BarChart3,
  TrendingUp,
  Clock,
  Users,
  Download,
  RefreshCw,
  ArrowUpRight,
  ArrowDownLeft,
  Calendar,
  FileSpreadsheet,
  FileJson,
} from "lucide-react";
import Loading from "../components/Loading.jsx";
import ErrorMessage from "../components/ErrorMessage.jsx";
import analyticsApi from "../api/analyticsApi.js";
import messagesApi from "../api/messagesApi.js";

export function Analytics() {
  const [stats, setStats] = useState(null);
  const [dailyData, setDailyData] = useState([]);
  const [hourlyData, setHourlyData] = useState([]);
  const [topSenders, setTopSenders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadAnalytics = async () => {
    setLoading(true);
    setError("");
    try {
      const [statsRes, dailyRes, hourlyRes, sendersRes] = await Promise.all([
        analyticsApi.getStats(),
        analyticsApi.getDaily().catch(() => ({ data: [] })),
        analyticsApi.getHourly().catch(() => ({ data: [] })),
        analyticsApi.getTopSenders({ limit: 8 }).catch(() => ({ data: [] })),
      ]);

      setStats(statsRes);
      setDailyData(Array.isArray(dailyRes.data) ? dailyRes.data : []);
      setHourlyData(Array.isArray(hourlyRes.data) ? hourlyRes.data : []);
      setTopSenders(Array.isArray(sendersRes.data) ? sendersRes.data : []);
    } catch (err) {
      setError(err.message || "Failed to load analytics");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAnalytics();
  }, []);

  const totalMessages = stats?.totalMessages || 0;
  const sentMessages = stats?.sent || 0;
  const receivedMessages = stats?.received || 0;
  const individualChats = stats?.individualChats || 0;
  const groupChats = stats?.groupChats || 0;

  // Max value for daily chart scaling
  const maxDaily = Math.max(1, ...dailyData.map((d) => d.total || 0));
  // Max value for hourly chart scaling
  const maxHourly = Math.max(1, ...hourlyData.map((h) => h.total || 0));

  return (
    <div className="analytics-page-wrapper">
      {/* Header Bar with Export Actions */}
      <div className="analytics-top-header">
        <div>
          <h2>WhatsApp Activity & Analytics</h2>
          <p>Real-time analytics computed directly from your WhatsApp conversation archive.</p>
        </div>
        <div className="analytics-actions-group">
          <a
            href={messagesApi.getExportUrl("json")}
            download="messages.json"
            className="secondary-button"
            title="Download complete messages archive as JSON"
          >
            <FileJson size={15} /> Export JSON
          </a>
          <a
            href={messagesApi.getExportUrl("csv")}
            download="messages.csv"
            className="secondary-button"
            title="Download messages archive as CSV spreadsheet"
          >
            <FileSpreadsheet size={15} /> Export CSV
          </a>
          <button className="secondary-button" onClick={loadAnalytics} disabled={loading}>
            <RefreshCw size={14} className={loading ? "spin-icon" : ""} /> Refresh
          </button>
        </div>
      </div>

      {error && <ErrorMessage message={error} onRetry={loadAnalytics} />}

      {loading ? (
        <Loading message="Aggregating analytics data..." />
      ) : (
        <>
          {/* Summary Row Cards */}
          <div className="analytics-metrics-grid">
            <div className="metric-card">
              <span className="metric-card-label">Total Messages</span>
              <h3 className="metric-card-number">{totalMessages.toLocaleString()}</h3>
              <div className="metric-pill-row">
                <span className="pill-sent"><ArrowUpRight size={12} /> {sentMessages.toLocaleString()} sent</span>
                <span className="pill-received"><ArrowDownLeft size={12} /> {receivedMessages.toLocaleString()} recv</span>
              </div>
            </div>

            <div className="metric-card">
              <span className="metric-card-label">Chat Distribution</span>
              <h3 className="metric-card-number">{(individualChats + groupChats).toLocaleString()}</h3>
              <div className="metric-pill-row">
                <span className="pill-individual">{individualChats} individual</span>
                <span className="pill-group">{groupChats} groups</span>
              </div>
            </div>

            <div className="metric-card">
              <span className="metric-card-label">Active Contacts</span>
              <h3 className="metric-card-number">{(stats?.contacts || 0).toLocaleString()}</h3>
              <small className="metric-note">Across all group & 1-on-1 threads</small>
            </div>

            <div className="metric-card">
              <span className="metric-card-label">Participating Groups</span>
              <h3 className="metric-card-number">{(stats?.groups || 0).toLocaleString()}</h3>
              <small className="metric-note">Full synced WhatsApp groups</small>
            </div>
          </div>

          {/* Daily Activity Chart */}
          <div className="chart-panel-card">
            <div className="chart-header-row">
              <div className="chart-title-block">
                <TrendingUp size={18} className="chart-header-icon" />
                <div>
                  <h3>Daily Message Volume</h3>
                  <p>Message flow history over time</p>
                </div>
              </div>
              <span className="chart-badge">{dailyData.length} active days</span>
            </div>

            {dailyData.length === 0 ? (
              <p className="text-muted empty-chart-text">No daily activity data available.</p>
            ) : (
              <div className="daily-chart-svg-container">
                <svg viewBox={`0 0 ${Math.max(600, dailyData.length * 48)} 220`} className="custom-bar-chart">
                  <line x1="0" y1="180" x2={Math.max(600, dailyData.length * 48)} y2="180" stroke="#e5e7eb" strokeDasharray="4 4" />
                  <line x1="0" y1="100" x2={Math.max(600, dailyData.length * 48)} y2="100" stroke="#e5e7eb" strokeDasharray="4 4" />
                  <line x1="0" y1="20" x2={Math.max(600, dailyData.length * 48)} y2="20" stroke="#e5e7eb" strokeDasharray="4 4" />

                  {dailyData.map((d, i) => {
                    const x = i * 48 + 24;
                    const barHeight = Math.max(4, ((d.total || 0) / maxDaily) * 150);
                    const y = 180 - barHeight;
                    const sentHeight = d.total > 0 ? (d.sent / d.total) * barHeight : 0;
                    const recvHeight = barHeight - sentHeight;

                    return (
                      <g key={d.date || i} className="chart-bar-group">
                        <title>{`${d.date}: ${d.total} messages (${d.sent} sent, ${d.received} recv)`}</title>
                        {/* Received part (bottom) */}
                        <rect
                          x={x}
                          y={180 - recvHeight}
                          width="26"
                          height={recvHeight}
                          rx="3"
                          fill="#10b981"
                          className="bar-received"
                        />
                        {/* Sent part (top) */}
                        <rect
                          x={x}
                          y={y}
                          width="26"
                          height={sentHeight}
                          rx="3"
                          fill="#059669"
                          className="bar-sent"
                        />
                        {/* Value label */}
                        <text x={x + 13} y={Math.max(15, y - 5)} textAnchor="middle" fontSize="10" fill="#6b7280">
                          {d.total}
                        </text>
                        {/* Date label */}
                        <text x={x + 13} y="198" textAnchor="middle" fontSize="10" fill="#9ca3af">
                          {d.date?.slice(5) || ""}
                        </text>
                      </g>
                    );
                  })}
                </svg>
                <div className="chart-legend-row">
                  <span className="legend-item"><span className="legend-box color-sent" /> Sent</span>
                  <span className="legend-item"><span className="legend-box color-recv" /> Received</span>
                </div>
              </div>
            )}
          </div>

          {/* 2-Column Grid: Hourly Activity & Top Senders */}
          <div className="analytics-split-grid">
            {/* Hourly Distribution */}
            <div className="chart-panel-card">
              <div className="chart-header-row">
                <div className="chart-title-block">
                  <Clock size={18} className="chart-header-icon" />
                  <div>
                    <h3>24-Hour Activity Profile</h3>
                    <p>Message traffic by hour of day (UTC)</p>
                  </div>
                </div>
              </div>

              {hourlyData.length === 0 ? (
                <p className="text-muted empty-chart-text">No hourly activity recorded.</p>
              ) : (
                <div className="hourly-chart-container">
                  <div className="hourly-bars-flex">
                    {hourlyData.map((h) => {
                      const pct = maxHourly > 0 ? (h.total / maxHourly) * 100 : 0;
                      return (
                        <div key={h.hour} className="hourly-col" title={`Hour ${h.hour}:00 — ${h.total} messages`}>
                          <div className="hourly-bar-track">
                            <div className="hourly-bar-fill" style={{ height: `${Math.max(pct, 4)}%` }} />
                          </div>
                          <span className="hour-label">{h.hour}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* Top Senders */}
            <div className="chart-panel-card">
              <div className="chart-header-row">
                <div className="chart-title-block">
                  <Users size={18} className="chart-header-icon" />
                  <div>
                    <h3>Top Active Senders</h3>
                    <p>Most frequent message contributors</p>
                  </div>
                </div>
              </div>

              {topSenders.length === 0 ? (
                <p className="text-muted empty-chart-text">No sender statistics available.</p>
              ) : (
                <div className="top-senders-list">
                  {topSenders.map((s, idx) => {
                    const maxCount = topSenders[0]?.count || 1;
                    const pct = (s.count / maxCount) * 100;
                    return (
                      <div key={s.sender} className="top-sender-row">
                        <span className="sender-rank">#{idx + 1}</span>
                        <div className="sender-name-bar-block">
                          <div className="sender-name-counts">
                            <strong>{s.name || s.sender?.split("@")[0] || "Unknown"}</strong>
                            <span>{s.count.toLocaleString()} msgs</span>
                          </div>
                          <div className="sender-progress-track">
                            <div className="sender-progress-fill" style={{ width: `${pct}%` }} />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Message Types Distribution */}
          {stats?.messageTypes && Object.keys(stats.messageTypes).length > 0 && (
            <div className="chart-panel-card">
              <div className="chart-header-row">
                <div>
                  <h3>Message Type Distribution</h3>
                  <p>Categorization of synchronized messages by Baileys payload type</p>
                </div>
              </div>

              <div className="types-distribution-grid">
                {Object.entries(stats.messageTypes).map(([typeKey, count]) => {
                  const pct = totalMessages > 0 ? ((count / totalMessages) * 100).toFixed(1) : 0;
                  return (
                    <div key={typeKey} className="type-stat-card">
                      <div className="type-stat-header">
                        <span className="type-stat-name">{typeKey}</span>
                        <strong>{count.toLocaleString()}</strong>
                      </div>
                      <div className="type-progress-track">
                        <div className="type-progress-fill" style={{ width: `${Math.max(pct, 3)}%` }} />
                      </div>
                      <span className="type-pct-label">{pct}% of archive</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default Analytics;
