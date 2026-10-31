import React, { useState } from "react";
import {
  Sliders,
  ShieldCheck,
  Cpu,
  Trash2,
  CheckCircle,
  AlertTriangle,
  Sparkles,
  Zap,
  Lock,
  RefreshCw,
} from "lucide-react";
import { clearAssistantHistory, askAssistant } from "../api/assistantApi.js";

export function AISettings({ onOpenCopilot }) {
  const [clearing, setClearing] = useState(false);
  const [clearSuccess, setClearSuccess] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState(null);

  const handleClearHistory = async () => {
    setClearing(true);
    setClearSuccess(false);
    try {
      const convId = sessionStorage.getItem("whatsapp_ai_conversation_id");
      await clearAssistantHistory(convId);
      sessionStorage.removeItem("whatsapp_ai_conversation_id");
      setClearSuccess(true);
      setTimeout(() => setClearSuccess(false), 3000);
    } catch (err) {
      console.error("Failed to clear assistant history", err);
    } finally {
      setClearing(false);
    }
  };

  const handleTestConnection = async () => {
    setTesting(true);
    setTestResult(null);
    const start = Date.now();
    try {
      const res = await askAssistant({
        message: "Quick latency test: respond with READY.",
        context: { page: "settings" },
      });
      const elapsed = Date.now() - start;
      setTestResult({
        ok: true,
        latency: elapsed,
        answer: res.answer || res.message?.content || "Connected",
      });
    } catch (err) {
      setTestResult({
        ok: false,
        error: err.message || "Connection test failed",
      });
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="page-container ai-settings-page">
      {/* Header */}
      <div className="page-header-row">
        <div>
          <h1 className="page-title flex-align-center gap-2">
            <Sliders size={24} className="sparkle-gold" />
            AI Copilot Settings & Diagnostics
          </h1>
          <p className="page-subtitle">
            Manage your Gemini-powered WhatsApp AI copilot configuration, security boundaries, and session memory.
          </p>
        </div>

        <button
          type="button"
          className="btn-secondary"
          onClick={handleTestConnection}
          disabled={testing}
        >
          <Zap size={15} className={testing ? "spin-icon" : "text-warning"} />
          <span>{testing ? "Testing Latency..." : "Test AI Latency"}</span>
        </button>
      </div>

      {/* Latency Test Result */}
      {testResult && (
        <div
          className={`test-result-banner ${testResult.ok ? "banner-success" : "banner-error"}`}
        >
          {testResult.ok ? (
            <>
              <CheckCircle size={18} className="text-success" />
              <div>
                <strong>Gemini Latency Test Passed ({testResult.latency}ms)</strong>
                <p>AI response verified: "{testResult.answer.slice(0, 100)}"</p>
              </div>
            </>
          ) : (
            <>
              <AlertTriangle size={18} className="text-danger" />
              <div>
                <strong>AI Connectivity Warning</strong>
                <p>{testResult.error}</p>
              </div>
            </>
          )}
        </div>
      )}

      {/* Configuration Cards */}
      <div className="settings-grid">
        {/* Model Card */}
        <div className="settings-card">
          <div className="settings-card-header">
            <div className="settings-card-icon-wrap icon-purple">
              <Cpu size={20} />
            </div>
            <div>
              <h3>AI Engine & Models</h3>
              <p>Active LLM architecture configuration</p>
            </div>
          </div>
          <div className="settings-card-body">
            <div className="info-kv-row">
              <span className="kv-label">Primary LLM:</span>
              <span className="kv-value">
                <code>gemini-flash-lite-latest</code> (Google Gemini)
              </span>
            </div>
            <div className="info-kv-row">
              <span className="kv-label">Fallback Model:</span>
              <span className="kv-value">
                <code>gemini-flash-latest</code>
              </span>
            </div>
            <div className="info-kv-row">
              <span className="kv-label">Typical Latency:</span>
              <span className="kv-value text-success font-medium">1.5s – 1.9s (Sub-2s)</span>
            </div>
            <div className="info-kv-row">
              <span className="kv-label">API Location:</span>
              <span className="kv-value">Server-side proxy (:3000)</span>
            </div>
          </div>
        </div>

        {/* Security & Injection Card */}
        <div className="settings-card">
          <div className="settings-card-header">
            <div className="settings-card-icon-wrap icon-green">
              <ShieldCheck size={20} />
            </div>
            <div>
              <h3>Security & Guardrails</h3>
              <p>Strict privacy and prompt injection boundaries</p>
            </div>
          </div>
          <div className="settings-card-body">
            <div className="info-kv-row">
              <span className="kv-label">Access Mode:</span>
              <span className="kv-value text-success font-medium">
                Read-Only (Analysis only)
              </span>
            </div>
            <div className="info-kv-row">
              <span className="kv-label">Injection Guard:</span>
              <span className="kv-value">Raw messages treated as untrusted text</span>
            </div>
            <div className="info-kv-row">
              <span className="kv-label">Key Exposure:</span>
              <span className="kv-value">Zero browser exposure (Env/Server only)</span>
            </div>
            <div className="info-kv-row">
              <span className="kv-label">Send Permissions:</span>
              <span className="kv-value">Disabled (AI cannot send messages)</span>
            </div>
          </div>
        </div>

        {/* Session Memory Card */}
        <div className="settings-card">
          <div className="settings-card-header">
            <div className="settings-card-icon-wrap icon-blue">
              <Trash2 size={20} />
            </div>
            <div>
              <h3>Session Memory</h3>
              <p>Multi-turn conversation history</p>
            </div>
          </div>
          <div className="settings-card-body">
            <p className="card-note">
              The AI copilot retains the last 12 turns of your active conversation session to allow natural follow-up questions.
            </p>
            <div className="pt-3">
              <button
                type="button"
                className="btn-danger-outline"
                onClick={handleClearHistory}
                disabled={clearing}
              >
                <Trash2 size={15} className={clearing ? "spin-icon" : ""} />
                <span>{clearing ? "Clearing..." : "Reset Copilot Session Memory"}</span>
              </button>
              {clearSuccess && (
                <span className="inline-success-msg">
                  <CheckCircle size={14} /> Session cleared!
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Context Awareness Guide */}
        <div className="settings-card">
          <div className="settings-card-header">
            <div className="settings-card-icon-wrap icon-orange">
              <Sparkles size={20} />
            </div>
            <div>
              <h3>Context Awareness Guide</h3>
              <p>How the copilot adapts across pages</p>
            </div>
          </div>
          <div className="settings-card-body">
            <ul className="context-guide-list">
              <li>
                <strong>Contacts page:</strong> Answers questions about the selected contact's chat history.
              </li>
              <li>
                <strong>Chats page:</strong> Summarizes the opened conversation thread or group.
              </li>
              <li>
                <strong>Messages page:</strong> Searches and synthesizes current message search filters.
              </li>
              <li>
                <strong>Analytics page:</strong> Explains messaging volume, response rate, and velocity.
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}

export default AISettings;
