"use client";

import React, { useState } from "react";
import {
  GitPullRequest,
  ShieldAlert,
  ExternalLink,
  GitMerge,
  ChevronDown,
  PanelLeftOpen,
  Check,
  Keyboard,
} from "lucide-react";
import { PullRequest } from "@/types/pr";
import { cn } from "@/lib/utils";
import { BrandLogo } from "@/components/brand-logo";
import { MergeModal } from "@/components/merge-modal";
import { CheckoutCommandDropdown } from "@/components/checkout-command-dropdown";

interface WorkspaceHeaderProps {
  pr: PullRequest | null;
  activeView: "summary" | "code";
  onViewChange: (view: "summary" | "code") => void;
  isSidebarOpen: boolean;
  onToggleSidebar: () => void;
  onMergeSuccess?: () => void;
  onOpenShortcuts?: () => void;
}

export function WorkspaceHeader({
  pr,
  activeView,
  onViewChange,
  isSidebarOpen,
  onToggleSidebar,
  onMergeSuccess,
  onOpenShortcuts,
}: WorkspaceHeaderProps) {
  const [isMergeModalOpen, setIsMergeModalOpen] = useState(false);
  const hasShield = pr?.title.toLowerCase().includes("sentinel");
  const isMerged = pr?.state === "merged";
  const isClosed = pr?.state === "closed";

  const handleMergeSuccessInternal = () => {
    if (onMergeSuccess) {
      onMergeSuccess();
    }
  };

  return (
    <>
      <header className="relative h-[48px] px-3.5 bg-praxd-bg flex items-center justify-between shrink-0 select-none z-30">
        {/* Left PR identity & sidebar reveal toggle */}
        <div className="flex items-center gap-2.5 min-w-0 flex-1 max-w-[calc(50%-80px)] sm:max-w-[calc(50%-100px)] pr-3 z-10">
          {!isSidebarOpen && (
            <div className="flex items-center gap-1.5 shrink-0 mr-1.5">
              <button
                type="button"
                onClick={onToggleSidebar}
                className="p-1.5 rounded-md hover:bg-[#202020] text-praxd-text-secondary hover:text-praxd-text transition-colors shrink-0"
                title="Expand inbox (Ctrl+B)"
                aria-label="Expand inbox sidebar"
              >
                <PanelLeftOpen className="w-4 h-4" />
              </button>
              <BrandLogo size="sm" showText />
              <span className="text-praxd-border-soft mx-0.5 select-none">/</span>
            </div>
          )}

          <div className="flex items-center gap-2 min-w-0">
            <div className="flex items-center gap-1.5 shrink-0">
              <GitPullRequest className={cn("w-4 h-4", isMerged ? "text-praxd-purple" : "text-praxd-blue")} />
              {hasShield && <ShieldAlert className="w-4 h-4 text-praxd-blue" />}
            </div>

            {pr && (
              <span className="text-[11px] font-mono text-praxd-text-muted bg-[#1c1c1c] px-1.5 py-0.5 rounded border border-praxd-border-soft shrink-0">
                #{pr.number}
              </span>
            )}

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
              aria-label="Summary"
              aria-selected={activeView === "summary"}
              onClick={() => onViewChange("summary")}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1 text-[12px] font-medium rounded-md transition-all duration-150 focus:outline-none focus-visible:ring-1 focus-visible:ring-praxd-blue",
                activeView === "summary"
                  ? "bg-[#2e2e2e] text-praxd-text shadow-sm"
                  : "text-praxd-text-muted hover:text-praxd-text-secondary hover:bg-[#252525]"
              )}
              title="Summary View (Shortcut: 1)"
            >
              <span>Summary</span>
              <kbd className="hidden sm:inline-block text-[10px] font-mono px-1 py-0.2 rounded bg-black/40 border border-white/10 text-praxd-text-muted">
                1
              </kbd>
            </button>
            <button
              role="tab"
              aria-label="Code"
              aria-selected={activeView === "code"}
              onClick={() => onViewChange("code")}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1 text-[12px] font-medium rounded-md transition-all duration-150 focus:outline-none focus-visible:ring-1 focus-visible:ring-praxd-blue",
                activeView === "code"
                  ? "bg-[#2e2e2e] text-praxd-text shadow-sm"
                  : "text-praxd-text-muted hover:text-praxd-text-secondary hover:bg-[#252525]"
              )}
              title="Code View (Shortcut: 2)"
            >
              <span>Code</span>
              <kbd className="hidden sm:inline-block text-[10px] font-mono px-1 py-0.2 rounded bg-black/40 border border-white/10 text-praxd-text-muted">
                2
              </kbd>
            </button>
          </div>
        </div>

        {/* Right Actions: Checkout Dropdown, External GitHub link, Shortcuts button, Merge Action */}
        <div className="flex items-center justify-end gap-1.5 shrink-0 z-10 pl-3">
          {/* Terminal Checkout Command Dropdown */}
          {pr && (
            <div className="hidden sm:block">
              <CheckoutCommandDropdown pr={pr} variant="header" />
            </div>
          )}

          {/* Keyboard Shortcuts Cheatsheet Button */}
          {onOpenShortcuts && (
            <button
              type="button"
              onClick={onOpenShortcuts}
              className="p-1.5 rounded-md hover:bg-[#202020] text-praxd-text-muted hover:text-praxd-text transition-colors"
              title="Keyboard shortcuts (?)"
              aria-label="Open keyboard shortcuts guide"
            >
              <Keyboard className="w-4 h-4" />
            </button>
          )}

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

          {/* Merge Action Button & Status */}
          {isMerged ? (
            <div
              className="flex items-center gap-1.5 px-3 py-1 rounded-md text-[12px] font-medium bg-purple-950/60 border border-purple-800/60 text-purple-200 select-none"
              title="This pull request has been merged"
            >
              <Check className="w-3.5 h-3.5 text-purple-300" />
              <span>Merged</span>
            </div>
          ) : isClosed ? (
            <div
              className="flex items-center gap-1.5 px-3 py-1 rounded-md text-[12px] font-medium bg-[#242424] border border-praxd-border-soft text-praxd-text-muted select-none"
              title="This pull request is closed"
            >
              <span>Closed</span>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setIsMergeModalOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1 rounded-md text-[12px] font-medium bg-white text-black hover:bg-neutral-200 transition-colors shadow-sm font-semibold active:scale-[0.98]"
              aria-label="Merge pull request"
            >
              <GitMerge className="w-3.5 h-3.5 text-black" />
              <span>Merge</span>
              <ChevronDown className="w-3 h-3 text-neutral-600" />
            </button>
          )}
        </div>
      </header>

      {/* Merge Confirmation Modal */}
      {pr && (
        <MergeModal
          pr={pr}
          isOpen={isMergeModalOpen}
          onClose={() => setIsMergeModalOpen(false)}
          onMergeSuccess={handleMergeSuccessInternal}
        />
      )}
    </>
  );
}
