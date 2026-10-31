import React from "react";
import { Inbox } from "lucide-react";

export function EmptyState({
  icon: Icon = Inbox,
  title = "No data found",
  description = "No items match your criteria or none have been collected yet.",
  actionLabel,
  onAction,
}) {
  return (
    <div className="empty-state-card">
      <div className="empty-icon-wrapper">
        <Icon size={36} />
      </div>
      <h3>{title}</h3>
      <p>{description}</p>
      {actionLabel && onAction && (
        <button className="primary-button empty-action-btn" onClick={onAction}>
          {actionLabel}
        </button>
      )}
    </div>
  );
}

export default EmptyState;
