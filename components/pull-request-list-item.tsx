import React from "react";
import { GitPullRequest, ShieldAlert } from "lucide-react";
import { PullRequest } from "@/types/pr";
import { cn } from "@/lib/utils";

interface PullRequestListItemProps {
  pr: PullRequest;
  isSelected: boolean;
  onSelect: (pr: PullRequest) => void;
}

/**
 * ⚡ Performance Optimization: Memoized with React.memo to avoid re-rendering
 * all list items in the sidebar when resizing the inbox panel or selecting a different PR.
 * Re-render count on PR selection drops from O(N) to O(1) (only previous & next selected item re-render).
 */
export const PullRequestListItem = React.memo(function PullRequestListItem({
  pr,
  isSelected,
  onSelect,
}: PullRequestListItemProps) {
  const isSelectedStyle = isSelected
    ? "bg-[#212121] border-praxd-border shadow-sm relative before:absolute before:left-0 before:top-2 before:bottom-2 before:w-[2px] before:rounded-r before:bg-praxd-blue"
    : "hover:bg-[#1a1a1a] border-transparent";

  // Check if title mentions Sentinel or Shield
  const hasShield = pr.title.toLowerCase().includes("sentinel");
  const isMerged = pr.state === "merged";

  return (
    <button
      type="button"
      onClick={() => onSelect(pr)}
      className={cn(
        "w-full text-left p-2.5 rounded-lg border transition-all flex items-start gap-2.5 group focus:outline-none focus-visible:ring-1 focus-visible:ring-praxd-blue",
        isSelectedStyle
      )}
      aria-selected={isSelected}
      role="option"
    >
      {/* PR Icon with state indicator */}
      <div className="relative mt-0.5 shrink-0 text-praxd-text-secondary group-hover:text-praxd-text">
        <GitPullRequest className={cn("w-4 h-4", isMerged ? "text-praxd-purple" : "text-[#8a8a8a]")} />
        {pr.checksStatus === "success" && !isMerged && (
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
                isSelected ? "text-praxd-text font-semibold" : "text-[#d1d1d1] group-hover:text-praxd-text"
              )}
              title={pr.title}
            >
              {pr.title}
            </span>
          </div>
          <span className="text-[11px] text-praxd-text-muted shrink-0 tabular-nums">
            {pr.relativeTime}
          </span>
        </div>

        {/* Subtitle / Author Avatar + Name + Repository/Branch + Diff Stats */}
        <div className="flex items-center justify-between gap-2 mt-1.5 text-[11px] text-praxd-text-muted">
          <div className="flex items-center gap-1.5 min-w-0">
            {/* Author Avatar with fallback */}
            {pr.author?.avatarUrl ? (
              <img
                src={pr.author.avatarUrl}
                alt={pr.author.login}
                className="w-3.5 h-3.5 rounded-full object-cover shrink-0 ring-1 ring-white/10 bg-[#252525]"
                onError={(e) => {
                  (e.target as HTMLElement).style.display = "none";
                }}
              />
            ) : (
              <div className="w-3.5 h-3.5 rounded-full bg-[#2a2a2a] ring-1 ring-white/10 flex items-center justify-center text-[8px] font-bold text-neutral-300 shrink-0">
                {(pr.author?.login || "U").charAt(0).toUpperCase()}
              </div>
            )}

            <span className="truncate max-w-[220px]">
              <span className="text-praxd-text-secondary font-medium">{pr.author?.login || pr.repoOwner}</span>
              <span className="text-neutral-500">/... {pr.headRef.length > 20 ? `${pr.headRef.slice(0, 20)}...` : pr.headRef}</span>
            </span>
          </div>

          <div className="flex items-center gap-1 shrink-0 font-mono text-[10px] tabular-nums">
            <span className="text-praxd-green font-medium">+{pr.additions}</span>
            <span className="text-praxd-red font-medium">-{pr.deletions}</span>
          </div>
        </div>
      </div>
    </button>
  );
});
