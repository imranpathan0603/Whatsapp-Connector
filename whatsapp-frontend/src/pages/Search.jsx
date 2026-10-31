import React, { useState } from "react";
import {
  Search as SearchIcon,
  MessageSquare,
  MessagesSquare,
  Users,
  FolderKanban,
  FileText,
  X,
  ExternalLink,
  ChevronRight,
  Sparkles,
} from "lucide-react";
import Loading from "../components/Loading.jsx";
import ErrorMessage from "../components/ErrorMessage.jsx";
import searchApi from "../api/searchApi.js";

export function SearchPage() {
  const [query, setQuery] = useState("");
  const [scope, setScope] = useState("all");
  const [results, setResults] = useState([]);
  const [searched, setSearched] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Inspect modal
  const [inspectedDoc, setInspectedDoc] = useState(null);
  const [inspectLoading, setInspectLoading] = useState(false);

  const handleSearch = async (e) => {
    if (e) e.preventDefault();
    if (!query.trim()) return;

    setLoading(true);
    setError("");
    setSearched(true);
    try {
      const res = await searchApi.searchAll(query.trim(), scope, 50);
      setResults(Array.isArray(res.results) ? res.results : []);
    } catch (err) {
      setError(err.message || "Failed to execute search");
      setResults([]);
    } finally {
      setLoading(false);
    }
  };

  const handleInspect = async (item) => {
    setInspectLoading(true);
    setInspectedDoc({ id: item.id, title: item.title });
    try {
      const doc = await searchApi.fetchConnectorItem(item.id);
      setInspectedDoc(doc || item);
    } catch (err) {
      console.warn("Fetch item error:", err);
    } finally {
      setInspectLoading(false);
    }
  };

  const getTypeIcon = (type) => {
    switch (type) {
      case "message":
        return <MessageSquare size={16} className="search-res-icon color-msg" />;
      case "chat":
        return <MessagesSquare size={16} className="search-res-icon color-chat" />;
      case "contact":
        return <Users size={16} className="search-res-icon color-contact" />;
      case "group":
        return <FolderKanban size={16} className="search-res-icon color-group" />;
      default:
        return <FileText size={16} className="search-res-icon" />;
    }
  };

  return (
    <div className="search-page-wrapper">
      <div className="search-hero-card">
        <div className="search-hero-text">
          <h2>Unified WhatsApp Search</h2>
          <p>Search across messages, chat threads, contacts, and participating groups.</p>
        </div>

        <form className="search-large-form" onSubmit={handleSearch}>
          <SearchIcon size={20} className="large-search-icon" />
          <input
            type="text"
            placeholder="Type any word, phone number, name, or phrase..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            autoFocus
          />
          <button type="submit" className="primary-button-accent" disabled={loading || !query.trim()}>
            {loading ? "Searching..." : "Search"}
          </button>
        </form>

        <div className="search-scopes-row">
          <span className="scope-label">Scope:</span>
          {["all", "messages", "chats", "contacts", "groups"].map((s) => (
            <button
              key={s}
              type="button"
              className={`scope-pill-btn ${scope === s ? "active" : ""}`}
              onClick={() => {
                setScope(s);
              }}
            >
              {s.charAt(0).toUpperCase() + s.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {error && <ErrorMessage message={error} onRetry={handleSearch} />}

      {loading && <Loading message="Searching through archives..." />}

      {!loading && searched && (
        <div className="search-results-section">
          <div className="results-header-bar">
            <h3>Search Results</h3>
            <span className="results-badge">{results.length} matches found</span>
          </div>

          {results.length === 0 ? (
            <div className="empty-state-card">
              <SearchIcon size={36} className="text-muted" />
              <h4>No matches found for "{query}"</h4>
              <p>Try searching for different keywords or expand your scope to "All".</p>
            </div>
          ) : (
            <div className="search-cards-grid">
              {results.map((res) => (
                <div
                  key={res.id}
                  className="search-result-card"
                  onClick={() => handleInspect(res)}
                >
                  <div className="search-result-header">
                    <div className="search-result-type-row">
                      {getTypeIcon(res.type)}
                      <span className={`result-type-tag tag-${res.type}`}>{res.type}</span>
                    </div>
                  </div>

                  <h4 className="result-title">{res.title}</h4>
                  <p className="result-snippet">
                    {res.text && res.text !== "[protocolMessage]" ? res.text : (res.type === "message" ? "Media message" : "")}
                  </p>

                  <div className="result-card-action">
                    <span>Inspect details</span>
                    <ChevronRight size={14} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Inspect Item Modal */}
      {inspectedDoc && (
        <div className="modal-backdrop" onClick={() => setInspectedDoc(null)}>
          <div
            className="modal-card inspect-doc-modal"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
          >
            <div className="modal-header">
              <div className="modal-title-row">
                <FileText size={20} className="modal-title-icon" />
                <div>
                  <h3>{inspectedDoc.title || "Document"}</h3>
                  <span className={`result-type-tag tag-${inspectedDoc.type}`}>{inspectedDoc.type}</span>
                </div>
              </div>
              <button
                className="icon-button modal-close-btn"
                onClick={() => setInspectedDoc(null)}
              >
                <X size={18} />
              </button>
            </div>

            <div className="modal-body scrollable-modal-body">
              {inspectLoading ? (
                <Loading message="Fetching complete document..." />
              ) : (
                <div className="inspect-content-box">
                  <h4>Content / Transcript</h4>
                  <pre className="plain-transcript-pre">{inspectedDoc.text || "[No content text]"}</pre>

                  {inspectedDoc.metadata && (
                    <div className="metadata-json-box">
                      <h4>Metadata Attributes</h4>
                      <pre className="json-pre">{JSON.stringify(inspectedDoc.metadata, null, 2)}</pre>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="modal-footer">
              <button className="secondary-button" onClick={() => setInspectedDoc(null)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default SearchPage;
