import React, { useState, useEffect, useCallback, useRef, useMemo } from "react";
import {
  Search,
  RefreshCw,
  MessagesSquare,
  MessageSquare,
  Users,
  Image,
  Link2,
  FileText,
  X,
  ExternalLink,
  ChevronRight,
  BarChart2,
  ArrowDown,
  ArrowUp,
  CheckCheck,
} from "lucide-react";
import DataTable from "../components/DataTable.jsx";
import Loading from "../components/Loading.jsx";
import ErrorMessage from "../components/ErrorMessage.jsx";
import chatsApi from "../api/chatsApi.js";
import { formatMessagePreview, formatPhoneNumber, renderFormattedText } from "../utils/formatters.js";

export function Chats() {
  const [chats, setChats] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Filters
  const [query, setQuery] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [limit, setLimit] = useState(25);
  const [offset, setOffset] = useState(0);

  // Detail Drawer / Modal state
  const [selectedChat, setSelectedChat] = useState(null);
  const [activeTab, setActiveTab] = useState("messages"); // messages | stats | media | links | transcript
  const [tabLoading, setTabLoading] = useState(false);
  const [tabData, setTabData] = useState(null);
  const [flowOrder, setFlowOrder] = useState("standard"); // "standard" (oldest top, down to newest) | "reverse" (newest on top)

  const chatEndRef = useRef(null);

  // Auto scroll to bottom in standard WhatsApp flow
  useEffect(() => {
    if (activeTab === "messages" && flowOrder === "standard" && chatEndRef.current) {
      chatEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [tabData, activeTab, flowOrder]);

  // Compute sorted messages according to user's selected flow order
  const sortedMessages = useMemo(() => {
    if (!Array.isArray(tabData)) return [];
    const list = tabData.filter((m) => m.text || m.kind);
    return list.slice().sort((a, b) =>
      flowOrder === "standard" ? a.timestamp - b.timestamp : b.timestamp - a.timestamp
    );
  }, [tabData, flowOrder]);

  const fetchChats = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const params = { limit, offset };
      if (query.trim()) params.q = query.trim();
      if (typeFilter) params.type = typeFilter;

      const res = await chatsApi.getChats(params);
      setChats(Array.isArray(res.data) ? res.data : []);
      setTotal(res.total || 0);
    } catch (err) {
      setError(err.message || "Failed to load chats");
      setChats([]);
    } finally {
      setLoading(false);
    }
  }, [limit, offset, query, typeFilter]);

  useEffect(() => {
    fetchChats();
  }, [fetchChats]);

  useEffect(() => {
    const handleAccountChange = () => {
      setOffset(0);
      setSelectedChat(null);
      fetchChats();
    };
    window.addEventListener("whatsapp:data_cleared", handleAccountChange);
    window.addEventListener("whatsapp:login_changed", handleAccountChange);
    return () => {
      window.removeEventListener("whatsapp:data_cleared", handleAccountChange);
      window.removeEventListener("whatsapp:login_changed", handleAccountChange);
    };
  }, [fetchChats]);

  const loadTabData = useCallback(async (chatId, tab) => {
    setTabLoading(true);
    setTabData(null);
    try {
      if (tab === "messages") {
        const res = await chatsApi.getChatMessages(chatId, { limit: 50, order: "desc" });
        setTabData(res.data || []);
      } else if (tab === "stats") {
        const res = await chatsApi.getChatStats(chatId);
        setTabData(res);
      } else if (tab === "media") {
        const res = await chatsApi.getChatMedia(chatId, { limit: 50 });
        setTabData(res.data || []);
      } else if (tab === "links") {
        const res = await chatsApi.getChatLinks(chatId, { limit: 50 });
        setTabData(res.data || []);
      } else if (tab === "transcript") {
        const text = await chatsApi.getChatTranscript(chatId, 300);
        setTabData(text);
      }
    } catch (err) {
      console.warn("Failed to load chat tab data", err);
      setTabData(null);
    } finally {
      setTabLoading(false);
    }
  }, []);

  const handleOpenChat = (chat) => {
    setSelectedChat(chat);
    setActiveTab("messages");
    loadTabData(chat.chatId, "messages");
  };

  const handleTabChange = (tab) => {
    setActiveTab(tab);
    if (selectedChat) {
      loadTabData(selectedChat.chatId, tab);
    }
  };

  const columns = [
    {
      key: "name",
      label: "Chat Name",
      render: (c) => (
        <div className="table-cell-chat-title">
          <strong className="chat-main-name">{c.name || "Conversation"}</strong>
          {c.chatId && !c.chatId.includes("@g.us") && !c.chatId.includes("@newsletter") && !c.chatId.includes("@lid") && (
            <small className="mono-subtext">{formatPhoneNumber(c.chatId)}</small>
          )}
        </div>
      ),
    },
    {
      key: "type",
      label: "Type",
      width: "120px",
      render: (c) => (
        <span className={`chat-type-tag tag-${c.type || "individual"}`}>
          {c.type || "individual"}
        </span>
      ),
    },
    {
      key: "messageCount",
      label: "Messages",
      width: "120px",
      render: (c) => (
        <div className="chat-counts-cell">
          <strong>{(c.messageCount || 0).toLocaleString()}</strong>
          <small className="counts-breakdown">
            {c.sentCount || 0} sent · {c.receivedCount || 0} recv
          </small>
        </div>
      ),
    },
    {
      key: "lastMessage",
      label: "Last Message",
      render: (c) => {
        const preview = formatMessagePreview({ text: c.lastMessage, messageType: c.lastMessageType });
        return (
          <p className="last-message-snippet">
            {c.lastMessage && c.lastMessage !== "[protocolMessage]" ? (
              c.lastMessage
            ) : (
              <span className="text-muted">{preview || "—"}</span>
            )}
          </p>
        );
      },
    },
    {
      key: "lastTime",
      label: "Last Activity",
      width: "160px",
      render: (c) => (
        <span className="table-timestamp">
          {c.lastTime ? new Date(c.lastTime).toLocaleString() : "—"}
        </span>
      ),
    },
  ];

  return (
    <div className="chats-page-wrapper">
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
            placeholder="Search chats by name or WhatsApp ID..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
          />
          <button type="submit" className="primary-button-sm">
            Search
          </button>
        </form>

        <div className="filter-selectors-row">
          <div className="filter-item">
            <label>Chat Type:</label>
            <select
              value={typeFilter}
              onChange={(e) => {
                setOffset(0);
                setTypeFilter(e.target.value);
              }}
            >
              <option value="">All Chat Types</option>
              <option value="group">Group Chats</option>
              <option value="individual">Individual Chats</option>
              <option value="channel">Channels / Newsletters</option>
              <option value="broadcast">Broadcasts</option>
            </select>
          </div>

          <button
            className="secondary-button-sm"
            onClick={() => {
              setQuery("");
              setSearchInput("");
              setTypeFilter("");
              setOffset(0);
            }}
          >
            Reset
          </button>

          <button className="secondary-button-sm" onClick={fetchChats} disabled={loading}>
            <RefreshCw size={14} className={loading ? "spin-icon" : ""} /> Refresh
          </button>
        </div>
      </div>

      {error && <ErrorMessage message={error} onRetry={fetchChats} />}

      <div className="panel-card-table">
        <DataTable
          columns={columns}
          data={chats}
          loading={loading}
          total={total}
          limit={limit}
          offset={offset}
          onPageChange={setOffset}
          onRowClick={handleOpenChat}
          emptyMessage="No WhatsApp chats found"
          emptyDescription="No chats match your current filter."
        />
      </div>

      {/* Chat Details Modal */}
      {selectedChat && (
        <div className="modal-backdrop" onClick={() => setSelectedChat(null)}>
          <div
            className="modal-card chat-detail-modal"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
          >
            <div className="modal-header">
              <div className="modal-title-row">
                <MessagesSquare size={20} className="modal-title-icon" />
                <div>
                  <h3>{selectedChat.name || "Conversation"}</h3>
                  <span className={`chat-type-tag tag-${selectedChat.type || "individual"}`}>
                    {selectedChat.type === "group" ? "WhatsApp Group" : selectedChat.type === "channel" ? "Channel" : "Direct Chat"}
                  </span>
                </div>
              </div>
              <button
                className="icon-button modal-close-btn"
                onClick={() => setSelectedChat(null)}
              >
                <X size={18} />
              </button>
            </div>

            {/* Navigation Tabs */}
            <div className="modal-tabs-bar">
              <button
                className={`tab-btn ${activeTab === "messages" ? "tab-active" : ""}`}
                onClick={() => handleTabChange("messages")}
              >
                <MessageSquare size={14} /> Messages
              </button>
              <button
                className={`tab-btn ${activeTab === "stats" ? "tab-active" : ""}`}
                onClick={() => handleTabChange("stats")}
              >
                <BarChart2 size={14} /> Stats
              </button>
              <button
                className={`tab-btn ${activeTab === "media" ? "tab-active" : ""}`}
                onClick={() => handleTabChange("media")}
              >
                <Image size={14} /> Media
              </button>
              <button
                className={`tab-btn ${activeTab === "links" ? "tab-active" : ""}`}
                onClick={() => handleTabChange("links")}
              >
                <Link2 size={14} /> Links
              </button>
              <button
                className={`tab-btn ${activeTab === "transcript" ? "tab-active" : ""}`}
                onClick={() => handleTabChange("transcript")}
              >
                <FileText size={14} /> Plain Transcript
              </button>
            </div>

            <div className="modal-body scrollable-modal-body">
              {tabLoading ? (
                <Loading message="Loading chat data..." />
              ) : (
                <>
                  {activeTab === "messages" && (
                    <div className="chat-messages-container">
                      <div className="stream-order-bar">
                        <span className="stream-msg-count">{sortedMessages.length} messages</span>
                        <div className="order-pill-toggle">
                          <button
                            type="button"
                            className={`order-toggle-btn ${flowOrder === "standard" ? "active" : ""}`}
                            onClick={() => setFlowOrder("standard")}
                            title="Standard WhatsApp flow: older messages on top, flowing down to recent messages at bottom"
                          >
                            <ArrowDown size={13} />
                            <span>Standard Flow (Oldest → Newest)</span>
                          </button>
                          <button
                            type="button"
                            className={`order-toggle-btn ${flowOrder === "reverse" ? "active" : ""}`}
                            onClick={() => setFlowOrder("reverse")}
                            title="Reverse order: newest messages on top"
                          >
                            <ArrowUp size={13} />
                            <span>Newest on Top</span>
                          </button>
                        </div>
                      </div>

                      {sortedMessages.length > 0 ? (
                        <div className="chat-bubble-stream">
                          {sortedMessages.map((m) => (
                            <div
                              key={m.id}
                              className={`chat-bubble-row ${m.fromMe ? "bubble-row-me" : "bubble-row-them"}`}
                            >
                              <div className={`chat-bubble-card ${m.fromMe ? "bubble-me" : "bubble-them"}`}>
                                {!m.fromMe && <span className="bubble-author">{m.senderName}</span>}
                                <div className="bubble-text">
                                  {renderFormattedText(formatMessagePreview(m))}
                                </div>
                                <div className="bubble-meta-footer">
                                  <span className="bubble-time">
                                    {m.time ? new Date(m.time).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : ""}
                                  </span>
                                  {m.fromMe && <CheckCheck size={14} className="bubble-check-icon" />}
                                </div>
                              </div>
                            </div>
                          ))}
                          <div ref={chatEndRef} />
                        </div>
                      ) : (
                        <p className="text-muted text-center py-4">No messages found in this chat.</p>
                      )}
                    </div>
                  )}

                  {activeTab === "stats" && tabData && (
                    <div className="chat-stats-view">
                      <div className="stats-meta-grid">
                        <div className="meta-box">
                          <span>Total Messages</span>
                          <strong>{tabData.totalMessages || 0}</strong>
                        </div>
                        <div className="meta-box">
                          <span>Sent by Me</span>
                          <strong>{tabData.sent || 0}</strong>
                        </div>
                        <div className="meta-box">
                          <span>Received</span>
                          <strong>{tabData.received || 0}</strong>
                        </div>
                        <div className="meta-box">
                          <span>Oldest Message</span>
                          <strong>{tabData.oldestMessage ? new Date(tabData.oldestMessage).toLocaleDateString() : "—"}</strong>
                        </div>
                        <div className="meta-box">
                          <span>Newest Message</span>
                          <strong>{tabData.newestMessage ? new Date(tabData.newestMessage).toLocaleDateString() : "—"}</strong>
                        </div>
                      </div>

                      {tabData.messageTypes && Object.keys(tabData.messageTypes).length > 0 && (
                        <div className="type-distribution-box">
                          <h4>Message Types Breakdown</h4>
                          <div className="type-chips-list">
                            {Object.entries(tabData.messageTypes).map(([k, v]) => (
                              <div key={k} className="type-chip-item">
                                <span className="chip-label">{k}</span>
                                <strong className="chip-count">{v}</strong>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {activeTab === "media" && (
                    <div className="chat-media-list">
                      {Array.isArray(tabData) && tabData.length > 0 ? (
                        <div className="media-grid">
                          {tabData.map((m) => (
                            <div key={m.id} className="media-card-item">
                              <span className="media-badge">{m.kind || m.messageType}</span>
                              <div className="media-info">
                                <strong>{m.fileName || m.text || "Media file"}</strong>
                                <small>{m.senderName} · {m.time ? new Date(m.time).toLocaleDateString() : ""}</small>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-muted">No media recorded in this chat.</p>
                      )}
                    </div>
                  )}

                  {activeTab === "links" && (
                    <div className="chat-links-list">
                      {Array.isArray(tabData) && tabData.length > 0 ? (
                        <div className="links-stream">
                          {tabData.map((l, idx) => (
                            <div key={idx} className="link-card-row">
                              <Link2 size={16} className="link-icon" />
                              <div className="link-details">
                                <a href={l.url} target="_blank" rel="noopener noreferrer" className="link-url-text">
                                  {l.url} <ExternalLink size={12} />
                                </a>
                                <small>{l.senderName} · {l.time ? new Date(l.time).toLocaleString() : ""}</small>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-muted">No URLs or links detected in this chat.</p>
                      )}
                    </div>
                  )}

                  {activeTab === "transcript" && (
                    <div className="chat-transcript-view">
                      <pre className="plain-transcript-pre">{tabData || "Empty transcript."}</pre>
                    </div>
                  )}
                </>
              )}
            </div>

            <div className="modal-footer">
              <button className="secondary-button" onClick={() => setSelectedChat(null)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Chats;
