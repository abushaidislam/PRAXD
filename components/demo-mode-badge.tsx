import React from "react";
import { Info } from "lucide-react";

export function DemoModeBadge() {
  return (
    <div
      role="status"
      aria-label="Local fixture demo mode"
      className="flex items-center justify-between px-3 py-1 bg-[#1a1a1a] border-b border-praxd-border-soft text-[11px] text-praxd-text-secondary select-none"
    >
      <div className="flex items-center gap-1.5">
        <Info className="w-3.5 h-3.5 text-praxd-blue" />
        <span className="font-medium text-praxd-text">PRAXD Phase 0 Fixture Mode</span>
        <span className="text-praxd-text-muted">— Local realistic test data active. External GitHub & AI services are disconnected.</span>
      </div>
      <div className="flex items-center gap-2">
        <span className="px-1.5 py-0.5 rounded text-[10px] bg-[#242424] text-praxd-green font-mono border border-praxd-border-soft">
          READ-ONLY MVP
        </span>
      </div>
    </div>
  );
}
