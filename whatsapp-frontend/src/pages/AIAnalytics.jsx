import React, { useState, useEffect } from "react";
import {
  BrainCircuit,
  RefreshCw,
  TrendingUp,
  MessageSquare,
  Users,
  Send,
  Inbox,
  Sparkles,
  ArrowUpRight,
  ShieldCheck,
} from "lucide-react";
import { getAIInsights } from "../api/assistantApi.js";
import Loading from "../components/Loading.jsx";
import ErrorMessage from "../components/ErrorMessage.jsx";
import StatCard from "../components/StatCard.jsx";

export function AIAnalytics({ onOpenCopilot }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchInsights = async (force = false) => {
    setLoading(true);
    setError(null);
    try {
      const res = await getAIInsights({ forceRefresh: force });
      setData(res);
    } catch (err) {
      console.error("Failed to load AI analytics insights:", err);
      setError(err.message || "Failed to load conversational intelligence insights.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInsights();
  }, []);

  const metrics = data?.metrics || {};

  return (
    <div className="page-container ai-analytics-page">
      {/* Header Banner */}
      <div className="page-header-row">
        <div>
          <h1 className="page-title flex-align-center gap-2">
            <BrainCircuit size={24} className="sparkle-gold" />
            AI Conversational Intelligence
          </h1>
          <p className="page-subtitle">
            Strategic communication insights, stakeholder dynamics, and responsiveness patterns extracted from your WhatsApp archive.
          </p>
        </div>

        <div className="page-actions-row">
          <button
            type="button"
            className="btn-secondary"
            onClick={() => fetchInsights(true)}
            disabled={loading}
          >
            <RefreshCw size={15} className={loading ? "spin-icon" : ""} />
            <span>Refresh Intelligence</span>
          </button>
          {onOpenCopilot && (
            <button
              type="button"
              className="btn-primary"
              onClick={() => onOpenCopilot("Explain my communication trends and where I can improve responsiveness")}
            >
              <Sparkles size={15} />
              <span>Ask Copilot Insights</span>
            </button>
          )}
        </div>
      </div>

      {/* KPI Cards */}
      <div className="stats-grid">
        <StatCard
          title="Total Messages Analyzed"
          value={metrics.totalMessages?.toLocaleString() || "0"}
          subtitle="Indexed in local store"
          icon={MessageSquare}
          variant="primary"
        />
        <StatCard
          title="Active Chat Streams"
          value={metrics.activeChats || "0"}
          subtitle="Individual & group discussions"
          icon={Users}
          variant="success"
        />
        <StatCard
          title="Sent Ratio"
          value={`${metrics.sentRatio || 0}%`}
          subtitle={`${metrics.sentCount || 0} sent / ${metrics.receivedCount || 0} received`}
          icon={Send}
          variant="warning"
        />
        <StatCard
          title="Intelligence Engine"
          value="Gemini 2.5"
          subtitle="Strict read-only security"
          icon={ShieldCheck}
          variant="neutral"
        />
      </div>

      {/* Insights Content Area */}
      {loading ? (
        <Loading message="Synthesizing conversational intelligence & pattern analysis..." />
      ) : error ? (
        <ErrorMessage message={error} onRetry={() => fetchInsights(true)} />
      ) : data ? (
        <div className="ai-insights-report-card">
          <div className="report-card-header">
            <div className="report-badge-group">
              <span className="badge badge-purple">
                <BrainCircuit size={13} /> Deep Synthesis
              </span>
              <span className="badge badge-neutral">
                Generated: {new Date(data.generatedAt || Date.now()).toLocaleTimeString()}
              </span>
            </div>
            {onOpenCopilot && (
              <button
                type="button"
                className="btn-copilot-link"
                onClick={() => onOpenCopilot("How can I optimize my WhatsApp communication velocity?")}
              >
                <span>Drill down with Copilot</span>
                <ArrowUpRight size={13} />
              </button>
            )}
          </div>

          <div className="ai-report-body">
            {data.insights ? (
              data.insights.split("\n").map((line, idx) => {
                const trimmed = line.trim();
                if (!trimmed) return <div key={idx} className="spacer-line" />;
                if (trimmed.startsWith("### ")) {
                  return <h3 key={idx}>{trimmed.replace("### ", "")}</h3>;
                }
                if (trimmed.startsWith("## ")) {
                  return <h2 key={idx}>{trimmed.replace("## ", "")}</h2>;
                }
                if (trimmed.startsWith("* ") || trimmed.startsWith("- ")) {
                  return (
                    <div key={idx} className="report-bullet-item">
                      <span className="report-bullet-dot">✦</span>
                      <span>{trimmed.replace(/^[\*\-]\s+/, "")}</span>
                    </div>
                  );
                }
                return (
                  <p key={idx} className="report-para">
                    {trimmed}
                  </p>
                );
              })
            ) : (
              <p>No insights generated yet. Click Refresh to analyze.</p>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}

export default AIAnalytics;
