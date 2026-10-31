import React from "react";
import { Loader2 } from "lucide-react";

export function Loading({ message = "Loading data...", size = 28 }) {
  return (
    <div className="loading-state">
      <Loader2 size={size} className="spin-icon loading-spinner" />
      <p>{message}</p>
    </div>
  );
}

export default Loading;
