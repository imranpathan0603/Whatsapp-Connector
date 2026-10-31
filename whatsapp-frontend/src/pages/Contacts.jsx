import React, { useState, useEffect, useCallback, useRef, useMemo } from "react";
import {
  Search,
  RefreshCw,
  Users,
  Smartphone,
  MessageSquare,
  BarChart2,
  X,
  ExternalLink,
  ArrowDown,
  ArrowUp,
  CheckCheck,
} from "lucide-react";
import DataTable from "../components/DataTable.jsx";
import Loading from "../components/Loading.jsx";
import ErrorMessage from "../components/ErrorMessage.jsx";
import contactsApi from "../api/contactsApi.js";
import { formatPhoneNumber, formatMessagePreview, renderFormattedText } from "../utils/formatters.js";

export function Contacts() {
  const [contacts, setContacts] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [query, setQuery] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [limit, setLimit] = useState(25);
  const [offset, setOffset] = useState(0);

  // Detail Modal
  const [selectedContact, setSelectedContact] = useState(null);
  const [contactMessages, setContactMessages] = useState([]);
  const [contactStats, setContactStats] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [flowOrder, setFlowOrder] = useState("standard"); // "standard" (oldest top, down to newest) | "reverse" (newest on top)

  const contactEndRef = useRef(null);

  // Compute sorted messages according to flow order
  const sortedMessages = useMemo(() => {
    if (!Array.isArray(contactMessages)) return [];
    const list = contactMessages.filter((m) => m.text || m.kind);
    return list.slice().sort((a, b) =>
      flowOrder === "standard" ? a.timestamp - b.timestamp : b.timestamp - a.timestamp
    );
  }, [contactMessages, flowOrder]);

  // Auto scroll to bottom in standard flow
  useEffect(() => {
    if (selectedContact && flowOrder === "standard" && contactEndRef.current) {
      contactEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [selectedContact, flowOrder, contactMessages]);

  const fetchContacts = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const params = { limit, offset };
      if (query.trim()) params.q = query.trim();

      const res = await contactsApi.getContacts(params);
      setContacts(Array.isArray(res.data) ? res.data : []);
      setTotal(res.total || 0);
    } catch (err) {
      setError(err.message || "Failed to load contacts");
      setContacts([]);
    } finally {
      setLoading(false);
    }
  }, [limit, offset, query]);

  useEffect(() => {
    fetchContacts();
  }, [fetchContacts]);

  useEffect(() => {
    const handleAccountChange = () => {
      setOffset(0);
      setSelectedContact(null);
      fetchContacts();
    };
    window.addEventListener("whatsapp:data_cleared", handleAccountChange);
    window.addEventListener("whatsapp:login_changed", handleAccountChange);
    return () => {
      window.removeEventListener("whatsapp:data_cleared", handleAccountChange);
      window.removeEventListener("whatsapp:login_changed", handleAccountChange);
    };
  }, [fetchContacts]);

  const handleOpenContact = async (contact) => {
    setSelectedContact(contact);
    setDetailLoading(true);
    try {
      const [statsRes, msgsRes] = await Promise.all([
        contactsApi.getContactStats(contact.id).catch(() => null),
        contactsApi.getContactMessages(contact.id, { limit: 50, order: "desc" }).catch(() => ({ data: [] })),
      ]);
      setContactStats(statsRes);
      setContactMessages(Array.isArray(msgsRes?.data) ? msgsRes.data : []);
    } catch (err) {
      console.warn("Failed to load contact details", err);
    } finally {
      setDetailLoading(false);
    }
  };

  const columns = [
    {
      key: "name",
      label: "Contact Name",
      render: (c) => (
        <div className="table-cell-contact-name">
          <strong className="contact-main-name">{c.name || c.notify || c.verifiedName || "Unknown"}</strong>
          {c.verifiedName && <span className="verified-badge">Verified</span>}
        </div>
      ),
    },
    {
      key: "id",
      label: "Phone / Contact",
      render: (c) => (
        <span className="mono-subtext">{formatPhoneNumber(c.id) || "Direct Contact"}</span>
      ),
    },
    {
      key: "notify",
      label: "Notify Name",
      render: (c) => <span>{c.notify || "—"}</span>,
    },
    {
      key: "verifiedName",
      label: "Verified Name",
      render: (c) => <span>{c.verifiedName || "—"}</span>,
    },
    {
      key: "messageCount",
      label: "Messages",
      width: "120px",
      render: (c) => (
        <strong className="count-pill">{(c.messageCount || 0).toLocaleString()}</strong>
      ),
    },
  ];

  return (
    <div className="contacts-page-wrapper">
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
            placeholder="Search contacts by name, notify name, or number..."
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
          <button className="secondary-button-sm" onClick={fetchContacts} disabled={loading}>
            <RefreshCw size={14} className={loading ? "spin-icon" : ""} /> Refresh
          </button>
        </div>
      </div>

      {error && <ErrorMessage message={error} onRetry={fetchContacts} />}

      <div className="panel-card-table">
        <DataTable
          columns={columns}
          data={contacts}
          loading={loading}
          total={total}
          limit={limit}
          offset={offset}
          onPageChange={setOffset}
          onRowClick={handleOpenContact}
          emptyMessage="No WhatsApp contacts found"
          emptyDescription="Contacts will appear here as synchronized from WhatsApp."
        />
      </div>

      {/* Contact Details Modal */}
      {selectedContact && (
        <div className="modal-backdrop" onClick={() => setSelectedContact(null)}>
          <div
            className="modal-card contact-detail-modal"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
          >
            <div className="modal-header">
              <div className="modal-title-row">
                <Users size={20} className="modal-title-icon" />
                <div>
                  <h3>{selectedContact.name || selectedContact.notify || formatPhoneNumber(selectedContact.id) || "Contact"}</h3>
                  <small className="mono-subtext">{formatPhoneNumber(selectedContact.id)}</small>
                </div>
              </div>
              <button
                className="icon-button modal-close-btn"
                onClick={() => setSelectedContact(null)}
              >
                <X size={18} />
              </button>
            </div>

            <div className="modal-body scrollable-modal-body">
              {detailLoading ? (
                <Loading message="Loading contact data..." />
              ) : (
                <>
                  <div className="contact-info-cards-row">
                    <div className="contact-info-box">
                      <span>Display Name</span>
                      <strong>{selectedContact.name || "—"}</strong>
                    </div>
                    <div className="contact-info-box">
                      <span>Notify Name</span>
                      <strong>{selectedContact.notify || "—"}</strong>
                    </div>
                    <div className="contact-info-box">
                      <span>Verified Name</span>
                      <strong>{selectedContact.verifiedName || "—"}</strong>
                    </div>
                    <div className="contact-info-box">
                      <span>Archive Messages</span>
                      <strong>{contactStats?.totalMessages || contactMessages.length}</strong>
                    </div>
                  </div>

                  {contactStats && (
                    <div className="contact-stats-summary">
                      <h4>1-on-1 Message History Stats</h4>
                      <div className="stats-meta-grid">
                        <div className="meta-box">
                          <span>Sent to Contact</span>
                          <strong>{contactStats.sent || 0}</strong>
                        </div>
                        <div className="meta-box">
                          <span>Received from Contact</span>
                          <strong>{contactStats.received || 0}</strong>
                        </div>
                        <div className="meta-box">
                          <span>First Message</span>
                          <strong>
                            {contactStats.oldestMessage ? new Date(contactStats.oldestMessage).toLocaleDateString() : "—"}
                          </strong>
                        </div>
                        <div className="meta-box">
                          <span>Latest Message</span>
                          <strong>
                            {contactStats.newestMessage ? new Date(contactStats.newestMessage).toLocaleDateString() : "—"}
                          </strong>
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="contact-messages-stream">
                    <div className="stream-order-bar">
                      <span className="stream-msg-count">{sortedMessages.length} direct messages</span>
                      <div className="order-pill-toggle">
                        <button
                          type="button"
                          className={`order-toggle-btn ${flowOrder === "standard" ? "active" : ""}`}
                          onClick={() => setFlowOrder("standard")}
                          title="Standard WhatsApp flow: older messages top, flowing down to recent messages"
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
                      <p className="text-muted text-center py-4">No individual chat messages recorded with this contact.</p>
                    ) : (
                      <div className="chat-bubble-stream">
                        {sortedMessages.map((m) => (
                          <div
                            key={m.id}
                            className={`chat-bubble-row ${m.fromMe ? "bubble-row-me" : "bubble-row-them"}`}
                          >
                            <div className={`chat-bubble-card ${m.fromMe ? "bubble-me" : "bubble-them"}`}>
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
                        <div ref={contactEndRef} />
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>

            <div className="modal-footer">
              <button className="secondary-button" onClick={() => setSelectedContact(null)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Contacts;
