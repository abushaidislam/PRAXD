import React from "react";
import { Github } from "lucide-react";
import { BrandLogo } from "@/components/brand-logo";

interface DemoModeBadgeProps {
  isLiveMode: boolean;
  onToggleMode: () => void;
  onOpenConnectModal: () => void;
}

export function DemoModeBadge({
  isLiveMode,
  onToggleMode,
  onOpenConnectModal,
}: DemoModeBadgeProps) {
  return (
    <div
      role="status"
      aria-label="Workspace connection status"
      className="flex items-center justify-between px-3 py-1 bg-[#1a1a1a] border-b border-praxd-border-soft text-[11px] text-praxd-text-secondary select-none"
    >
      <div className="flex items-center gap-1.5 truncate">
        <BrandLogo size="xs" />
        <span className="font-medium text-praxd-text shrink-0">
          {isLiveMode ? "PRAXD Live Mode" : "PRAXD Phase 0 Fixture Mode"}
        </span>
        <span className="text-praxd-text-muted hidden sm:inline truncate">
          {isLiveMode
            ? "— Connected to GitHub REST API & PostgreSQL."
            : "— Realistic local test data active. Connect GitHub App to sync real PRs."}
        </span>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        <button
          type="button"
          onClick={onOpenConnectModal}
          className="flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium bg-[#242424] hover:bg-[#2e2e2e] text-praxd-text border border-praxd-border-soft transition-colors"
          title="Connect GitHub App Installation"
        >
          <Github className="w-3 h-3 text-praxd-text-secondary" />
          <span>Connect App</span>
        </button>

        <button
          type="button"
          onClick={onToggleMode}
          className="px-1.5 py-0.5 rounded text-[10px] bg-[#242424] hover:bg-[#2c2c2c] text-praxd-green font-mono border border-praxd-border-soft transition-colors"
          title="Toggle between Live API and Fixture Mode"
        >
          {isLiveMode ? "SWITCH TO FIXTURES" : "READ-ONLY MVP"}
        </button>
      </div>
    </div>
  );
}
