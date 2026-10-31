import React, { useState, useEffect, useCallback } from "react";
import {
  Image,
  Video,
  Music,
  FileText,
  Smile,
  RefreshCw,
  Info,
  Clock,
  HardDrive,
} from "lucide-react";
import DataTable from "../components/DataTable.jsx";
import Loading from "../components/Loading.jsx";
import ErrorMessage from "../components/ErrorMessage.jsx";
import searchApi from "../api/searchApi.js";

export function Media() {
  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [kindFilter, setKindFilter] = useState("");
  const [limit, setLimit] = useState(25);
  const [offset, setOffset] = useState(0);

  const fetchMedia = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const params = { limit, offset };
      if (kindFilter) params.kind = kindFilter;

      const res = await searchApi.getMedia(params);
      setItems(Array.isArray(res.data) ? res.data : []);
      setTotal(res.total || 0);
    } catch (err) {
      setError(err.message || "Failed to load media records");
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [limit, offset, kindFilter]);

  useEffect(() => {
    fetchMedia();
  }, [fetchMedia]);

  const formatFileSize = (bytes) => {
    if (!bytes || isNaN(bytes)) return "—";
    const units = ["B", "KB", "MB", "GB"];
    let size = Number(bytes);
    let u = 0;
    while (size >= 1024 && u < units.length - 1) {
      size /= 1024;
      u++;
    }
    return `${size.toFixed(1)} ${units[u]}`;
  };

  const getMediaIcon = (kind) => {
    switch (kind) {
      case "image":
        return <Image size={15} className="media-kind-icon color-image" />;
      case "video":
        return <Video size={15} className="media-kind-icon color-video" />;
      case "audio":
        return <Music size={15} className="media-kind-icon color-audio" />;
      case "document":
        return <FileText size={15} className="media-kind-icon color-doc" />;
      case "sticker":
        return <Smile size={15} className="media-kind-icon color-sticker" />;
      default:
        return <HardDrive size={15} className="media-kind-icon" />;
    }
  };

  const columns = [
    {
      key: "kind",
      label: "Type",
      width: "120px",
      render: (m) => (
        <span className="media-type-badge">
          {getMediaIcon(m.kind)}
          <span>{m.kind || m.messageType?.replace("Message", "")}</span>
        </span>
      ),
    },
    {
      key: "fileName",
      label: "File / Description",
      render: (m) => (
        <div className="table-cell-media-info">
          <strong className="media-file-name">{m.fileName || m.text || "Unnamed media object"}</strong>
          <small className="mono-subtext">{m.mimetype || "unknown MIME"}</small>
        </div>
      ),
    },
    {
      key: "fileLength",
      label: "Size",
      width: "110px",
      render: (m) => <span>{formatFileSize(m.fileLength)}</span>,
    },
    {
      key: "sender",
      label: "Sender",
      width: "160px",
      render: (m) => <strong>{m.senderName || "Sender"}</strong>,
    },
    {
      key: "chat",
      label: "Chat",
      width: "180px",
      render: (m) => <span>{m.chatName || "Direct Chat"}</span>,
    },
    {
      key: "time",
      label: "Timestamp",
      width: "160px",
      render: (m) => (
        <span className="table-timestamp">
          {m.time ? new Date(m.time).toLocaleString() : "—"}
        </span>
      ),
    },
  ];

  return (
    <div className="media-page-wrapper">
      {/* Notice about media binary storage */}
      <div className="notice-banner-card">
        <Info size={18} className="notice-icon" />
        <div className="notice-text">
          <strong>Media Metadata Archive</strong>
          <p>
            The connector records and indexes metadata (MIME type, file size, sender, chat context, timestamps) for all media shared in WhatsApp. Raw media binaries are retained by WhatsApp servers according to your device's retention policy.
          </p>
        </div>
      </div>

      <div className="filter-toolbar-card">
        <div className="media-kind-filters-pills">
          <button
            className={`filter-pill-btn ${kindFilter === "" ? "pill-active" : ""}`}
            onClick={() => {
              setOffset(0);
              setKindFilter("");
            }}
          >
            All Media
          </button>
          <button
            className={`filter-pill-btn ${kindFilter === "image" ? "pill-active" : ""}`}
            onClick={() => {
              setOffset(0);
              setKindFilter("image");
            }}
          >
            <Image size={14} /> Images
          </button>
          <button
            className={`filter-pill-btn ${kindFilter === "video" ? "pill-active" : ""}`}
            onClick={() => {
              setOffset(0);
              setKindFilter("video");
            }}
          >
            <Video size={14} /> Videos
          </button>
          <button
            className={`filter-pill-btn ${kindFilter === "audio" ? "pill-active" : ""}`}
            onClick={() => {
              setOffset(0);
              setKindFilter("audio");
            }}
          >
            <Music size={14} /> Audio
          </button>
          <button
            className={`filter-pill-btn ${kindFilter === "document" ? "pill-active" : ""}`}
            onClick={() => {
              setOffset(0);
              setKindFilter("document");
            }}
          >
            <FileText size={14} /> Documents
          </button>
          <button
            className={`filter-pill-btn ${kindFilter === "sticker" ? "pill-active" : ""}`}
            onClick={() => {
              setOffset(0);
              setKindFilter("sticker");
            }}
          >
            <Smile size={14} /> Stickers
          </button>
        </div>

        <button className="secondary-button-sm" onClick={fetchMedia} disabled={loading}>
          <RefreshCw size={14} className={loading ? "spin-icon" : ""} /> Refresh
        </button>
      </div>

      {error && <ErrorMessage message={error} onRetry={fetchMedia} />}

      <div className="panel-card-table">
        <DataTable
          columns={columns}
          data={items}
          loading={loading}
          total={total}
          limit={limit}
          offset={offset}
          onPageChange={setOffset}
          emptyMessage="No media messages recorded"
          emptyDescription="Media shared in your WhatsApp chats will be indexed here."
        />
      </div>
    </div>
  );
}

export default Media;
