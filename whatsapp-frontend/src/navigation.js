import {
  LayoutDashboard,
  QrCode,
  MessageSquare,
  MessagesSquare,
  Users,
  FolderKanban,
  Image,
  Link2,
  Search,
  BarChart3,
  Settings,
  Sparkles,
  BrainCircuit,
  Sliders,
} from "lucide-react";

export const NAV_ITEMS = [
  { id: "overview", label: "Overview", icon: LayoutDashboard },
  { id: "connection", label: "WhatsApp Connection", icon: QrCode, highlight: true },
  { id: "messages", label: "Messages", icon: MessageSquare },
  { id: "chats", label: "Chats", icon: MessagesSquare },
  { id: "contacts", label: "Contacts", icon: Users },
  { id: "groups", label: "Groups", icon: FolderKanban },
  { id: "media", label: "Media", icon: Image },
  { id: "links", label: "Links", icon: Link2 },
  { id: "search", label: "Search", icon: Search },
  { id: "analytics", label: "Analytics", icon: BarChart3 },
  { id: "settings", label: "Connector Settings", icon: Settings },
];

export const AI_NAV_ITEMS = [
  { id: "ai-summary", label: "AI Summary", icon: Sparkles, badge: "AI" },
  { id: "ai-analytics", label: "AI Analytics", icon: BrainCircuit },
  { id: "ai-settings", label: "AI Settings", icon: Sliders },
];

export const ALL_NAV_ITEMS = [...NAV_ITEMS, ...AI_NAV_ITEMS];

export default {
  NAV_ITEMS,
  AI_NAV_ITEMS,
  ALL_NAV_ITEMS,
};
