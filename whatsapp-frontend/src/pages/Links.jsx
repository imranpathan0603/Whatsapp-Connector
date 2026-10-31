import React, { useState, useEffect, useCallback } from "react";
import {
  Link2,
  ExternalLink,
  Search,
  RefreshCw,
  Globe,
} from "lucide-react";
import DataTable from "../components/DataTable.jsx";
import Loading from "../components/Loading.jsx";
import ErrorMessage from "../components/ErrorMessage.jsx";
import searchApi from "../api/searchApi.js";

export function Links() {
  const [links, setLinks] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [query, setQuery] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [limit, setLimit] = useState(25);
  const [offset, setOffset] = useState(0);

  const fetchLinks = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const params = { limit, offset };
      if (query.trim()) params.q = query.trim();

      const res = await searchApi.getLinks(params);
      setLinks(Array.isArray(res.data) ? res.data : []);
      setTotal(res.total || 0);
    } catch (err) {
      setError(err.message || "Failed to load links");
      setLinks([]);
    } finally {
      setLoading(false);
    }
  }, [limit, offset, query]);

  useEffect(() => {
    fetchLinks();
  }, [fetchLinks]);

  const columns = [
    {
      key: "url",
      label: "Extracted URL",
      render: (item) => (
        <div className="table-cell-link">
          <Globe size={15} className="link-url-icon" />
          <a
            href={item.url}
            target="_blank"
            rel="noopener noreferrer"
            className="link-clickable"
            title="Open link in new browser tab"
          >
            <span className="link-url-text">{item.url}</span>
            <ExternalLink size={13} className="external-icon" />
          </a>
        </div>
      ),
    },
    {
      key: "chatName",
      label: "Chat",
      width: "200px",
      render: (item) => <span>{item.chatName || "Chat"}</span>,
    },
    {
      key: "senderName",
      label: "Shared By",
      width: "180px",
      render: (item) => <strong>{item.senderName || "Unknown"}</strong>,
    },
    {
      key: "time",
      label: "Shared At",
      width: "160px",
      render: (item) => (
        <span className="table-timestamp">
          {item.time ? new Date(item.time).toLocaleString() : "—"}
        </span>
      ),
    },
  ];

  return (
    <div className="links-page-wrapper">
      <div className="filter-toolbar-card">
        <form
          className="toolbar-search-form"
          onSubmit={(e) => {
            e.preventDefault();
            setOffset(0);
            setQuery(searchInput);
          }}
        >
          <Search size={17} className="search-icon" />
          <input
            type="text"
            placeholder="Search links by URL or keyword..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
          />
          <button type="submit" className="primary-button-sm">
            Search
          </button>
        </form>

        <div className="filter-selectors-row">
          <button
            className="secondary-button-sm"
            onClick={() => {
              setQuery("");
              setSearchInput("");
              setOffset(0);
            }}
          >
            Reset
          </button>
          <button className="secondary-button-sm" onClick={fetchLinks} disabled={loading}>
            <RefreshCw size={14} className={loading ? "spin-icon" : ""} /> Refresh
          </button>
        </div>
      </div>

      {error && <ErrorMessage message={error} onRetry={fetchLinks} />}

      <div className="panel-card-table">
        <DataTable
          columns={columns}
          data={links}
          loading={loading}
          total={total}
          limit={limit}
          offset={offset}
          onPageChange={setOffset}
          emptyMessage="No links found"
          emptyDescription="Web links and URLs detected in messages will appear here."
        />
      </div>
    </div>
  );
}

export default Links;
