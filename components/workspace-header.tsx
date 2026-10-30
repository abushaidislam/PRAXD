import React from "react";
import {
  GitPullRequest,
  ShieldAlert,
  ExternalLink,
  MessageSquare,
  GitMerge,
  ChevronDown,
  PanelLeftOpen,
} from "lucide-react";
import { PullRequest } from "@/types/pr";
import { cn } from "@/lib/utils";

interface WorkspaceHeaderProps {
  pr: PullRequest | null;
  activeView: "summary" | "code";
  onViewChange: (view: "summary" | "code") => void;
  isSidebarOpen: boolean;
  onToggleSidebar: () => void;
}

export function WorkspaceHeader({
  pr,
  activeView,
  onViewChange,
  isSidebarOpen,
  onToggleSidebar,
}: WorkspaceHeaderProps) {
  const hasShield = pr?.title.toLowerCase().includes("sentinel");

  return (
    <header className="relative h-[48px] px-3.5 border-b border-praxd-border-soft bg-praxd-bg flex items-center justify-between shrink-0 select-none z-10">
      {/* Left PR identity & sidebar reveal toggle */}
      <div className="flex items-center gap-2.5 min-w-0 flex-1 max-w-[calc(50%-100px)] pr-3 z-10">
        {!isSidebarOpen && (
          <button
            type="button"
            onClick={onToggleSidebar}
            className="p-1.5 rounded-md hover:bg-[#202020] text-praxd-text-secondary hover:text-praxd-text transition-colors mr-1 shrink-0"
            title="Expand inbox (Ctrl+B)"
            aria-label="Expand inbox sidebar"
          >
            <PanelLeftOpen className="w-4 h-4" />
          </button>
        )}

        <div className="flex items-center gap-2 min-w-0">
          <div className="flex items-center gap-1.5 shrink-0">
            <GitPullRequest className="w-4 h-4 text-praxd-blue" />
            {hasShield && <ShieldAlert className="w-4 h-4 text-praxd-blue" />}
          </div>

          <h1
            className="text-[13px] font-medium text-praxd-text truncate"
            title={pr?.title || "No PR Selected"}
          >
            {pr?.title || "Select a pull request"}
          </h1>
        </div>
      </div>

      {/* Center: Summary / Code Segmented Tabs (Always exactly centered in main content) */}
      <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-20 pointer-events-auto">
        <div
          role="tablist"
          aria-label="Workspace View"
          className="flex items-center p-0.5 rounded-lg bg-[#202020] border border-praxd-border-soft shadow-inner"
        >
          <button
            role="tab"
            aria-selected={activeView === "summary"}
            onClick={() => onViewChange("summary")}
            className={cn(
              "px-3.5 py-1 text-[12px] font-medium rounded-md transition-all duration-150",
              activeView === "summary"
                ? "bg-[#2e2e2e] text-praxd-text shadow-sm"
                : "text-praxd-text-muted hover:text-praxd-text-secondary hover:bg-[#252525]"
            )}
          >
            Summary
          </button>
          <button
            role="tab"
            aria-selected={activeView === "code"}
            onClick={() => onViewChange("code")}
            className={cn(
              "px-3.5 py-1 text-[12px] font-medium rounded-md transition-all duration-150",
              activeView === "code"
                ? "bg-[#2e2e2e] text-praxd-text shadow-sm"
                : "text-praxd-text-muted hover:text-praxd-text-secondary hover:bg-[#252525]"
            )}
          >
            Code
          </button>
        </div>
      </div>

      {/* Right Actions: External link, Chat affordance, Merge guardrail button */}
      <div className="flex items-center justify-end gap-2 shrink-0 z-10 pl-3">
        {/* External GitHub link */}
        <a
          href={pr ? `https://github.com/${pr.repoOwner}/${pr.repoName}/pull/${pr.number}` : "#"}
          target="_blank"
          rel="noopener noreferrer"
          className="p-1.5 rounded-md hover:bg-[#202020] text-praxd-text-muted hover:text-praxd-text transition-colors"
          title="Open on GitHub"
          aria-label="Open on GitHub"
        >
          <ExternalLink className="w-4 h-4" />
        </a>

        {/* Chat affordance (disabled in MVP per UI_UX_SPEC section 9) */}
        <button
          type="button"
          disabled
          className="flex items-center gap-1 px-2.5 py-1 text-[12px] font-medium rounded-md bg-[#202020] border border-praxd-border-soft text-praxd-text-muted cursor-not-allowed opacity-70"
          title="PR Chat assistant is coming in a later release"
          aria-label="PR Chat assistant (Coming soon)"
        >
          <MessageSquare className="w-3.5 h-3.5" />
          <span>Chat</span>
        </button>

        {/* Merge Guardrail Button (Disabled with tooltip in read-only MVP per ADR-0002) */}
        <div className="relative group">
          <button
            type="button"
            disabled
            className="flex items-center gap-1.5 px-3 py-1 rounded-md text-[12px] font-medium bg-white text-black opacity-80 cursor-not-allowed hover:bg-neutral-100 transition-colors shadow-sm"
            aria-label="Merge pull request (Disabled in read-only MVP)"
          >
            <GitMerge className="w-3.5 h-3.5 text-black" />
            <span>Merge</span>
            <ChevronDown className="w-3 h-3 text-neutral-600" />
          </button>
          <div className="absolute right-0 top-full mt-1.5 hidden group-hover:flex flex-col z-50 p-2 bg-[#252525] border border-praxd-border text-[11px] text-praxd-text-secondary rounded shadow-lg whitespace-nowrap">
            <span>Merge is disabled in read-only MVP mode;</span>
            <span>please merge via GitHub.</span>
          </div>
        </div>
      </div>
    </header>
  );
}
