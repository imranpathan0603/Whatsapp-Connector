import React from "react";
import { CheckCircle2, AlertCircle, Loader2, QrCode, PowerOff, RefreshCw } from "lucide-react";

export function StatusBadge({ status, size = "md" }) {
  const normalized = (status || "disconnected").toLowerCase();

  const configs = {
    connected: {
      label: "Connected",
      className: "status-badge-connected",
      icon: CheckCircle2,
    },
    connecting: {
      label: "Connecting...",
      className: "status-badge-connecting",
      icon: Loader2,
      spin: true,
    },
    qr: {
      label: "Waiting for QR Scan",
      className: "status-badge-qr",
      icon: QrCode,
    },
    reconnecting: {
      label: "Reconnecting...",
      className: "status-badge-reconnecting",
      icon: RefreshCw,
      spin: true,
    },
    logged_out: {
      label: "Logged Out",
      className: "status-badge-logged-out",
      icon: PowerOff,
    },
    error: {
      label: "Error",
      className: "status-badge-error",
      icon: AlertCircle,
    },
    disconnected: {
      label: "Disconnected",
      className: "status-badge-disconnected",
      icon: PowerOff,
    },
  };

  const current = configs[normalized] || configs.disconnected;
  const Icon = current.icon;

  return (
    <span className={`status-badge ${current.className} size-${size}`}>
      <Icon size={size === "sm" ? 13 : size === "lg" ? 18 : 15} className={current.spin ? "spin-icon" : ""} />
      <span>{current.label}</span>
    </span>
  );
}

export default StatusBadge;
