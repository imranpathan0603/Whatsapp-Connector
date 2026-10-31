import React, { useState, useEffect } from "react";
import {
  Sparkles,
  Calendar,
  Filter,
  RefreshCw,
  Copy,
  Check,
  Download,
  FileText,
  AlertCircle,
  MessageSquare,
} from "lucide-react";
import { getAISummary } from "../api/assistantApi.js";
import { getChats } from "../api/chatsApi.js";
import Loading from "../components/Loading.jsx";
import ErrorMessage from "../components/ErrorMessage.jsx";

const PERIOD_OPTIONS = [
  { id: "today", label: "Today" },
  { id: "yesterday", label: "Yesterday" },
  { id: "week", label: "This Week" },
  { id: "month", label: "This Month" },
  { id: "all", label: "All Archived" },
];

export function AISummary({ onOpenCopilot }) {
  const [period, setPeriod] = useState("today");
  const [chatId, setChatId] = useState("");
  const [chats, setChats] = useState([]);
  const [summaryData, setSummaryData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [copied, setCopied] = useState(false);

  // Load chat options for filter
  useEffect(() => {
    (async () => {
      try {
        const res = await getChats({ limit: 40 });
        if (Array.isArray(res)) setChats(res);
        else if (res && Array.isArray(res.chats)) setChats(res.chats);
      } catch (err) {
        console.warn("Could not load chats list for filter", err);
      }
    })();
  }, []);

  const fetchSummary = async (force = false) => {
    setLoading(true);
    setError(null);
    try {
      const data = await getAISummary({ period, chatId, forceRefresh: force });
      setSummaryData(data);
    } catch (err) {
      console.error("Failed to load AI summary:", err);
      setError(err.message || "Failed to generate AI executive summary.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSummary();
  }, [period, chatId]);

  const handleCopy = () => {
    if (!summaryData?.summary) return;
    navigator.clipboard.writeText(summaryData.summary).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const handleDownload = () => {
    if (!summaryData?.summary) return;
    const blob = new Blob([summaryData.summary], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `whatsapp-summary-${period}-${new Date().toISOString().slice(0, 10)}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="page-container ai-summary-page">
      {/* Header Banner */}
      <div className="page-header-row">
        <div>
          <h1 className="page-title flex-align-center gap-2">
            <Sparkles size={24} className="sparkle-gold" />
            Executive AI Summaries
          </h1>
          <p className="page-subtitle">
            Generate grounded executive digests, key decisions, and action items powered by Gemini Flash Lite.
          </p>
        </div>

        <div className="page-actions-row">
          <button
            type="button"
            className="btn-secondary"
            onClick={() => fetchSummary(true)}
            disabled={loading}
          >
            <RefreshCw size={15} className={loading ? "spin-icon" : ""} />
            <span>Regenerate</span>
          </button>
          {summaryData?.summary && (
            <>
              <button type="button" className="btn-secondary" onClick={handleCopy}>
                {copied ? <Check size={15} className="text-success" /> : <Copy size={15} />}
                <span>{copied ? "Copied" : "Copy Markdown"}</span>
              </button>
              <button type="button" className="btn-secondary" onClick={handleDownload}>
                <Download size={15} />
                <span>Export .md</span>
              </button>
            </>
          )}
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="summary-filter-toolbar">
        <div className="filter-group">
          <label className="filter-label">
            <Calendar size={14} /> Time Period:
          </label>
          <div className="period-pill-group">
            {PERIOD_OPTIONS.map((opt) => (
              <button
                key={opt.id}
                type="button"
                className={`period-pill-btn ${period === opt.id ? "active" : ""}`}
                onClick={() => setPeriod(opt.id)}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        <div className="filter-group">
          <label className="filter-label">
            <Filter size={14} /> Focus Chat (Optional):
          </label>
          <select
            className="filter-select"
            value={chatId}
            onChange={(e) => setChatId(e.target.value)}
          >
            <option value="">All Chats & Groups</option>
            {chats.map((c) => (
              <option key={c.chatId} value={c.chatId}>
                {c.name || c.chatId} {c.isGroup ? "(Group)" : ""}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Content Area */}
      {loading ? (
        <Loading message="Gemini is analyzing archived messages and synthesizing executive summary..." />
      ) : error ? (
        <ErrorMessage message={error} onRetry={() => fetchSummary(true)} />
      ) : summaryData ? (
        <div className="ai-summary-content-card">
          <div className="summary-meta-header">
            <div className="summary-badges">
              <span className="badge badge-info">
                Period: <strong>{summaryData.period || period}</strong>
              </span>
              <span className="badge badge-success">
                Messages Analyzed: <strong>{summaryData.totalAnalyzed || 0}</strong>
              </span>
              <span className="badge badge-neutral">
                Model: <strong>Gemini Flash Lite</strong>
              </span>
            </div>

            {onOpenCopilot && (
              <button
                type="button"
                className="btn-copilot-link"
                onClick={() => onOpenCopilot(`Explain more details about the summary for ${period}`)}
              >
                <MessageSquare size={14} />
                <span>Ask Copilot about this</span>
              </button>
            )}
          </div>

          <div className="summary-markdown-body">
            {summaryData.summary.split("\n").map((line, idx) => {
              const trimmed = line.trim();
              if (!trimmed) return <div key={idx} className="spacer-line" />;
              if (trimmed.startsWith("### ")) {
                return <h3 key={idx}>{trimmed.replace("### ", "")}</h3>;
              }
              if (trimmed.startsWith("## ")) {
                return <h2 key={idx}>{trimmed.replace("## ", "")}</h2>;
              }
              if (trimmed.startsWith("# ")) {
                return <h1 key={idx}>{trimmed.replace("# ", "")}</h1>;
              }
              if (trimmed.startsWith("* ") || trimmed.startsWith("- ")) {
                return (
                  <div key={idx} className="summary-bullet">
                    <span className="bullet-dot">•</span>
                    <span>{trimmed.replace(/^[\*\-]\s+/, "")}</span>
                  </div>
                );
              }
              if (/^\d+\.\s+/.test(trimmed)) {
                return (
                  <div key={idx} className="summary-numbered">
                    <span className="numbered-index">{trimmed.match(/^\d+\./)[0]}</span>
                    <span>{trimmed.replace(/^\d+\.\s+/, "")}</span>
                  </div>
                );
              }
              return (
                <p key={idx} className="summary-para">
                  {trimmed}
                </p>
              );
            })}
          </div>
        </div>
      ) : null}
    </div>
  );
}

export default AISummary;
