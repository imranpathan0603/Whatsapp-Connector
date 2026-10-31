import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables before application initializes
dotenv.config({ path: path.join(__dirname, ".env") });
dotenv.config({ path: path.resolve(__dirname, "../.env") });

import makeWASocket, {
    useMultiFileAuthState,
    DisconnectReason
  } from "@whiskeysockets/baileys";
  
  import express from "express";
  import cors from "cors";
  import P from "pino";
  import fs from "fs";
  import crypto from "crypto";
  import qrcodeTerminal from "qrcode-terminal";
  import QRCode from "qrcode";
  import aiAssistantService from "./services/aiAssistantService.js";
  
  // =====================================================================
  //  WhatsApp Connector Server
  //  - Archives messages / contacts / groups / chats from a linked account
  //  - REST API (all endpoints listed at GET /)
  //  - Connector interface: /api/connector/search, /api/connector/fetch/:id
  //  - MCP (JSON-RPC over HTTP):
  //        POST /mcp/:token   -> public/tunnel use (temporary token in the URL)
  //        POST /mcp          -> local use only (API_KEY if set)
  // =====================================================================
  
  // ---------------- CONFIGURATION ----------------
  
  const app = express();
  const PORT = process.env.PORT || 3000;
  const HOST = process.env.HOST || "0.0.0.0"; // bind dual-stack/all interfaces
  const API_KEY = process.env.API_KEY || null;  // protects local /api/* and /mcp
  const BASE_URL = (process.env.BASE_URL || `http://${HOST}:${PORT}`).replace(/\/$/, "");
  
  // Temporary tokens for the tunnel. File format: { "<token>": <expiry in unix ms> }
  // The file is re-read automatically when it changes, so no restart is needed.
  const TOKENS_FILE = process.env.TOKENS_FILE || path.join(__dirname, "tokens.json");
  const frontendDist = path.resolve(__dirname, "../whatsapp-frontend/dist");
  
  // When ON (default), any request that came through a tunnel/proxy is rejected
  // unless it is /mcp/<token>. Set TUNNEL_GUARD=off to disable.
  const TUNNEL_GUARD = String(process.env.TUNNEL_GUARD || "on").toLowerCase() !== "off";
  
  app.use(cors());

  // Serve static assets from frontend build if available
  if (fs.existsSync(frontendDist)) {
    app.use(express.static(frontendDist));
  }
  
  // ---- Tunnel guard: only /mcp/<token> may be reached through the tunnel ----
  // Cloudflare Tunnel / ngrok / most reverse proxies add these headers;
  // direct local requests (curl, browser on this PC) do not.
  const isTunneled = req =>
    Boolean(
      req.get("cf-connecting-ip") ||
      req.get("x-forwarded-for") ||
      req.get("x-forwarded-host") ||
      req.get("forwarded")
    );
  
  app.use((req, res, next) => {
    if (TUNNEL_GUARD && isTunneled(req) && !req.path.startsWith("/mcp/")) {
      return res.status(403).json({ error: "Forbidden" });
    }
    next();
  });
  
  app.use(express.json({ limit: "2mb" }));
  
  // ---- Temporary token check (reads TOKENS_FILE, cached by modified time) ----
  let tokenCache = { mtime: 0, data: {} };
  
  function loadTokens() {
    try {
      const stat = fs.statSync(TOKENS_FILE);
      if (stat.mtimeMs !== tokenCache.mtime) {
        tokenCache = {
          mtime: stat.mtimeMs,
          data: JSON.parse(fs.readFileSync(TOKENS_FILE, "utf8")) || {}
        };
      }
      return tokenCache.data;
    } catch {
      return {};
    }
  }
  
  function isValidToken(given) {
    if (!given || typeof given !== "string") return false;
    const tokens = loadTokens();
    const now = Date.now();
    const givenBuf = Buffer.from(given);
    let ok = false;
    for (const [token, expiry] of Object.entries(tokens)) {
      const tokenBuf = Buffer.from(token);
      if (
        tokenBuf.length === givenBuf.length &&
        crypto.timingSafeEqual(tokenBuf, givenBuf) &&
        Number(expiry) > now
      ) {
        ok = true; // no early exit, keeps timing uniform
      }
    }
    return ok;
  }
  
  function requireMcpToken(req, res, next) {
    if (!isValidToken(req.params.token)) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    next();
  }
  
  // ---- API key auth (local use). Accepts x-api-key, Bearer, or ?api_key= ----
  // /mcp/<token> is skipped here because it is protected by the token instead.
  app.use((req, res, next) => {
    if (!API_KEY) return next();
    if (req.path.startsWith("/mcp/")) return next();
    const bearer = (req.get("authorization") || "").replace(/^Bearer\s+/i, "");
    const provided = req.get("x-api-key") || bearer || req.query.api_key;
    if (provided === API_KEY) return next();
    res.status(401).json({ error: "Unauthorized. Send x-api-key or Authorization: Bearer <key>." });
  });
  
  const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, "data");
  const AUTH_DIR = process.env.AUTH_DIR || path.join(__dirname, "auth_info");
  
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.mkdirSync(AUTH_DIR, { recursive: true });
  
  const MESSAGES_FILE = path.join(DATA_DIR, "messages.json");
  const CONTACTS_FILE = path.join(DATA_DIR, "contacts.json");
  const GROUPS_FILE = path.join(DATA_DIR, "groups.json");
  const CHATS_FILE = path.join(DATA_DIR, "chats.json");
  
  // ---------------- JSON STORAGE ----------------
  
  const SESSION_META_FILE = path.join(DATA_DIR, "session_user.json");

  function loadJSON(file) {
    if (!fs.existsSync(file)) fs.writeFileSync(file, "[]");
    try {
      return JSON.parse(fs.readFileSync(file, "utf8"));
    } catch {
      return [];
    }
  }

  function loadActiveAccount() {
    try {
      if (fs.existsSync(SESSION_META_FILE)) {
        return JSON.parse(fs.readFileSync(SESSION_META_FILE, "utf8"));
      }
    } catch {}
    return null;
  }

  function saveActiveAccount(account) {
    try {
      fs.writeFileSync(SESSION_META_FILE, JSON.stringify(account, null, 2));
    } catch (err) {
      console.error("[Session] Failed to write session_user.json:", err.message);
    }
  }

  function clearActiveAccount() {
    try {
      if (fs.existsSync(SESSION_META_FILE)) {
        fs.rmSync(SESSION_META_FILE, { force: true });
      }
    } catch {}
  }
  
  // Debounced writes: avoids rewriting the whole file on every event
  const saveTimers = {};
  function scheduleSave(file, getData, delay = 2000) {
    if (saveTimers[file]) return;
    saveTimers[file] = setTimeout(() => {
      saveTimers[file] = null;
      fs.writeFileSync(file, JSON.stringify(getData(), null, 2));
    }, delay);
  }
  
  function flushAll() {
    fs.writeFileSync(MESSAGES_FILE, JSON.stringify(messages, null, 2));
    fs.writeFileSync(CONTACTS_FILE, JSON.stringify(contacts, null, 2));
    fs.writeFileSync(GROUPS_FILE, JSON.stringify(groups, null, 2));
    fs.writeFileSync(CHATS_FILE, JSON.stringify(chatsMeta, null, 2));
  }
  
  process.on("SIGINT", () => { flushAll(); process.exit(0); });
  process.on("SIGTERM", () => { flushAll(); process.exit(0); });
  
  let messages = loadJSON(MESSAGES_FILE);
  let contacts = loadJSON(CONTACTS_FILE);
  let groups = loadJSON(GROUPS_FILE);
  let chatsMeta = loadJSON(CHATS_FILE);
  
  // ---------------- IN-MEMORY INDEXES ----------------
  
  const messageIds = new Set();
  const messageById = new Map();     // record id or WhatsApp message id -> record
  const messagesByChat = new Map();  // chatId -> records[]
  const contactMap = new Map();      // id -> contact
  const groupMap = new Map();        // id -> group
  const chatMetaMap = new Map();     // id -> { id, name }
  
  function indexMessage(m) {
    messageIds.add(m.id);
    messageById.set(m.id, m);
    if (!messageById.has(m.messageId)) messageById.set(m.messageId, m);
    if (!messagesByChat.has(m.chatId)) messagesByChat.set(m.chatId, []);
    messagesByChat.get(m.chatId).push(m);
  }
  
  messages.forEach(indexMessage);
  contacts.forEach(c => contactMap.set(c.id, c));
  groups.forEach(g => groupMap.set(g.id, g));
  chatsMeta.forEach(c => chatMetaMap.set(c.id, c));

  // Clean whole previous data from memory, database files, and AI sessions
  function wipeAllUserData(reason = "logout") {
    console.log(`\n=====================================================================`);
    console.log(`[Data Sanitizer] Wiping all temporary in-memory stores and DB archives (Reason: ${reason})...`);
    console.log(`=====================================================================\n`);

    // 1. Cancel any pending debounced disk saves
    for (const key of Object.keys(saveTimers)) {
      if (saveTimers[key]) {
        clearTimeout(saveTimers[key]);
        saveTimers[key] = null;
      }
    }

    // 2. Clear in-memory message, contact, group, and chat structures
    messages.length = 0;
    contacts.length = 0;
    groups.length = 0;
    chatsMeta.length = 0;

    // 3. Clear Map & Set indexes
    messageIds.clear();
    messageById.clear();
    messagesByChat.clear();
    contactMap.clear();
    groupMap.clear();
    chatMetaMap.clear();

    // 4. Reset JSON database files on disk
    try {
      fs.writeFileSync(MESSAGES_FILE, "[]");
      fs.writeFileSync(CONTACTS_FILE, "[]");
      fs.writeFileSync(GROUPS_FILE, "[]");
      fs.writeFileSync(CHATS_FILE, "[]");
      clearActiveAccount();
    } catch (err) {
      console.error("[Data Sanitizer] Error resetting database files on disk:", err.message);
    }

    // 5. Clear AI Assistant conversation history & cached sessions
    try {
      aiAssistantService.clearAllAssistantSessions();
    } catch (err) {
      console.warn("[Data Sanitizer] Error clearing AI sessions:", err.message);
    }

    // 6. Broadcast event to all SSE frontend clients so UI updates immediately
    broadcastSSE("data_cleared", {
      reason,
      timestamp: new Date().toISOString(),
    });
    broadcastSSE("status", getConnectionStatus());

    console.log(`[Data Sanitizer] Complete: Storage, temporary memory, and database are clean.`);
  }

  function clearAuthSession() {
    try {
      if (fs.existsSync(AUTH_DIR)) {
        const files = fs.readdirSync(AUTH_DIR);
        for (const file of files) {
          fs.rmSync(path.join(AUTH_DIR, file), { recursive: true, force: true });
        }
      }
    } catch (err) {
      console.error("[Auth] Error clearing auth directory:", err.message);
    }
  }
  
  let sock = null;
  let isConnecting = false;
  let isReconnecting = false;
  let isLoggingOut = false;
  let reconnectTimer = null;
  let currentQrRaw = null;
  let currentQrDataUrl = null;
  let qrTimestamp = null;
  let connectionStatus = "disconnected"; // disconnected | connecting | qr | connected | reconnecting | logged_out | error
  let lastConnectedAt = null;
  let lastDisconnectReason = null;
  const sseClients = new Set();

  function broadcastSSE(event, data) {
    const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
    for (const client of sseClients) {
      try {
        client.write(payload);
      } catch {
        sseClients.delete(client);
      }
    }
  }

  function getConnectionStatus() {
    const isConnected = Boolean(sock?.user);
    let status = connectionStatus;
    if (isConnected) {
      status = "connected";
    } else if (currentQrDataUrl) {
      status = "qr";
    } else if (isConnecting) {
      status = isReconnecting ? "reconnecting" : "connecting";
    }

    return {
      connected: isConnected,
      connecting: isConnected ? false : (isConnecting || isReconnecting),
      status: status,
      account: sock?.user?.id || null,
      accountName: sock?.user?.name || null,
      phone: sock?.user?.id ? sock.user.id.split(":")[0].replace("@s.whatsapp.net", "") : null,
      qrAvailable: Boolean(currentQrDataUrl && !isConnected),
      qrTimestamp: qrTimestamp,
      messageCount: messages.length,
      totalMessages: messages.length,
      chatCount: messagesByChat.size,
      totalChats: messagesByChat.size,
      contactCount: contacts.length,
      contacts: contacts.length,
      groupCount: groups.length,
      groups: groups.length,
      lastConnected: lastConnectedAt,
      lastDisconnect: lastDisconnectReason
    };
  }
  
  // ---------------- MESSAGE HELPERS ----------------
  
  function unwrapMessage(message) {
    return (
      message?.ephemeralMessage?.message ||
      message?.viewOnceMessage?.message ||
      message?.viewOnceMessageV2?.message ||
      message?.documentWithCaptionMessage?.message ||
      message
    );
  }
  
  function extractMessageText(message) {
    if (!message) return "";
    const m = unwrapMessage(message);

    // If edited message inside protocolMessage
    if (m.protocolMessage?.editedMessage) {
      const ed = unwrapMessage(m.protocolMessage.editedMessage);
      return ed.conversation || ed.extendedTextMessage?.text || ed.imageMessage?.caption || "";
    }
    if (m.protocolMessage?.type === 0 || m.protocolMessage?.type === "REVOKE") {
      return "Message deleted";
    }
  
    return (
      m.conversation ||
      m.extendedTextMessage?.text ||
      m.imageMessage?.caption ||
      m.videoMessage?.caption ||
      m.documentMessage?.caption ||
      m.buttonsResponseMessage?.selectedDisplayText ||
      m.listResponseMessage?.title ||
      m.templateButtonReplyMessage?.selectedDisplayText ||
      ""
    );
  }
  
  function saveMessage(msg) {
    if (!msg?.key?.id || !msg?.key?.remoteJid || !msg.message) return;
    if (msg.key.remoteJid === "status@broadcast") return;
  
    const recordId = `${msg.key.remoteJid}_${msg.key.id}`;
    if (messageIds.has(recordId)) return;
  
    const inner = unwrapMessage(msg.message);
    const typeKey = Object.keys(inner).find(k => k !== "messageContextInfo") || "unknown";
    const content = inner[typeKey];
    const ctx = content?.contextInfo;
  
    const record = {
      id: recordId,
      messageId: msg.key.id,
      chatId: msg.key.remoteJid,
      fromMe: Boolean(msg.key.fromMe),
      sender: msg.key.participant || msg.key.remoteJid,
      pushName: msg.pushName || null,
      text: extractMessageText(msg.message),
      messageType: typeKey,
      mimetype: content?.mimetype || null,
      fileName: content?.fileName || null,
      fileLength: content?.fileLength ? Number(content.fileLength) : null,
      mentions: ctx?.mentionedJid || [],
      quotedId: ctx?.stanzaId || null,
      timestamp: Number(msg.messageTimestamp || 0)
    };
  
    messages.push(record);
    indexMessage(record);
    scheduleSave(MESSAGES_FILE, () => messages);
  }
  
  // ---------------- CONTACT / GROUP / CHAT HELPERS ----------------
  
  function saveContact(contact) {
    if (!contact?.id) return;
    const merged = { ...(contactMap.get(contact.id) || {}), ...contact };
    const index = contacts.findIndex(c => c.id === contact.id);
    if (index >= 0) contacts[index] = merged;
    else contacts.push(merged);
    contactMap.set(contact.id, merged);
    scheduleSave(CONTACTS_FILE, () => contacts);
  }
  
  function saveGroup(group) {
    if (!group?.id) return;
    const merged = { ...(groupMap.get(group.id) || {}), ...group };
    const index = groups.findIndex(g => g.id === group.id);
    if (index >= 0) groups[index] = merged;
    else groups.push(merged);
    groupMap.set(group.id, merged);
    scheduleSave(GROUPS_FILE, () => groups);
  }
  
  function saveChat(chat) {
    if (!chat?.id) return;
    const merged = { id: chat.id, name: chat.name || chatMetaMap.get(chat.id)?.name || null };
    const index = chatsMeta.findIndex(c => c.id === chat.id);
    if (index >= 0) chatsMeta[index] = merged;
    else chatsMeta.push(merged);
    chatMetaMap.set(chat.id, merged);
    scheduleSave(CHATS_FILE, () => chatsMeta);
  }
  
  // ---------------- WHATSAPP CONNECTION ----------------
  
  function scheduleReconnect() {
    if (reconnectTimer || isLoggingOut) return;
    isReconnecting = true;
    connectionStatus = "reconnecting";
    broadcastSSE("status", getConnectionStatus());
    broadcastSSE("reconnecting", { message: "Reconnecting in 5 seconds..." });
    reconnectTimer = setTimeout(() => {
      reconnectTimer = null;
      connectWhatsApp().catch(console.error);
    }, 5000);
  }

  async function connectWhatsApp() {
    if (isConnecting) return;
    isConnecting = true;
    if (!isReconnecting) {
      connectionStatus = "connecting";
    }
    broadcastSSE("status", getConnectionStatus());

    try {
      console.log("Starting WhatsApp connection...");

      // Clean up the old socket so listeners don't pile up
      if (sock) {
        try {
          sock.ev.removeAllListeners();
          sock.end?.(undefined);
        } catch {}
        sock = null;
      }

      const { state, saveCreds } = await useMultiFileAuthState(AUTH_DIR);

      sock = makeWASocket({
        logger: P({ level: "silent" }),
        auth: state,
        markOnlineOnConnect: false,
        syncFullHistory: true
      });

      sock.ev.on("creds.update", saveCreds);

      sock.ev.on("connection.update", async update => {
        const { connection, qr, lastDisconnect } = update;

        if (qr) {
          console.log("\n================================");
          console.log("SCAN QR WITH AUTHORIZED TEST ACCOUNT");
          console.log("================================\n");
          qrcodeTerminal.generate(qr, { small: true });
          try {
            currentQrRaw = qr;
            currentQrDataUrl = await QRCode.toDataURL(qr, { margin: 2, scale: 8 });
            qrTimestamp = Date.now();
            connectionStatus = "qr";
            broadcastSSE("qr", { available: true, qr: currentQrDataUrl, status: "qr", timestamp: qrTimestamp });
            broadcastSSE("status", getConnectionStatus());
          } catch (err) {
            console.error("Failed to generate QR data URL:", err);
          }
        }

        if (connection === "connecting") {
          console.log("Connecting to WhatsApp...");
          if (!currentQrDataUrl) {
            connectionStatus = isReconnecting ? "reconnecting" : "connecting";
            broadcastSSE("status", getConnectionStatus());
          }
        }

        if (connection === "open") {
          isConnecting = false;
          isReconnecting = false;
          currentQrDataUrl = null;
          currentQrRaw = null;
          qrTimestamp = null;
          connectionStatus = "connected";
          lastConnectedAt = new Date().toISOString();
          lastDisconnectReason = null;

          const currentAccountJid = sock.user?.id || "";
          const currentPhone = currentAccountJid ? currentAccountJid.split("@")[0].split(":")[0] : "";
          const activeAccount = loadActiveAccount();

          console.log("WhatsApp connected successfully!");
          console.log("Account:", currentAccountJid);

          // Detect login account change: if a previous account was recorded and it's different from the new login
          if (activeAccount && activeAccount.phone && activeAccount.phone !== currentPhone) {
            console.log(`\n======================================================`);
            console.log(`[LOGIN CHANGE DETECTED] Previous: ${activeAccount.phone} -> New: ${currentPhone}`);
            console.log(`Clearing all previous user data from disk, memory & AI sessions...`);
            console.log(`======================================================\n`);
            wipeAllUserData("login_account_changed");
          }

          // Save new active user metadata
          saveActiveAccount({
            id: currentAccountJid,
            phone: currentPhone,
            name: sock.user?.name || null,
            connectedAt: new Date().toISOString(),
          });

          broadcastSSE("login_changed", {
            account: currentAccountJid,
            phone: currentPhone,
            name: sock.user?.name || null,
          });
          broadcastSSE("status", getConnectionStatus());
          broadcastSSE("connected", { account: sock.user?.id, name: sock.user?.name });
          syncGroups().catch(() => {});
        }

        if (connection === "close") {
          isConnecting = false;
          isReconnecting = false;
          const statusCode = lastDisconnect?.error?.output?.statusCode;
          const errorMsg = lastDisconnect?.error?.message || "Connection closed";
          lastDisconnectReason = { statusCode, message: errorMsg, time: new Date().toISOString() };
          console.log("WhatsApp connection closed:", statusCode);
          console.log("Reason:", errorMsg);

          if (statusCode === DisconnectReason.loggedOut || isLoggingOut) {
            connectionStatus = "logged_out";
            currentQrDataUrl = null;
            currentQrRaw = null;
            qrTimestamp = null;
            console.log("Session logged out. Wiping previous user data & clearing credentials...");

            // Wipe auth session and ALL stored user data on logout
            clearAuthSession();
            wipeAllUserData("logged_out");

            broadcastSSE("status", getConnectionStatus());
            broadcastSSE("disconnected", { reason: "logged_out", statusCode });
            broadcastSSE("logout", { message: "Logged out and all previous data cleaned" });
            return;
          }

          connectionStatus = "reconnecting";
          broadcastSSE("status", getConnectionStatus());
          broadcastSSE("disconnected", { reason: "closed", statusCode, message: errorMsg });
          scheduleReconnect();
        }
      });

      sock.ev.on("messages.upsert", ({ messages: newMessages }) => {
        for (const msg of newMessages) saveMessage(msg);
      });

      sock.ev.on("messaging-history.set", ({ messages: hm, contacts: hc, chats: hch }) => {
        console.log("History synchronization received:", hm?.length || 0);
        for (const msg of hm || []) saveMessage(msg);
        for (const c of hc || []) saveContact(c);
        for (const c of hch || []) saveChat(c);
      });

      sock.ev.on("chats.upsert", list => list.forEach(saveChat));
      sock.ev.on("chats.update", list => list.forEach(saveChat));
      sock.ev.on("contacts.upsert", list => list.forEach(saveContact));
      sock.ev.on("contacts.update", list => list.forEach(saveContact));
      sock.ev.on("groups.upsert", list => list.forEach(saveGroup));
      sock.ev.on("groups.update", list => list.forEach(saveGroup));
    } catch (error) {
      isConnecting = false;
      isReconnecting = false;
      connectionStatus = "error";
      lastDisconnectReason = { message: error.message, time: new Date().toISOString() };
      console.error("WhatsApp connection error:", error);
      broadcastSSE("status", getConnectionStatus());
      broadcastSSE("error", { error: error.message });
      if (!isLoggingOut) {
        scheduleReconnect();
      }
    }
  }

  async function reconnectWhatsApp() {
    if (reconnectTimer) {
      clearTimeout(reconnectTimer);
      reconnectTimer = null;
    }
    isReconnecting = true;
    connectionStatus = "reconnecting";
    broadcastSSE("status", getConnectionStatus());
    broadcastSSE("reconnecting", { message: "Manual reconnect triggered" });

    if (sock) {
      try {
        sock.ev.removeAllListeners();
        sock.end?.(undefined);
      } catch {}
      sock = null;
    }

    isConnecting = false;
    await connectWhatsApp();
    return getConnectionStatus();
  }

  async function logoutWhatsApp() {
    isLoggingOut = true;
    if (reconnectTimer) {
      clearTimeout(reconnectTimer);
      reconnectTimer = null;
    }

    if (sock) {
      try {
        await sock.logout();
      } catch (e) {
        console.warn("Baileys logout:", e.message);
      }
      try {
        sock.ev.removeAllListeners();
        sock.end?.(undefined);
      } catch {}
      sock = null;
    }

    // Clean auth directory on explicit logout
    clearAuthSession();

    // Clean all previous data from memory, database files, and AI sessions
    wipeAllUserData("manual_logout");

    currentQrDataUrl = null;
    currentQrRaw = null;
    qrTimestamp = null;
    connectionStatus = "logged_out";
    isConnecting = false;
    isReconnecting = false;
    isLoggingOut = false;

    broadcastSSE("status", getConnectionStatus());
    broadcastSSE("logout", { message: "Logged out and all previous data cleaned successfully" });

    return {
      success: true,
      message: "Logged out and all previous data cleaned successfully",
      status: "logged_out",
    };
  }
  
  // Pull full group metadata (subjects, participants) from WhatsApp
  async function syncGroups() {
    if (!sock?.user) throw new Error("WhatsApp is not connected");
    const all = await sock.groupFetchAllParticipating();
    const list = Object.values(all);
    list.forEach(saveGroup);
    return list.length;
  }
  
  // ---------------- LOOKUP HELPERS ----------------
  
  function chatType(jid = "") {
    if (jid.endsWith("@g.us")) return "group";
    if (jid.endsWith("@broadcast")) return "broadcast";
    if (jid.endsWith("@newsletter")) return "channel";
    return "individual";
  }
  
  function contactName(jid) {
    const c = contactMap.get(jid);
    return c?.name || c?.notify || c?.verifiedName || null;
  }
  
  function formatCleanJid(jid = "") {
    if (!jid) return "";
    const base = jid.split("@")[0].split(":")[0];
    if (/^\d{8,15}$/.test(base)) {
      if (base.length === 12 && base.startsWith("91")) {
        return `+91 ${base.slice(2, 7)} ${base.slice(7)}`;
      }
      return `+${base}`;
    }
    if (jid.includes("@newsletter")) return "WhatsApp Channel";
    if (jid.includes("@g.us")) return "WhatsApp Group";
    if (jid.includes("@lid")) return "";
    return base;
  }

  function chatName(jid) {
    if (chatType(jid) === "group") {
      return groupMap.get(jid)?.subject || chatMetaMap.get(jid)?.name || formatCleanJid(jid) || "WhatsApp Group";
    }
    return contactName(jid) || chatMetaMap.get(jid)?.name || formatCleanJid(jid) || "Direct Chat";
  }
  
  function senderName(m) {
    if (m.fromMe) return "You";
    return contactName(m.sender) || m.pushName || formatCleanJid(m.sender) || "Sender";
  }
  
  const MEDIA_KINDS = {
    imageMessage: "image",
    videoMessage: "video",
    audioMessage: "audio",
    documentMessage: "document",
    stickerMessage: "sticker",
    ptvMessage: "video"
  };
  
  function mediaKind(type) {
    return MEDIA_KINDS[type] || null;
  }
  
  // Accepts unix seconds, unix ms, or an ISO date string. Returns unix seconds.
  function parseTime(value) {
    if (value === undefined || value === null || value === "") return null;
    if (/^\d+$/.test(String(value))) {
      const n = Number(value);
      return n > 1e12 ? Math.floor(n / 1000) : n;
    }
    const t = Date.parse(value);
    return Number.isNaN(t) ? null : Math.floor(t / 1000);
  }
  
  const iso = ts => (ts ? new Date(ts * 1000).toISOString() : null);
  
  function paginate(items, query = {}, defaultLimit = 50) {
    const limit = Math.min(500, Math.max(1, Number(query.limit) || defaultLimit));
    const offset = Math.max(0, Number(query.offset) || 0);
    return {
      total: items.length,
      limit,
      offset,
      hasMore: offset + limit < items.length,
      data: items.slice(offset, offset + limit)
    };
  }
  
  function enrichMessage(m) {
    return {
      ...m,
      time: iso(m.timestamp),
      kind: mediaKind(m.messageType),
      chatName: chatName(m.chatId),
      chatType: chatType(m.chatId),
      senderName: senderName(m)
    };
  }
  
  // ---------------- QUERY ENGINE ----------------
  
  const toBool = v => (v === "true" || v === true ? true : v === "false" || v === false ? false : null);
  
  // Shared message filter used by many endpoints
  function filterMessages(q = {}, forcedChatId) {
    const chatId = forcedChatId || q.chatId;
    const from = parseTime(q.from);
    const to = parseTime(q.to);
    const terms = q.q ? String(q.q).toLowerCase().split(/\s+/).filter(Boolean) : [];
    const sender = q.sender ? String(q.sender) : null;
    const type = q.type ? String(q.type) : null;
    const kind = q.kind ? String(q.kind) : null;
    const hasText = toBool(q.hasText);
    const fromMe = toBool(q.fromMe);
    const isGroup = toBool(q.isGroup);
  
    const base = chatId ? messagesByChat.get(chatId) || [] : messages;
  
    let result = base.filter(m => {
      // Filter out internal WhatsApp protocol pings with no text unless explicitly requested
      if (!type && m.messageType === "protocolMessage" && !m.text) return false;
      if (fromMe !== null && m.fromMe !== fromMe) return false;
      if (isGroup !== null && (chatType(m.chatId) === "group") !== isGroup) return false;
      if (sender && m.sender !== sender) return false;
      if (type && m.messageType !== type) return false;
      if (kind && mediaKind(m.messageType) !== kind) return false;
      if (hasText !== null && Boolean(m.text) !== hasText) return false;
      if (from !== null && m.timestamp < from) return false;
      if (to !== null && m.timestamp > to) return false;
      if (terms.length) {
        const hay = (m.text || "").toLowerCase();
        if (!terms.every(t => hay.includes(t))) return false;
      }
      return true;
    });

    const order = String(q.order || "desc").toLowerCase();
    result = result.slice().sort((a, b) =>
      order === "asc" ? a.timestamp - b.timestamp : b.timestamp - a.timestamp
    );
    return result;
  }
  
  function messagePage(q, forcedChatId, defaultLimit = 100) {
    const page = paginate(filterMessages(q, forcedChatId), q, defaultLimit);
    return { ...page, data: page.data.map(enrichMessage) };
  }

  function formatLastMessageSnippet(m) {
    if (!m) return "";
    if (m.text && m.text.trim()) return m.text;
    const k = mediaKind(m.messageType);
    if (k === "image") return "📷 Photo";
    if (k === "video") return "🎥 Video";
    if (k === "audio") return "🎵 Audio message";
    if (k === "document") return m.fileName ? `📄 ${m.fileName}` : "📄 Document";
    if (k === "sticker") return "🏷️ Sticker";
    if (m.messageType === "protocolMessage") return "Message updated";
    return "";
  }
  
  function buildChats() {
    const list = [];
    for (const [id, msgs] of messagesByChat) {
      // Find the latest message that is NOT an empty protocolMessage
      const sorted = [...msgs].sort((a, b) => b.timestamp - a.timestamp);
      const last = sorted.find(m => m.text && m.text.trim() && m.messageType !== "protocolMessage") ||
                   sorted.find(m => m.messageType !== "protocolMessage") ||
                   sorted[0] || msgs[0];

      let sent = 0;
      for (const m of msgs) {
        if (m.fromMe) sent++;
      }
      list.push({
        chatId: id,
        type: chatType(id),
        name: chatName(id),
        messageCount: msgs.length,
        sentCount: sent,
        receivedCount: msgs.length - sent,
        lastMessage: formatLastMessageSnippet(last),
        lastMessageType: last?.messageType || "text",
        lastTimestamp: last?.timestamp || 0,
        lastTime: iso(last?.timestamp || 0)
      });
    }
    return list.sort((a, b) => b.lastTimestamp - a.lastTimestamp);
  }
  
  function listChats(q = {}) {
    let chats = buildChats();
    if (q.type) chats = chats.filter(c => c.type === q.type);
    if (q.q) {
      const s = String(q.q).toLowerCase();
      chats = chats.filter(
        c => c.chatId.toLowerCase().includes(s) || (c.name || "").toLowerCase().includes(s)
      );
    }
    return paginate(chats, q);
  }
  
  function listContacts(q = {}) {
    let list = contacts;
    if (q.q) {
      const s = String(q.q).toLowerCase();
      list = list.filter(c =>
        [c.id, c.name, c.notify, c.verifiedName].some(v => (v || "").toLowerCase().includes(s))
      );
    }
    return paginate(list, q, 100);
  }
  
  function listGroups(q = {}) {
    let list = groups.map(g => ({
      ...g,
      participantCount: g.participants?.length ?? g.size ?? null,
      messageCount: (messagesByChat.get(g.id) || []).length
    }));
    if (q.q) {
      const s = String(q.q).toLowerCase();
      list = list.filter(g =>
        [g.id, g.subject, g.desc].some(v => (v || "").toLowerCase().includes(s))
      );
    }
    return paginate(list, q, 100);
  }
  
  function statsFor(msgs) {
    const byType = {};
    const byKind = {};
    let sent = 0, oldest = null, newest = null;
    for (const m of msgs) {
      byType[m.messageType] = (byType[m.messageType] || 0) + 1;
      const k = mediaKind(m.messageType);
      if (k) byKind[k] = (byKind[k] || 0) + 1;
      if (m.fromMe) sent++;
      if (oldest === null || m.timestamp < oldest) oldest = m.timestamp;
      if (newest === null || m.timestamp > newest) newest = m.timestamp;
    }
    return {
      totalMessages: msgs.length,
      sent,
      received: msgs.length - sent,
      messageTypes: byType,
      mediaKinds: byKind,
      oldestMessage: iso(oldest),
      newestMessage: iso(newest)
    };
  }
  
  function groupParticipants(groupId) {
    const g = groupMap.get(groupId);
    if (!g) return null;
    return (g.participants || []).map(p => ({
      id: p.id,
      name: contactName(p.id),
      admin: p.admin || null
    }));
  }

  aiAssistantService.initAiAssistant({
    getMessages: () => messages,
    getContacts: () => contacts,
    getGroups: () => groups,
    getChats: () => buildChats(),
    filterMessages: (q, forcedChatId) => filterMessages(q, forcedChatId),
    statsFor: (msgs) => statsFor(msgs),
    chatName: (jid) => chatName(jid),
    senderName: (m) => senderName(m),
    enrichMessage: (m) => enrichMessage(m),
  });
  
  // ---------------- SEARCH / FETCH (connector core) ----------------
  
  function transcript(msgs) {
    return msgs
      .map(m => {
        const when = new Date(m.timestamp * 1000).toISOString().replace("T", " ").slice(0, 16);
        const body = m.text || `[${mediaKind(m.messageType) || m.messageType}${m.fileName ? ": " + m.fileName : ""}]`;
        return `[${when}] ${senderName(m)}: ${body}`;
      })
      .join("\n");
  }
  
  function snippet(text, terms, size = 240) {
    if (!text) return "";
    const lower = text.toLowerCase();
    const idx = terms.map(t => lower.indexOf(t)).filter(i => i >= 0).sort((a, b) => a - b)[0] ?? 0;
    const start = Math.max(0, idx - 60);
    return (start > 0 ? "…" : "") + text.slice(start, start + size) + (start + size < text.length ? "…" : "");
  }
  
  // Unified search across messages, chats, contacts and groups.
  // Returns { results: [{ id, title, text, url, type }] } -- the standard connector shape.
  function unifiedSearch(query, { limit = 20, scope = "all" } = {}) {
    const terms = String(query || "").toLowerCase().split(/\s+/).filter(Boolean);
    if (!terms.length) return { results: [] };
    const max = Math.min(100, Math.max(1, Number(limit) || 20));
    const results = [];
  
    const matchAll = hay => terms.every(t => hay.toLowerCase().includes(t));
  
    if (scope === "all" || scope === "chats") {
      for (const c of buildChats()) {
        if (matchAll(`${c.name || ""} ${c.chatId}`)) {
          results.push({
            id: `chat:${c.chatId}`,
            type: "chat",
            title: `Chat: ${c.name || c.chatId}`,
            text: `${c.type} chat, ${c.messageCount} messages, last activity ${c.lastTime}`,
            url: `${BASE_URL}/api/chats/${encodeURIComponent(c.chatId)}`
          });
        }
      }
    }
  
    if (scope === "all" || scope === "contacts") {
      for (const c of contacts) {
        if (matchAll(`${c.name || ""} ${c.notify || ""} ${c.verifiedName || ""} ${c.id}`)) {
          results.push({
            id: `contact:${c.id}`,
            type: "contact",
            title: `Contact: ${c.name || c.notify || c.id}`,
            text: c.id,
            url: `${BASE_URL}/api/contacts/${encodeURIComponent(c.id)}`
          });
        }
      }
    }
  
    if (scope === "all" || scope === "groups") {
      for (const g of groups) {
        if (matchAll(`${g.subject || ""} ${g.desc || ""} ${g.id}`)) {
          results.push({
            id: `group:${g.id}`,
            type: "group",
            title: `Group: ${g.subject || g.id}`,
            text: g.desc || `${g.participants?.length ?? "?"} participants`,
            url: `${BASE_URL}/api/groups/${encodeURIComponent(g.id)}`
          });
        }
      }
    }
  
    if (scope === "all" || scope === "messages") {
      const phrase = terms.join(" ");
      const hits = [];
      for (const m of messages) {
        const text = (m.text || "").toLowerCase();
        if (!text || !terms.every(t => text.includes(t))) continue;
        hits.push({ m, score: (text.includes(phrase) ? 2 : 0) + 1 });
      }
      hits.sort((a, b) => b.score - a.score || b.m.timestamp - a.m.timestamp);
      for (const { m } of hits.slice(0, max)) {
        results.push({
          id: `message:${m.id}`,
          type: "message",
          title: `${chatName(m.chatId) || m.chatId} — ${senderName(m)} (${iso(m.timestamp)?.slice(0, 16).replace("T", " ")})`,
          text: snippet(m.text, terms),
          url: `${BASE_URL}/api/messages/${encodeURIComponent(m.id)}`
        });
      }
    }
  
    return { results: results.slice(0, max) };
  }
  
  function fetchById(rawId) {
    const sep = String(rawId).indexOf(":");
    const kind = sep > 0 ? rawId.slice(0, sep) : "message";
    const id = sep > 0 ? rawId.slice(sep + 1) : rawId;
  
    if (kind === "message") {
      const m = messageById.get(id);
      if (!m) return null;
      const chatMsgs = (messagesByChat.get(m.chatId) || []).slice().sort((a, b) => a.timestamp - b.timestamp);
      const i = chatMsgs.findIndex(x => x.id === m.id);
      const around = chatMsgs.slice(Math.max(0, i - 5), i + 6);
      return {
        id: `message:${m.id}`,
        title: `${chatName(m.chatId) || m.chatId} — ${senderName(m)}`,
        text: `${m.text || "[no text]"}\n\n--- surrounding conversation ---\n${transcript(around)}`,
        url: `${BASE_URL}/api/messages/${encodeURIComponent(m.id)}`,
        metadata: enrichMessage(m)
      };
    }
  
    if (kind === "chat") {
      const msgs = (messagesByChat.get(id) || []).slice().sort((a, b) => a.timestamp - b.timestamp);
      if (!msgs.length && !chatMetaMap.has(id)) return null;
      return {
        id: `chat:${id}`,
        title: `Chat: ${chatName(id) || id}`,
        text: transcript(msgs.slice(-300)),
        url: `${BASE_URL}/api/chats/${encodeURIComponent(id)}`,
        metadata: { chatId: id, type: chatType(id), ...statsFor(msgs), showing: "last 300 messages" }
      };
    }
  
    if (kind === "contact") {
      const c = contactMap.get(id);
      if (!c) return null;
      const msgs = (messagesByChat.get(id) || []).slice().sort((a, b) => a.timestamp - b.timestamp);
      return {
        id: `contact:${id}`,
        title: `Contact: ${c.name || c.notify || id}`,
        text: transcript(msgs.slice(-200)) || JSON.stringify(c, null, 2),
        url: `${BASE_URL}/api/contacts/${encodeURIComponent(id)}`,
        metadata: { ...c, messageCount: msgs.length }
      };
    }
  
    if (kind === "group") {
      const g = groupMap.get(id);
      if (!g) return null;
      const msgs = (messagesByChat.get(id) || []).slice().sort((a, b) => a.timestamp - b.timestamp);
      return {
        id: `group:${id}`,
        title: `Group: ${g.subject || id}`,
        text: `${g.desc ? g.desc + "\n\n" : ""}${transcript(msgs.slice(-300))}`,
        url: `${BASE_URL}/api/groups/${encodeURIComponent(id)}`,
        metadata: { ...g, participants: groupParticipants(id), messageCount: msgs.length }
      };
    }
  
    return null;
  }
  
  // ---------------- REST API ----------------
  
  const wrap = fn => (req, res) => {
    Promise.resolve(fn(req, res)).catch(err => {
      console.error(err);
      res.status(500).json({ error: err.message || "Internal error" });
    });
  };
  
  const notFound = (res, what) => res.status(404).json({ error: `${what} not found` });
  
  app.get("/", (req, res) => {
    // If accessed from a web browser requesting HTML, serve the frontend application
    if (req.accepts(["html", "json"]) === "html") {
      const indexPath = path.join(frontendDist, "index.html");
      if (fs.existsSync(indexPath)) {
        return res.sendFile(indexPath);
      }
    }

    res.json({
      message: "WhatsApp Connector Server is running",
      auth: API_KEY ? "x-api-key header or Authorization: Bearer <key>" : "none (set API_KEY to enable)",
      tunnel: "Only POST /mcp/<token> is reachable through a tunnel (token from tokens.json)",
      common_message_filters:
        "chatId, sender, fromMe, isGroup, type, kind(image|video|audio|document|sticker), hasText, from, to, q, order(asc|desc), limit(<=500), offset",
      endpoints: {
        system: ["GET /api/health", "GET /api/status", "GET /api/stats", "POST /api/sync/groups"],
        connection: [
          "GET /api/connection/qr",
          "POST /api/connection/connect",
          "POST /api/connection/reconnect",
          "POST /api/connection/logout",
          "GET /api/connection/events"
        ],
        ai: [
          "POST /api/ai/assistant/chat",
          "GET /api/ai/assistant/history",
          "DELETE /api/ai/assistant/history",
          "GET /api/ai/summary?type=today|week|month&chatId=",
          "GET /api/ai/insights"
        ],
        chats: [
          "GET /api/chats?type=group|individual|broadcast|channel&q=",
          "GET /api/chats/:chatId",
          "GET /api/chats/:chatId/messages",
          "GET /api/chats/:chatId/stats",
          "GET /api/chats/:chatId/media",
          "GET /api/chats/:chatId/links",
          "GET /api/chats/:chatId/participants",
          "GET /api/chats/:chatId/timeline",
          "GET /api/chats/:chatId/transcript"
        ],
        messages: [
          "GET /api/messages",
          "GET /api/messages/:id",
          "GET /api/messages/:id/context?before=5&after=5",
          "GET /api/messages/:id/replies"
        ],
        search: ["GET /api/search?q=", "GET /api/search/all?q=&scope=all|messages|chats|contacts|groups"],
        media: ["GET /api/media?kind=image|video|audio|document|sticker"],
        links: ["GET /api/links?q="],
        contacts: ["GET /api/contacts?q=", "GET /api/contacts/:id", "GET /api/contacts/:id/messages", "GET /api/contacts/:id/stats"],
        groups: ["GET /api/groups?q=", "GET /api/groups/:id", "GET /api/groups/:id/messages", "GET /api/groups/:id/participants"],
        analytics: [
          "GET /api/analytics/daily?chatId=&from=&to=&tzOffset=330",
          "GET /api/analytics/hourly?chatId=&tzOffset=330",
          "GET /api/analytics/top-senders?chatId=&limit="
        ],
        export: ["GET /api/export/messages?format=json|csv (supports all message filters)"],
        connector: [
          "GET /api/connector/search?query=&limit=&scope=",
          "GET /api/connector/fetch/:id   (ids: message:<id> | chat:<id> | contact:<id> | group:<id>)",
          "POST /mcp/:token   (MCP JSON-RPC for the tunnel; temporary token)",
          "POST /mcp          (MCP JSON-RPC, local only; tools search, fetch, list_chats, get_messages, list_contacts, list_groups, get_stats)"
        ]
      }
    });
  });
  
  // ---- System ----

  app.get("/api/health", (req, res) => res.json({ ok: true, uptimeSeconds: Math.round(process.uptime()) }));

  app.get("/api/status", (req, res) => {
    res.json(getConnectionStatus());
  });

  app.get("/api/stats", (req, res) => {
    const chats = buildChats();
    const stats = statsFor(messages);
    res.json({
      ...stats,
      totalMessages: stats.totalMessages,
      messageCount: stats.totalMessages,
      totalChats: chats.length,
      chatCount: chats.length,
      groupChats: chats.filter(c => c.type === "group").length,
      individualChats: chats.filter(c => c.type === "individual").length,
      contacts: contacts.length,
      contactCount: contacts.length,
      groups: groups.length,
      groupCount: groups.length,
      sentCount: stats.sent,
      receivedCount: stats.received
    });
  });

  app.post("/api/sync/groups", wrap(async (req, res) => {
    const count = await syncGroups();
    res.json({ synced: count });
  }));

  // ---- Connection management ----

  app.get("/api/connection/qr", (req, res) => {
    if (currentQrDataUrl && !sock?.user) {
      res.json({
        available: true,
        qr: currentQrDataUrl,
        status: "qr",
        timestamp: qrTimestamp
      });
    } else {
      res.json({
        available: false,
        qr: null,
        status: getConnectionStatus().status
      });
    }
  });

  app.post("/api/connection/connect", wrap(async (req, res) => {
    if (sock?.user) {
      return res.json({ message: "Already connected", ...getConnectionStatus() });
    }
    if (!isConnecting) {
      connectWhatsApp().catch(console.error);
    }
    res.json({ message: "Connecting initiated", ...getConnectionStatus() });
  }));

  app.post("/api/connection/reconnect", wrap(async (req, res) => {
    const status = await reconnectWhatsApp();
    res.json({ message: "Reconnection initiated", ...status });
  }));

  app.post("/api/connection/logout", wrap(async (req, res) => {
    const result = await logoutWhatsApp();
    res.json(result);
  }));

  app.post("/api/connection/clear-data", wrap(async (req, res) => {
    wipeAllUserData("manual_clear_request");
    res.json({
      success: true,
      message: "All previous messages, contacts, chats, groups, and AI history have been wiped cleanly.",
      ...getConnectionStatus(),
    });
  }));

  app.get("/api/connection/events", (req, res) => {
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.flushHeaders?.();

    sseClients.add(res);

    // Initial state sent on connect
    const currentStatus = getConnectionStatus();
    res.write(`event: status\ndata: ${JSON.stringify(currentStatus)}\n\n`);
    if (currentQrDataUrl && !sock?.user) {
      res.write(`event: qr\ndata: ${JSON.stringify({ available: true, qr: currentQrDataUrl, status: "qr", timestamp: qrTimestamp })}\n\n`);
    }

    const heartbeat = setInterval(() => {
      res.write(": heartbeat\n\n");
    }, 25000);

    req.on("close", () => {
      clearInterval(heartbeat);
      sseClients.delete(res);
    });
  });

  // ---- AI Assistant & Copilot ----

  app.post("/api/ai/assistant/chat", wrap(async (req, res) => {
    const result = await aiAssistantService.handleAssistantChat(req.body || {});
    res.json(result);
  }));

  app.get("/api/ai/assistant/history", (req, res) => {
    const history = aiAssistantService.getAssistantHistory(req.query.conversationId);
    res.json(history);
  });

  app.delete("/api/ai/assistant/history", (req, res) => {
    const result = aiAssistantService.clearAssistantHistory(req.query.conversationId);
    res.json(result);
  });

  app.get("/api/ai/summary", wrap(async (req, res) => {
    const result = await aiAssistantService.generateExecutiveSummary(req.query || {});
    res.json(result);
  }));

  app.get("/api/ai/insights", wrap(async (req, res) => {
    const result = await aiAssistantService.generateAIAnalyticsInsights();
    res.json(result);
  }));
  
  // ---- Chats ----
  
  app.get("/api/chats", (req, res) => res.json(listChats(req.query)));
  
  app.get("/api/chats/:chatId", (req, res) => {
    const chat = buildChats().find(c => c.chatId === req.params.chatId);
    if (!chat) return notFound(res, "Chat");
    res.json(chat);
  });
  
  app.get("/api/chats/:chatId/messages", (req, res) =>
    res.json(messagePage(req.query, req.params.chatId))
  );
  
  app.get("/api/chats/:chatId/stats", (req, res) => {
    const msgs = messagesByChat.get(req.params.chatId);
    if (!msgs) return notFound(res, "Chat");
    res.json({ chatId: req.params.chatId, name: chatName(req.params.chatId), ...statsFor(msgs) });
  });
  
  app.get("/api/chats/:chatId/media", (req, res) => {
    const q = { ...req.query };
    let msgs = filterMessages(q, req.params.chatId);
    if (!q.kind && !q.type) {
      msgs = msgs.filter(m => mediaKind(m.messageType));
    }
    const page = paginate(msgs, q, 100);
    res.json({ ...page, data: page.data.map(enrichMessage) });
  });
  
  app.get("/api/chats/:chatId/links", (req, res) => res.json(extractLinks(req.query, req.params.chatId)));
  
  app.get("/api/chats/:chatId/participants", (req, res) => {
    const p = groupParticipants(req.params.chatId);
    if (!p) return notFound(res, "Group (not a group, or metadata not synced; try POST /api/sync/groups)");
    res.json({ total: p.length, data: p });
  });
  
  app.get("/api/chats/:chatId/timeline", (req, res) =>
    res.json(dailyCounts({ ...req.query, chatId: req.params.chatId }))
  );
  
  // Plain-text transcript of a chat (handy for feeding into other tools)
  app.get("/api/chats/:chatId/transcript", (req, res) => {
    const msgs = filterMessages({ ...req.query, order: "asc" }, req.params.chatId);
    const limit = Math.min(5000, Number(req.query.limit) || 500);
    res.type("text/plain").send(transcript(msgs.slice(-limit)));
  });
  
  // ---- Messages ----
  
  app.get("/api/messages", (req, res) => res.json(messagePage(req.query)));
  
  app.get("/api/messages/:id", (req, res) => {
    const m = messageById.get(req.params.id);
    if (!m) return notFound(res, "Message");
    res.json(enrichMessage(m));
  });
  
  app.get("/api/messages/:id/context", (req, res) => {
    const m = messageById.get(req.params.id);
    if (!m) return notFound(res, "Message");
    const before = Math.min(50, Math.max(0, Number(req.query.before ?? 5)));
    const after = Math.min(50, Math.max(0, Number(req.query.after ?? 5)));
    const chatMsgs = (messagesByChat.get(m.chatId) || []).slice().sort((a, b) => a.timestamp - b.timestamp);
    const i = chatMsgs.findIndex(x => x.id === m.id);
    res.json({
      message: enrichMessage(m),
      before: chatMsgs.slice(Math.max(0, i - before), i).map(enrichMessage),
      after: chatMsgs.slice(i + 1, i + 1 + after).map(enrichMessage)
    });
  });
  
  // Messages that quote/reply to this message
  app.get("/api/messages/:id/replies", (req, res) => {
    const m = messageById.get(req.params.id);
    if (!m) return notFound(res, "Message");
    const replies = (messagesByChat.get(m.chatId) || []).filter(x => x.quotedId === m.messageId);
    res.json({ total: replies.length, data: replies.map(enrichMessage) });
  });
  
  // ---- Search ----
  
  app.get("/api/search", (req, res) => {
    if (!req.query.q) {
      return res.status(400).json({ error: "Search query required. Example: /api/search?q=hello" });
    }
    res.json(messagePage(req.query));
  });
  
  app.get("/api/search/all", (req, res) => {
    if (!req.query.q) return res.status(400).json({ error: "Query required: /api/search/all?q=hello" });
    res.json(unifiedSearch(req.query.q, { limit: req.query.limit, scope: req.query.scope || "all" }));
  });
  
  // ---- Media & links ----
  
  app.get("/api/media", (req, res) => {
    const q = { ...req.query };
    const all = filterMessages(q).filter(m => mediaKind(m.messageType));
    const page = paginate(all, q, 100);
    res.json({ ...page, data: page.data.map(enrichMessage) });
  });
  
  function extractLinks(q, forcedChatId) {
    const re = /https?:\/\/[^\s<>"')]+/gi;
    const out = [];
    for (const m of filterMessages({ ...q, q: undefined }, forcedChatId)) {
      const found = (m.text || "").match(re);
      if (!found) continue;
      for (const url of found) {
        if (q.q && !url.toLowerCase().includes(String(q.q).toLowerCase())) continue;
        out.push({
          url,
          messageId: m.id,
          chatId: m.chatId,
          chatName: chatName(m.chatId),
          senderName: senderName(m),
          time: iso(m.timestamp)
        });
      }
    }
    return paginate(out, q, 100);
  }
  
  app.get("/api/links", (req, res) => res.json(extractLinks(req.query)));
  
  // ---- Contacts ----
  
  app.get("/api/contacts", (req, res) => res.json(listContacts(req.query)));
  
  app.get("/api/contacts/:id", (req, res) => {
    const contact = contactMap.get(req.params.id);
    if (!contact) return notFound(res, "Contact");
    res.json({ ...contact, messageCount: (messagesByChat.get(contact.id) || []).length });
  });
  
  app.get("/api/contacts/:id/messages", (req, res) => res.json(messagePage(req.query, req.params.id)));
  
  app.get("/api/contacts/:id/stats", (req, res) => {
    const contact = contactMap.get(req.params.id);
    if (!contact) return notFound(res, "Contact");
    res.json({ id: contact.id, name: contactName(contact.id), ...statsFor(messagesByChat.get(contact.id) || []) });
  });
  
  // ---- Groups ----
  
  app.get("/api/groups", (req, res) => res.json(listGroups(req.query)));
  
  app.get("/api/groups/:id", (req, res) => {
    const group = groupMap.get(req.params.id);
    if (!group) return notFound(res, "Group");
    res.json({
      ...group,
      participants: groupParticipants(group.id),
      messageCount: (messagesByChat.get(group.id) || []).length
    });
  });
  
  app.get("/api/groups/:id/messages", (req, res) => res.json(messagePage(req.query, req.params.id)));
  
  app.get("/api/groups/:id/participants", (req, res) => {
    const p = groupParticipants(req.params.id);
    if (!p) return notFound(res, "Group");
    res.json({ total: p.length, data: p });
  });
  
  // ---- Analytics ----
  
  function dailyCounts(q) {
    const offsetSec = (Number(q.tzOffset) || 0) * 60;
    const days = new Map();
    for (const m of filterMessages({ ...q, order: "asc" })) {
      const day = new Date((m.timestamp + offsetSec) * 1000).toISOString().slice(0, 10);
      const d = days.get(day) || { date: day, total: 0, sent: 0, received: 0 };
      d.total++;
      if (m.fromMe) d.sent++;
      else d.received++;
      days.set(day, d);
    }
    return { data: [...days.values()] };
  }
  
  app.get("/api/analytics/daily", (req, res) => res.json(dailyCounts(req.query)));
  
  app.get("/api/analytics/hourly", (req, res) => {
    const offsetSec = (Number(req.query.tzOffset) || 0) * 60;
    const hours = Array.from({ length: 24 }, (_, h) => ({ hour: h, total: 0 }));
    for (const m of filterMessages(req.query)) {
      hours[new Date((m.timestamp + offsetSec) * 1000).getUTCHours()].total++;
    }
    res.json({ data: hours });
  });
  
  app.get("/api/analytics/top-senders", (req, res) => {
    const counts = new Map();
    for (const m of filterMessages(req.query)) {
      const key = m.fromMe ? "me" : m.sender;
      counts.set(key, (counts.get(key) || 0) + 1);
    }
    const ranked = [...counts.entries()]
      .map(([sender, count]) => ({
        sender,
        name: sender === "me" ? "me" : contactName(sender),
        count
      }))
      .sort((a, b) => b.count - a.count);
    res.json(paginate(ranked, req.query, 20));
  });
  
  // ---- Export ----
  
  app.get("/api/export/messages", (req, res) => {
    const result = filterMessages(req.query, undefined).map(enrichMessage);
    const format = String(req.query.format || "json").toLowerCase();
  
    if (format === "csv") {
      const cols = ["time", "chatId", "chatName", "senderName", "sender", "fromMe", "messageType", "text", "id"];
      const esc = v => `"${String(v ?? "").replace(/"/g, '""').replace(/\r?\n/g, " ")}"`;
      const csv = [cols.join(","), ...result.map(m => cols.map(c => esc(m[c])).join(","))].join("\n");
      res.setHeader("Content-Disposition", 'attachment; filename="messages.csv"');
      return res.type("text/csv").send(csv);
    }
  
    res.setHeader("Content-Disposition", 'attachment; filename="messages.json"');
    res.json({ total: result.length, data: result });
  });
  
  // ---- Connector interface (search + fetch) ----
  
  app.get("/api/connector/search", (req, res) => {
    const query = req.query.query || req.query.q;
    if (!query) return res.status(400).json({ error: "Provide ?query=" });
    res.json(unifiedSearch(query, { limit: req.query.limit, scope: req.query.scope || "all" }));
  });
  
  app.get("/api/connector/fetch/:id", (req, res) => {
    const doc = fetchById(req.params.id);
    if (!doc) return notFound(res, "Document");
    res.json(doc);
  });
  
  // ---------------- MCP ENDPOINT (JSON-RPC over HTTP) ----------------
  
  const TOOLS = [
    {
      name: "search",
      description:
        "Search the WhatsApp archive (messages, chats, contacts, groups). Returns results with id, title, text snippet and url. Use fetch with an id for full content.",
      inputSchema: {
        type: "object",
        properties: {
          query: { type: "string", description: "Search words; all words must match" },
          scope: { type: "string", enum: ["all", "messages", "chats", "contacts", "groups"] },
          limit: { type: "number" }
        },
        required: ["query"]
      },
      run: a => unifiedSearch(a.query, { limit: a.limit, scope: a.scope || "all" })
    },
    {
      name: "fetch",
      description:
        "Fetch full content by id from search results (message:<id>, chat:<id>, contact:<id>, group:<id>). Chats and groups return a transcript of recent messages.",
      inputSchema: { type: "object", properties: { id: { type: "string" } }, required: ["id"] },
      run: a => fetchById(a.id) || { error: "Not found" }
    },
    {
      name: "list_chats",
      description: "List chats, most recent first. Optional filters: type (group|individual), q (name/id contains).",
      inputSchema: {
        type: "object",
        properties: { type: { type: "string" }, q: { type: "string" }, limit: { type: "number" }, offset: { type: "number" } }
      },
      run: a => listChats(a)
    },
    {
      name: "get_messages",
      description:
        "Get messages with filters: chatId, sender, fromMe, kind (image|video|audio|document|sticker), from/to (ISO date or unix), q, order (asc|desc), limit, offset.",
      inputSchema: {
        type: "object",
        properties: {
          chatId: { type: "string" }, sender: { type: "string" }, fromMe: { type: "boolean" },
          kind: { type: "string" }, from: { type: "string" }, to: { type: "string" },
          q: { type: "string" }, order: { type: "string" }, limit: { type: "number" }, offset: { type: "number" }
        }
      },
      run: a => messagePage(a, undefined, 50)
    },
    {
      name: "list_contacts",
      description: "List or search contacts by name/number.",
      inputSchema: { type: "object", properties: { q: { type: "string" }, limit: { type: "number" } } },
      run: a => listContacts(a)
    },
    {
      name: "list_groups",
      description: "List or search groups by subject/description.",
      inputSchema: { type: "object", properties: { q: { type: "string" }, limit: { type: "number" } } },
      run: a => listGroups(a)
    },
    {
      name: "get_stats",
      description: "Overall archive statistics.",
      inputSchema: { type: "object", properties: {} },
      run: () => ({ ...statsFor(messages), chats: messagesByChat.size, contacts: contacts.length, groups: groups.length })
    }
  ];
  
  const rpcOk = (id, result) => ({ jsonrpc: "2.0", id, result });
  const rpcErr = (id, code, message) => ({ jsonrpc: "2.0", id, error: { code, message } });
  
  async function handleRpc(msg) {
    const { id, method, params } = msg || {};
    if (id === undefined) return null; // notification, no response
  
    try {
      switch (method) {
        case "initialize":
          return rpcOk(id, {
            protocolVersion: params?.protocolVersion || "2025-03-26",
            capabilities: { tools: {} },
            serverInfo: { name: "whatsapp-connector", version: "2.1.0" }
          });
        case "ping":
          return rpcOk(id, {});
        case "tools/list":
          return rpcOk(id, {
            tools: TOOLS.map(({ name, description, inputSchema }) => ({ name, description, inputSchema }))
          });
        case "tools/call": {
          const tool = TOOLS.find(t => t.name === params?.name);
          if (!tool) return rpcErr(id, -32602, `Unknown tool: ${params?.name}`);
          const out = await tool.run(params?.arguments || {});
          return rpcOk(id, { content: [{ type: "text", text: JSON.stringify(out) }] });
        }
        default:
          return rpcErr(id, -32601, `Method not found: ${method}`);
      }
    } catch (e) {
      return rpcErr(id, -32603, e.message || "Internal error");
    }
  }
  
  const mcpHandler = wrap(async (req, res) => {
    const body = req.body;
    if (Array.isArray(body)) {
      const out = (await Promise.all(body.map(handleRpc))).filter(Boolean);
      return out.length ? res.json(out) : res.status(202).end();
    }
    const out = await handleRpc(body);
    if (!out) return res.status(202).end();
    res.json(out);
  });
  
  // Tunnel / connector route: temporary token in the URL path
  app.post("/mcp/:token", requireMcpToken, mcpHandler);
  app.get("/mcp/:token", requireMcpToken, (req, res) => res.status(405).json({ error: "Use POST for MCP requests" }));
  app.delete("/mcp/:token", requireMcpToken, (req, res) => res.status(200).end());
  
  // Local route (blocked through the tunnel by the tunnel guard; API_KEY applies if set)
  app.post("/mcp", mcpHandler);
  app.get("/mcp", (req, res) => res.status(405).json({ error: "Use POST for MCP requests" }));
  app.delete("/mcp", (req, res) => res.status(200).end());
  
  // SPA fallback for browser navigation routes (except API and MCP)
  app.use((req, res, next) => {
    if (!req.path.startsWith("/api") && !req.path.startsWith("/mcp") && req.accepts("html")) {
      const indexPath = path.join(frontendDist, "index.html");
      if (fs.existsSync(indexPath)) {
        return res.sendFile(indexPath);
      }
    }
    next();
  });

  // 404 fallback (never echoes /mcp paths, since they contain the token)
  app.use((req, res) => {
    const body = { error: "Endpoint not found", hint: "See GET / for all endpoints" };
    if (!req.path.startsWith("/mcp")) body.path = req.path;
    res.status(404).json(body);
  });
  
  // ---------------- START SERVER ----------------
  
  app.listen(PORT, HOST, () => {
    console.log(`API running at http://${HOST}:${PORT}`);
    console.log(`Tunnel guard: ${TUNNEL_GUARD ? "ON" : "OFF"} | Tokens file: ${TOKENS_FILE}`);
    if (HOST !== "127.0.0.1" && HOST !== "localhost" && !API_KEY) {
      console.warn("WARNING: server is network-accessible and API_KEY is not set. Anyone can read your messages.");
    }
  });
  
  connectWhatsApp().catch(error => {
    console.error("WhatsApp startup failed:", error);
  });