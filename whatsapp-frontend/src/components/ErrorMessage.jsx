import React from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";

export function ErrorMessage({ message, onRetry }) {
  if (!message) return null;

  return (
    <div className="error-banner-card">
      <div className="error-banner-content">
        <AlertTriangle size={20} className="error-banner-icon" />
        <div className="error-banner-text">
          <strong>Something went wrong</strong>
          <p>{message}</p>
        </div>
      </div>
      {onRetry && (
        <button className="error-retry-btn" onClick={onRetry}>
          <RefreshCw size={14} /> Retry
        </button>
      )}
    </div>
  );
}

export default ErrorMessage;
