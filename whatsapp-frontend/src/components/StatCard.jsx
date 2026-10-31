import React from "react";

export function StatCard({ icon: Icon, label, value, subtitle, color = "green", onClick }) {
  const displayVal = value !== null && value !== undefined ? Number(value).toLocaleString() : "—";

  return (
    <div className={`stat-card-modern ${onClick ? "clickable" : ""}`} onClick={onClick}>
      <div className={`stat-card-icon-wrap color-${color}`}>
        {Icon && <Icon size={22} />}
      </div>
      <div className="stat-card-info">
        <span className="stat-card-label">{label}</span>
        <h3 className="stat-card-value">{displayVal}</h3>
        {subtitle && <span className="stat-card-subtitle">{subtitle}</span>}
      </div>
    </div>
  );
}

export default StatCard;
