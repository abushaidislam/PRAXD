import React from "react";
import { GitPullRequest, ShieldAlert } from "lucide-react";
import { PullRequest } from "@/types/pr";
import { cn } from "@/lib/utils";

interface PullRequestListItemProps {
  pr: PullRequest;
  isSelected: boolean;
  onSelect: (pr: PullRequest) => void;
}

export function PullRequestListItem({
  pr,
  isSelected,
  onSelect,
}: PullRequestListItemProps) {
  const isSelectedStyle = isSelected
    ? "bg-[#212121] border-praxd-border shadow-sm"
    : "hover:bg-[#1a1a1a] border-transparent";

  // Check if title mentions Sentinel or Shield
  const hasShield = pr.title.toLowerCase().includes("sentinel");

  return (
    <button
      type="button"
      onClick={() => onSelect(pr)}
      className={cn(
        "w-full text-left p-2.5 rounded-lg border transition-colors flex items-start gap-2.5 group focus:outline-none focus-visible:ring-1 focus-visible:ring-praxd-blue",
        isSelectedStyle
      )}
      aria-selected={isSelected}
      role="option"
    >
      {/* PR Icon with state indicator */}
      <div className="relative mt-0.5 shrink-0 text-praxd-text-secondary group-hover:text-praxd-text">
        <GitPullRequest className="w-4 h-4 text-[#8a8a8a]" />
        {pr.checksStatus === "success" && (
          <span className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 rounded-full bg-praxd-green ring-2 ring-[#171717]" />
        )}
      </div>

      {/* Main PR Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 min-w-0">
            {hasShield && (
              <ShieldAlert className="w-3.5 h-3.5 text-praxd-blue shrink-0 inline-block" />
            )}
            <span
              className={cn(
                "text-[13px] font-medium truncate",
                isSelected ? "text-praxd-text" : "text-[#d1d1d1] group-hover:text-praxd-text"
              )}
              title={pr.title}
            >
              {pr.title}
            </span>
          </div>
          <span className="text-[11px] text-praxd-text-muted shrink-0">
            {pr.relativeTime}
          </span>
        </div>

        {/* Subtitle / Repository + Branch + Diff Stats */}
        <div className="flex items-center justify-between gap-2 mt-1 text-[11px] text-praxd-text-muted">
          <span className="truncate max-w-[240px]">
            {pr.repoOwner}/... {pr.headRef.length > 22 ? `${pr.headRef.slice(0, 22)}...` : pr.headRef}
          </span>
          <div className="flex items-center gap-1 shrink-0 font-mono text-[10px]">
            <span className="text-praxd-green">+{pr.additions}</span>
            <span className="text-praxd-red">-{pr.deletions}</span>
          </div>
        </div>
      </div>
    </button>
  );
}
