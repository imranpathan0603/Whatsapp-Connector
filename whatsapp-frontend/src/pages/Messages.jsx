import React, { useState, useEffect, useCallback } from "react";
import {
  Search,
  RefreshCw,
  Filter,
  ArrowUpRight,
  ArrowDownLeft,
  Calendar,
  FileText,
  MessageSquare,
  X,
  ExternalLink,
  ChevronDown,
  Download,
} from "lucide-react";
import DataTable from "../components/DataTable.jsx";
import Loading from "../components/Loading.jsx";
import ErrorMessage from "../components/ErrorMessage.jsx";
import messagesApi from "../api/messagesApi.js";
import { formatMessagePreview, formatPhoneNumber, renderFormattedText } from "../utils/formatters.js";

export function Messages() {
  const [messages, setMessages] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Query state
  const [query, setQuery] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [fromMe, setFromMe] = useState("");
  const [isGroup, setIsGroup] = useState("");
  const [type, setType] = useState("");
  const [order, setOrder] = useState("desc");
  const [limit, setLimit] = useState(25);
  const [offset, setOffset] = useState(0);

  // Modal inspection state
  const [selectedMessage, setSelectedMessage] = useState(null);
  const [contextData, setContextData] = useState(null);
  const [repliesData, setRepliesData] = useState([]);
  const [modalLoading, setModalLoading] = useState(false);

  const fetchMessages = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const params = {
        limit,
        offset,
        order,
      };
      if (query.trim()) params.q = query.trim();
      if (fromMe !== "") params.fromMe = fromMe;
      if (isGroup !== "") params.isGroup = isGroup;
      if (type) params.kind = type;

      const res = await messagesApi.getMessages(params);
      setMessages(Array.isArray(res.data) ? res.data : []);
      setTotal(res.total || 0);
    } catch (err) {
      setError(err.message || "Failed to load messages");
      setMessages([]);
    } finally {
      setLoading(false);
    }
  }, [limit, offset, order, query, fromMe, isGroup, type]);

  useEffect(() => {
    fetchMessages();
  }, [fetchMessages]);

  useEffect(() => {
    const handleAccountChange = () => {
      setOffset(0);
      fetchMessages();
    };
    window.addEventListener("whatsapp:data_cleared", handleAccountChange);
    window.addEventListener("whatsapp:login_changed", handleAccountChange);
    return () => {
      window.removeEventListener("whatsapp:data_cleared", handleAccountChange);
      window.removeEventListener("whatsapp:login_changed", handleAccountChange);
    };
  }, [fetchMessages]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    setOffset(0);
    setQuery(searchInput);
  };

  const handleResetFilters = () => {
    setQuery("");
    setSearchInput("");
    setFromMe("");
    setIsGroup("");
    setType("");
    setOrder("desc");
    setOffset(0);
  };

  const handleOpenMessage = async (msg) => {
    setSelectedMessage(msg);
    setModalLoading(true);
    try {
      const [ctx, rep] = await Promise.all([
        messagesApi.getMessageContext(msg.id, { before: 4, after: 4 }).catch(() => null),
        messagesApi.getMessageReplies(msg.id).catch(() => ({ data: [] })),
      ]);
      setContextData(ctx);
      setRepliesData(Array.isArray(rep?.data) ? rep.data : []);
    } catch (err) {
      console.warn("Context fetch error:", err);
    } finally {
      setModalLoading(false);
    }
  };

  const columns = [
    {
      key: "direction",
      label: "Dir",
      width: "50px",
      render: (m) => (
        <span
          className={`direction-badge ${m.fromMe ? "dir-sent" : "dir-received"}`}
          title={m.fromMe ? "Outgoing (from me)" : "Incoming"}
        >
          {m.fromMe ? <ArrowUpRight size={14} /> : <ArrowDownLeft size={14} />}
        </span>
      ),
    },
    {
      key: "sender",
      label: "Sender",
      width: "160px",
      render: (m) => (
        <div className="table-cell-sender">
          <strong>{m.senderName || m.pushName || "Unknown"}</strong>
          {m.sender && !m.sender.includes("@lid") && !m.sender.includes("@newsletter") && (
            <small className="mono-subtext">{formatPhoneNumber(m.sender)}</small>
          )}
        </div>
      ),
    },
    {
      key: "chat",
      label: "Chat",
      width: "180px",
      render: (m) => (
        <div className="table-cell-chat">
          <span className="chat-title">{m.chatName || "Chat"}</span>
          <span className={`chat-type-tag tag-${m.chatType || "individual"}`}>
            {m.chatType || "individual"}
          </span>
        </div>
      ),
    },
    {
      key: "text",
      label: "Message Content",
      render: (m) => {
        const preview = formatMessagePreview(m);
        const isPlain = Boolean(m.text && m.text.trim() && m.text !== "[protocolMessage]");
        return (
          <div className="table-cell-content">
            <p className="table-message-snippet">
              {isPlain ? (
                m.text
              ) : (
                <span className="media-placeholder-pill">{preview}</span>
              )}
            </p>
          </div>
        );
      },
    },
    {
      key: "type",
      label: "Type",
      width: "110px",
      render: (m) => (
        <span className="type-badge-pill">
          {m.kind || (m.messageType === "protocolMessage" ? "Update" : m.messageType?.replace("Message", "")) || "text"}
        </span>
      ),
    },
    {
      key: "time",
      label: "Time",
      width: "150px",
      render: (m) => (
        <span className="table-timestamp">
          {m.time ? new Date(m.time).toLocaleString() : "—"}
        </span>
      ),
    },
  ];

  return (
    <div className="messages-page-wrapper">
      {/* Search & Filter Toolbar */}
      <div className="filter-toolbar-card">
        <form className="toolbar-search-form" onSubmit={handleSearchSubmit}>
          <Search size={17} className="search-icon" />
          <input
            type="text"
            placeholder="Search message text across all chats..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
          />
          <button type="submit" className="primary-button-sm">
            Search
          </button>
        </form>

        <div className="filter-selectors-row">
          <div className="filter-item">
            <label>Direction:</label>
            <select
              value={fromMe}
              onChange={(e) => {
                setOffset(0);
                setFromMe(e.target.value);
              }}
            >
              <option value="">All (Sent & Received)</option>
              <option value="true">Sent by Me</option>
              <option value="false">Received</option>
            </select>
          </div>

          <div className="filter-item">
            <label>Chat Scope:</label>
            <select
              value={isGroup}
              onChange={(e) => {
                setOffset(0);
                setIsGroup(e.target.value);
              }}
            >
              <option value="">All Chats</option>
              <option value="true">Groups Only</option>
              <option value="false">Individual Only</option>
            </select>
          </div>

          <div className="filter-item">
            <label>Media Kind:</label>
            <select
              value={type}
              onChange={(e) => {
                setOffset(0);
                setType(e.target.value);
              }}
            >
              <option value="">All Types</option>
              <option value="image">Images</option>
              <option value="video">Videos</option>
              <option value="audio">Audio</option>
              <option value="document">Documents</option>
              <option value="sticker">Stickers</option>
            </select>
          </div>

          <div className="filter-item">
            <label>Sort:</label>
            <select
              value={order}
              onChange={(e) => {
                setOffset(0);
                setOrder(e.target.value);
              }}
            >
              <option value="desc">Newest First</option>
              <option value="asc">Oldest First</option>
            </select>
          </div>

          <button className="secondary-button-sm" onClick={handleResetFilters}>
            Reset Filters
          </button>

          <button className="secondary-button-sm" onClick={fetchMessages} disabled={loading}>
            <RefreshCw size={14} className={loading ? "spin-icon" : ""} /> Refresh
          </button>
        </div>
      </div>

      {error && <ErrorMessage message={error} onRetry={fetchMessages} />}

      {/* Main Messages Table */}
      <div className="panel-card-table">
        <DataTable
          columns={columns}
          data={messages}
          loading={loading}
          total={total}
          limit={limit}
          offset={offset}
          onPageChange={setOffset}
          onRowClick={handleOpenMessage}
          emptyMessage="No WhatsApp messages found"
          emptyDescription="Try adjusting your filters or connect your WhatsApp account to synchronize messages."
        />
      </div>

      {/* Message Inspection & Context Modal */}
      {selectedMessage && (
        <div className="modal-backdrop" onClick={() => setSelectedMessage(null)}>
          <div
            className="modal-card message-detail-modal"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
          >
            <div className="modal-header">
              <div className="modal-title-row">
                <FileText size={20} className="modal-title-icon" />
                <h3>Message Details & Context</h3>
              </div>
              <button
                className="icon-button modal-close-btn"
                onClick={() => setSelectedMessage(null)}
              >
                <X size={18} />
              </button>
            </div>

            <div className="modal-body scrollable-modal-body">
              {/* Message metadata box */}
              <div className="message-meta-card">
                <div className="meta-row">
                  <span>Chat</span>
                  <strong>{selectedMessage.chatName || "Direct Chat"}</strong>
                </div>
                <div className="meta-row">
                  <span>Sender</span>
                  <strong>
                    {selectedMessage.senderName || "Sender"} (
                    {selectedMessage.fromMe ? "Outgoing" : "Incoming"})
                  </strong>
                </div>
                <div className="meta-row">
                  <span>Message Type</span>
                  <span className="type-badge-pill">
                    {selectedMessage.kind || (selectedMessage.messageType === "protocolMessage" ? "Update" : selectedMessage.messageType?.replace("Message", "")) || "Text"}
                  </span>
                </div>
                <div className="meta-row">
                  <span>Timestamp</span>
                  <strong>{selectedMessage.time ? new Date(selectedMessage.time).toLocaleString() : "—"}</strong>
                </div>
              </div>

              {/* Message Content Full */}
              <div className="message-content-box">
                <h4>Message Text</h4>
                <div className="message-text-bubble">
                  {selectedMessage.text ? (
                    <div className="bubble-text-rendered">{renderFormattedText(selectedMessage.text)}</div>
                  ) : (
                    <em className="text-muted">{formatMessagePreview(selectedMessage)}</em>
                  )}
                </div>
              </div>

              {/* Surrounding conversation context */}
              <div className="conversation-context-section">
                <h4>Surrounding Conversation Context</h4>
                {modalLoading ? (
                  <Loading message="Loading context..." size={20} />
                ) : contextData ? (
                  <div className="context-transcript-flow">
                    {/* Before */}
                    {contextData.before?.map((m) => (
                      <div key={m.id} className={`context-msg ${m.fromMe ? "context-me" : "context-them"}`}>
                        <span className="context-sender">{m.senderName}:</span>
                        <span className="context-text">{m.text ? renderFormattedText(m.text) : formatMessagePreview(m)}</span>
                        <span className="context-time">
                          {m.time ? new Date(m.time).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : ""}
                        </span>
                      </div>
                    ))}

                    {/* Current highlighted */}
                    <div className={`context-msg context-active ${selectedMessage.fromMe ? "context-me" : "context-them"}`}>
                      <span className="context-sender">{selectedMessage.senderName} (Selected):</span>
                      <span className="context-text">{selectedMessage.text ? renderFormattedText(selectedMessage.text) : formatMessagePreview(selectedMessage)}</span>
                      <span className="context-time">
                        {selectedMessage.time ? new Date(selectedMessage.time).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : ""}
                      </span>
                    </div>

                    {/* After */}
                    {contextData.after?.map((m) => (
                      <div key={m.id} className={`context-msg ${m.fromMe ? "context-me" : "context-them"}`}>
                        <span className="context-sender">{m.senderName}:</span>
                        <span className="context-text">{m.text ? renderFormattedText(m.text) : formatMessagePreview(m)}</span>
                        <span className="context-time">
                          {m.time ? new Date(m.time).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : ""}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-muted">Surrounding conversation context unavailable.</p>
                )}
              </div>

              {/* Replies */}
              {repliesData.length > 0 && (
                <div className="replies-section">
                  <h4>Replies to this Message ({repliesData.length})</h4>
                  <div className="replies-list">
                    {repliesData.map((rep) => (
                      <div key={rep.id} className="reply-card-item">
                        <strong>{rep.senderName}</strong>
                        <p>{formatMessagePreview(rep)}</p>
                        <small>{rep.time ? new Date(rep.time).toLocaleString() : ""}</small>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="modal-footer">
              <button className="secondary-button" onClick={() => setSelectedMessage(null)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Messages;
