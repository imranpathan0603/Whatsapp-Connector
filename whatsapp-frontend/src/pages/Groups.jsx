import React, { useState, useEffect, useCallback, useRef, useMemo } from "react";
import {
  Search,
  RefreshCw,
  FolderKanban,
  Users,
  Shield,
  MessageSquare,
  X,
  CheckCircle2,
  ArrowDown,
  ArrowUp,
  CheckCheck,
} from "lucide-react";
import DataTable from "../components/DataTable.jsx";
import Loading from "../components/Loading.jsx";
import ErrorMessage from "../components/ErrorMessage.jsx";
import groupsApi from "../api/groupsApi.js";
import { formatPhoneNumber, formatMessagePreview, renderFormattedText } from "../utils/formatters.js";

export function Groups() {
  const [groups, setGroups] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [syncNotice, setSyncNotice] = useState("");
  const [error, setError] = useState("");

  const [query, setQuery] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [limit, setLimit] = useState(25);
  const [offset, setOffset] = useState(0);

  // Group Detail Modal
  const [selectedGroup, setSelectedGroup] = useState(null);
  const [participants, setParticipants] = useState([]);
  const [groupMessages, setGroupMessages] = useState([]);
  const [detailLoading, setDetailLoading] = useState(false);
  const [groupTab, setGroupTab] = useState("participants"); // participants | messages
  const [flowOrder, setFlowOrder] = useState("standard"); // "standard" (oldest top, down to newest) | "reverse" (newest on top)

  const groupEndRef = useRef(null);

  // Compute sorted messages according to user's selected flow order
  const sortedMessages = useMemo(() => {
    if (!Array.isArray(groupMessages)) return [];
    const list = groupMessages.filter((m) => m.text || m.kind);
    return list.slice().sort((a, b) =>
      flowOrder === "standard" ? a.timestamp - b.timestamp : b.timestamp - a.timestamp
    );
  }, [groupMessages, flowOrder]);

  // Auto scroll to bottom in standard WhatsApp flow
  useEffect(() => {
    if (groupTab === "messages" && flowOrder === "standard" && groupEndRef.current) {
      groupEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [selectedGroup, groupTab, flowOrder, groupMessages]);

  const fetchGroups = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const params = { limit, offset };
      if (query.trim()) params.q = query.trim();

      const res = await groupsApi.getGroups(params);
      setGroups(Array.isArray(res.data) ? res.data : []);
      setTotal(res.total || 0);
    } catch (err) {
      setError(err.message || "Failed to load groups");
      setGroups([]);
    } finally {
      setLoading(false);
    }
  }, [limit, offset, query]);

  useEffect(() => {
    fetchGroups();
  }, [fetchGroups]);

  useEffect(() => {
    const handleAccountChange = () => {
      setOffset(0);
      setSelectedGroup(null);
      fetchGroups();
    };
    window.addEventListener("whatsapp:data_cleared", handleAccountChange);
    window.addEventListener("whatsapp:login_changed", handleAccountChange);
    return () => {
      window.removeEventListener("whatsapp:data_cleared", handleAccountChange);
      window.removeEventListener("whatsapp:login_changed", handleAccountChange);
    };
  }, [fetchGroups]);

  const handleSyncGroups = async () => {
    setSyncing(true);
    setSyncNotice("");
    setError("");
    try {
      const res = await groupsApi.syncGroups();
      setSyncNotice(`Successfully synchronized ${res.synced ?? 0} participating WhatsApp groups.`);
      await fetchGroups();
    } catch (err) {
      setError(err.message || "Failed to synchronize groups");
    } finally {
      setSyncing(false);
    }
  };

  const handleOpenGroup = async (group) => {
    setSelectedGroup(group);
    setGroupTab("participants");
    setDetailLoading(true);
    try {
      const [partsRes, msgsRes] = await Promise.all([
        groupsApi.getGroupParticipants(group.id).catch(() => ({ data: [] })),
        groupsApi.getGroupMessages(group.id, { limit: 50, order: "desc" }).catch(() => ({ data: [] })),
      ]);
      setParticipants(Array.isArray(partsRes?.data) ? partsRes.data : []);
      setGroupMessages(Array.isArray(msgsRes?.data) ? msgsRes.data : []);
    } catch (err) {
      console.warn("Failed to load group details", err);
    } finally {
      setDetailLoading(false);
    }
  };

  const columns = [
    {
      key: "subject",
      label: "Group Subject",
      render: (g) => (
        <div className="table-cell-group-title">
          <strong className="group-subject">{g.subject || "WhatsApp Group"}</strong>
          <span className="chat-type-tag tag-group">Group</span>
        </div>
      ),
    },
    {
      key: "desc",
      label: "Description",
      render: (g) => (
        <p className="table-desc-snippet">{g.desc || <em className="text-muted">No description</em>}</p>
      ),
    },
    {
      key: "participantCount",
      label: "Participants",
      width: "130px",
      render: (g) => (
        <span className="count-pill">
          <Users size={13} /> {g.participantCount !== null && g.participantCount !== undefined ? g.participantCount : "—"}
        </span>
      ),
    },
    {
      key: "messageCount",
      label: "Messages",
      width: "120px",
      render: (g) => (
        <strong className="count-pill">{(g.messageCount || 0).toLocaleString()}</strong>
      ),
    },
  ];

  return (
    <div className="groups-page-wrapper">
      {syncNotice && (
        <div className="success-banner-card">
          <CheckCircle2 size={18} />
          <span>{syncNotice}</span>
          <button className="banner-dismiss" onClick={() => setSyncNotice("")}>×</button>
        </div>
      )}

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
            placeholder="Search groups by subject or ID..."
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

          <button
            className="primary-button-sm"
            onClick={handleSyncGroups}
            disabled={syncing || loading}
            title="Fetch full participating group metadata from WhatsApp"
          >
            <RefreshCw size={14} className={syncing ? "spin-icon" : ""} />
            {syncing ? "Syncing..." : "Sync Groups"}
          </button>

          <button className="secondary-button-sm" onClick={fetchGroups} disabled={loading}>
            <RefreshCw size={14} className={loading ? "spin-icon" : ""} /> Refresh
          </button>
        </div>
      </div>

      {error && <ErrorMessage message={error} onRetry={fetchGroups} />}

      <div className="panel-card-table">
        <DataTable
          columns={columns}
          data={groups}
          loading={loading}
          total={total}
          limit={limit}
          offset={offset}
          onPageChange={setOffset}
          onRowClick={handleOpenGroup}
          emptyMessage="No WhatsApp groups found"
          emptyDescription="Click 'Sync Groups' to fetch groups from WhatsApp or connect your account."
        />
      </div>

      {/* Group Detail Modal */}
      {selectedGroup && (
        <div className="modal-backdrop" onClick={() => setSelectedGroup(null)}>
          <div
            className="modal-card group-detail-modal"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
          >
            <div className="modal-header">
              <div className="modal-title-row">
                <FolderKanban size={20} className="modal-title-icon" />
                <div>
                  <h3>{selectedGroup.subject || "WhatsApp Group"}</h3>
                  <span className="chat-type-tag tag-group">WhatsApp Group</span>
                </div>
              </div>
              <button
                className="icon-button modal-close-btn"
                onClick={() => setSelectedGroup(null)}
              >
                <X size={18} />
              </button>
            </div>

            <div className="modal-tabs-bar">
              <button
                className={`tab-btn ${groupTab === "participants" ? "tab-active" : ""}`}
                onClick={() => setGroupTab("participants")}
              >
                <Users size={14} /> Participants ({participants.length})
              </button>
              <button
                className={`tab-btn ${groupTab === "messages" ? "tab-active" : ""}`}
                onClick={() => setGroupTab("messages")}
              >
                <MessageSquare size={14} /> Messages ({groupMessages.length})
              </button>
            </div>

            <div className="modal-body scrollable-modal-body">
              {detailLoading ? (
                <Loading message="Loading group data..." />
              ) : (
                <>
                  {selectedGroup.desc && (
                    <div className="group-description-banner">
                      <strong>Group Description:</strong>
                      <p>{selectedGroup.desc}</p>
                    </div>
                  )}

                  {groupTab === "participants" && (
                    <div className="group-participants-container">
                      {participants.length === 0 ? (
                        <p className="text-muted">
                          No participant metadata available. Try clicking 'Sync Groups' on the groups page.
                        </p>
                      ) : (
                        <div className="participants-grid">
                          {participants.map((p) => (
                            <div key={p.id} className="participant-card-item">
                              <div className="participant-info">
                                <strong className="participant-name">{p.name || formatPhoneNumber(p.id) || "Participant"}</strong>
                                <small className="mono-subtext">{formatPhoneNumber(p.id)}</small>
                              </div>
                              {p.admin && (
                                <span className={`admin-badge badge-${p.admin}`}>
                                  <Shield size={11} /> {p.admin === "superadmin" ? "Super Admin" : "Admin"}
                                </span>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {groupTab === "messages" && (
                    <div className="group-messages-container">
                      <div className="stream-order-bar">
                        <span className="stream-msg-count">{sortedMessages.length} group messages</span>
                        <div className="order-pill-toggle">
                          <button
                            type="button"
                            className={`order-toggle-btn ${flowOrder === "standard" ? "active" : ""}`}
                            onClick={() => setFlowOrder("standard")}
                            title="Standard WhatsApp flow: older messages top, flowing down to recent messages at bottom"
                          >
                            <ArrowDown size={13} />
                            <span>Standard Flow (Oldest → Newest)</span>
                          </button>
                          <button
                            type="button"
                            className={`order-toggle-btn ${flowOrder === "reverse" ? "active" : ""}`}
                            onClick={() => setFlowOrder("reverse")}
                            title="Reverse order: newest on top"
                          >
                            <ArrowUp size={13} />
                            <span>Newest on Top</span>
                          </button>
                        </div>
                      </div>

                      {sortedMessages.length === 0 ? (
                        <p className="text-muted text-center py-4">No messages recorded in this group.</p>
                      ) : (
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
                          <div ref={groupEndRef} />
                        </div>
                      )}
                    </div>
                  )}
                </>
              )}
            </div>

            <div className="modal-footer">
              <button className="secondary-button" onClick={() => setSelectedGroup(null)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Groups;
