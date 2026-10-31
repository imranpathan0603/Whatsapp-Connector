import React from "react";

/**
 * Format JID into clean human-friendly phone number or label.
 * Strips technical hashes, @s.whatsapp.net, @lid, @g.us, @newsletter.
 */
export function formatPhoneNumber(jid = "") {
  if (!jid || typeof jid !== "string") return "";

  // Strip device suffixes like :77@s.whatsapp.net
  const base = jid.split("@")[0].split(":")[0];

  // If standard international phone number (e.g. 919876543210)
  if (/^\d{8,15}$/.test(base)) {
    if (base.length === 12 && base.startsWith("91")) {
      return `+91 ${base.slice(2, 7)} ${base.slice(7)}`;
    }
    return `+${base}`;
  }

  if (jid.includes("@newsletter")) return "WhatsApp Channel";
  if (jid.includes("@g.us")) return "WhatsApp Group";
  if (jid.includes("@lid")) return ""; // internal WhatsApp LID, do not show

  return base || "";
}

/**
 * Clean chat or contact display name.
 */
export function formatCleanTitle(title, fallbackJid = "") {
  if (title && !title.includes("@") && !/^\d{16,}$/.test(title)) {
    return title;
  }
  const cleanPhone = formatPhoneNumber(fallbackJid || title);
  if (cleanPhone) return cleanPhone;
  return title || "Conversation";
}

/**
 * Format message content for display, avoiding [protocolMessage] or raw technical labels.
 */
export function formatMessagePreview(m) {
  if (!m) return "";

  // If real text exists and is not protocolMessage
  if (m.text && typeof m.text === "string" && m.text.trim()) {
    if (m.text !== "[protocolMessage]" && !m.text.startsWith("[protocolMessage")) {
      return m.text;
    }
  }

  // Friendly media indicators
  const kind = m.kind || m.messageType?.replace("Message", "").toLowerCase();

  switch (kind) {
    case "image":
      return "📷 Photo";
    case "video":
      return "🎥 Video";
    case "audio":
      return "🎵 Audio message";
    case "document":
      return m.fileName ? `📄 ${m.fileName}` : "📄 Document";
    case "sticker":
      return "🏷️ Sticker";
    case "contact":
    case "contacts":
      return "👤 Contact card";
    case "location":
      return "📍 Location";
    case "reaction":
      return "Reaction";
    case "protocol":
    case "protocolmessage":
      return "Message updated";
    default:
      if (m.text && m.text !== "[protocolMessage]") return m.text;
      return "Message";
  }
}


/**
 * Render message text with formatted bold, italic, and auto-linked URLs.
 */
export function renderFormattedText(text) {
  if (!text || typeof text !== "string") return null;

  // Split text by URLs and markdown styles (*bold*, _italic_)
  const urlRegex = /(https?:\/\/[^\s]+)/g;
  const parts = text.split(urlRegex);

  return parts.map((part, index) => {
    if (part.match(urlRegex)) {
      return React.createElement(
        "a",
        {
          key: index,
          href: part,
          target: "_blank",
          rel: "noopener noreferrer",
          className: "chat-link",
          onClick: (e) => e.stopPropagation(),
        },
        part
      );
    }

    // Format bold (*text*) and italic (_text_)
    const subParts = part.split(/(\*[^*]+?\*|_[^_]+?_)/g);
    return subParts.map((sub, sIdx) => {
      if (sub.startsWith("*") && sub.endsWith("*") && sub.length > 2) {
        return React.createElement("strong", { key: sIdx }, sub.slice(1, -1));
      }
      if (sub.startsWith("_") && sub.endsWith("_") && sub.length > 2) {
        return React.createElement("em", { key: sIdx }, sub.slice(1, -1));
      }
      return sub;
    });
  });
}
