import React, { useState, useMemo, useEffect, useCallback } from "react";
import { Search, Filter, ChevronDown, X, PanelLeftClose } from "lucide-react";
import { PullRequest } from "@/types/pr";
import { PullRequestListItem } from "./pull-request-list-item";
import { BrandLogo } from "./brand-logo";
import { cn } from "@/lib/utils";

interface PullRequestSidebarProps {
  pullRequests: PullRequest[];
  selectedPr: PullRequest | null;
  onSelectPr: (pr: PullRequest) => void;
  isOpen: boolean;
  onToggleOpen: () => void;
}

type TabType = "all" | "reviewing" | "authored";

const MIN_SIDEBAR_WIDTH = 280;
const MAX_SIDEBAR_WIDTH = 720;
const DEFAULT_SIDEBAR_WIDTH = 420;
const SNAP_THRESHOLD = 8;
const SNAP_POINTS = [340, 420, 540];

export function PullRequestSidebar({
  pullRequests,
  selectedPr,
  onSelectPr,
  isOpen,
  onToggleOpen,
}: PullRequestSidebarProps) {
  const [activeTab, setActiveTab] = useState<TabType>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedGroup, setSelectedGroup] = useState<string>("Authored");

  // Resizable sidebar width state & mouse Y for floating HUD badge
  const [sidebarWidth, setSidebarWidth] = useState<number>(DEFAULT_SIDEBAR_WIDTH);
  const [isResizing, setIsResizing] = useState(false);
  const [mouseY, setMouseY] = useState<number>(200);

  // Restore saved width from localStorage if available
  useEffect(() => {
    try {
      const saved = localStorage.getItem("praxd:sidebar-width");
      if (saved) {
        const parsed = parseInt(saved, 10);
        if (!isNaN(parsed) && parsed >= MIN_SIDEBAR_WIDTH && parsed <= MAX_SIDEBAR_WIDTH) {
          setSidebarWidth(parsed);
        }
      }
    } catch {
      // localStorage may be restricted in sandboxes
    }
  }, []);

  // Resizing mouse drag handlers with magnetic snapping
  const handleStartResizing = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setMouseY(e.clientY);
    setIsResizing(true);
  }, []);

  const handleStopResizing = useCallback(() => {
    setIsResizing(false);
  }, []);

  const handleResize = useCallback(
    (e: MouseEvent) => {
      if (isResizing) {
        setMouseY(e.clientY);
        const maxWidthBound = Math.min(MAX_SIDEBAR_WIDTH, Math.floor(window.innerWidth * 0.6));
        let calculatedWidth = Math.min(Math.max(e.clientX, MIN_SIDEBAR_WIDTH), maxWidthBound);

        // Magnetic snapping to ergonomic snap points (Default 420px, Compact 340px, Wide 540px)
        for (const snap of SNAP_POINTS) {
          if (Math.abs(calculatedWidth - snap) <= SNAP_THRESHOLD) {
            calculatedWidth = snap;
            break;
          }
        }

        setSidebarWidth(calculatedWidth);
        try {
          localStorage.setItem("praxd:sidebar-width", calculatedWidth.toString());
        } catch {
          // ignore
        }
      }
    },
    [isResizing]
  );

  const handleResetWidth = useCallback(() => {
    setSidebarWidth(DEFAULT_SIDEBAR_WIDTH);
    try {
      localStorage.setItem("praxd:sidebar-width", DEFAULT_SIDEBAR_WIDTH.toString());
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    if (isResizing) {
      window.addEventListener("mousemove", handleResize);
      window.addEventListener("mouseup", handleStopResizing);
      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";
    }

    return () => {
      window.removeEventListener("mousemove", handleResize);
      window.removeEventListener("mouseup", handleStopResizing);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
  }, [isResizing, handleResize, handleStopResizing]);

  // Filtering based on Tab and Search query
  const filteredPrs = useMemo(() => {
    return pullRequests.filter((pr) => {
      // 1. Tab filter
      if (activeTab === "authored" && pr.category !== "authored") return false;
      if (activeTab === "reviewing" && pr.category !== "reviewing") return false;

      // 2. Search query filter (matches title, repoOwner, repoName, headRef, author, number)
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase().trim();
        const matchesTitle = pr.title.toLowerCase().includes(query);
        const matchesRepo = `${pr.repoOwner}/${pr.repoName}`.toLowerCase().includes(query);
        const matchesBranch = pr.headRef.toLowerCase().includes(query) || pr.baseRef.toLowerCase().includes(query);
        const matchesAuthor = pr.author.login.toLowerCase().includes(query) || (pr.author.name?.toLowerCase().includes(query) ?? false);
        const matchesNumber = pr.number.toString() === query || `#${pr.number}` === query;

        return matchesTitle || matchesRepo || matchesBranch || matchesAuthor || matchesNumber;
      }

      return true;
    });
  }, [pullRequests, activeTab, searchQuery]);

  // Tab counts for badge display
  const tabCounts = useMemo(
    () => ({
      all: pullRequests.length,
      reviewing: pullRequests.filter((p) => p.category === "reviewing").length,
      authored: pullRequests.filter((p) => p.category === "authored").length,
    }),
    [pullRequests]
  );

  // Keyboard navigation for PR list
  const handleListKeyDown = (e: React.KeyboardEvent) => {
    if (filteredPrs.length === 0) return;
    const currentIndex = filteredPrs.findIndex((p) => p.id === selectedPr?.id);

    if (e.key === "ArrowDown") {
      e.preventDefault();
      const nextIndex = currentIndex < filteredPrs.length - 1 ? currentIndex + 1 : 0;
      onSelectPr(filteredPrs[nextIndex]);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      const prevIndex = currentIndex > 0 ? currentIndex - 1 : filteredPrs.length - 1;
      onSelectPr(filteredPrs[prevIndex]);
    }
  };

  if (!isOpen) {
    return null;
  }

  return (
    <aside
      style={{ ["--sidebar-width" as any]: `${sidebarWidth}px` }}
      className={cn(
        "relative shrink-0 border-r border-praxd-border-soft bg-praxd-sidebar flex flex-col h-full select-none",
        "w-full md:w-[var(--sidebar-width)]"
      )}
      aria-label="Pull requests inbox"
    >
      {/* Top Header Region: Tabs & Sidebar close button */}
      <div className="p-3 pb-2 space-y-2.5 border-b border-praxd-border-soft">
        <div className="relative flex items-center justify-center min-h-[32px]">
          {/* Brand Logo placed on the left for balance */}
          <div className="absolute left-0 flex items-center gap-1.5" title="PRAXD PR Workspace">
            <BrandLogo size="sm" />
          </div>

          {/* Centered Segmented Tabs: All / Reviewing / Authored */}
          <div
            role="tablist"
            aria-label="PR Inbox View Filter"
            className="flex items-center p-0.5 rounded-lg bg-[#202020] border border-praxd-border-soft shadow-inner"
          >
            {(["all", "reviewing", "authored"] as TabType[]).map((tab) => {
              const label = tab === "all" ? "All" : tab === "reviewing" ? "Reviewing" : "Authored";
              const count = tabCounts[tab];
              const isActive = activeTab === tab;
              return (
                <button
                  key={tab}
                  role="tab"
                  aria-selected={isActive}
                  aria-label={label}
                  onClick={() => setActiveTab(tab)}
                  className={cn(
                    "flex items-center gap-1.5 px-2.5 py-1 text-[12px] font-medium rounded-md transition-all duration-150 capitalize focus:outline-none focus-visible:ring-1 focus-visible:ring-praxd-blue",
                    isActive
                      ? "bg-[#2e2e2e] text-praxd-text shadow-sm"
                      : "text-praxd-text-muted hover:text-praxd-text-secondary hover:bg-[#252525]"
                  )}
                >
                  <span>{label}</span>
                  <span
                    className={cn(
                      "text-[10px] px-1.5 py-0.2 rounded-full font-mono tabular-nums leading-none",
                      isActive
                        ? "bg-white/10 text-white"
                        : "bg-neutral-800 text-neutral-400"
                    )}
                  >
                    {count}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Toggle sidebar button placed on the right */}
          <button
            type="button"
            onClick={onToggleOpen}
            className="absolute right-0 p-1.5 rounded-md hover:bg-[#222222] text-praxd-text-secondary hover:text-praxd-text transition-colors"
            title="Collapse inbox (Ctrl+B)"
            aria-label="Collapse inbox sidebar"
          >
            <PanelLeftClose className="w-4 h-4" />
          </button>
        </div>

        {/* Search & Filter Bar */}
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-praxd-text-muted pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search pull requests"
              className="w-full bg-[#141414] border border-praxd-border-soft focus:border-praxd-border focus:ring-1 focus:ring-praxd-blue rounded-md pl-8 pr-7 py-1.5 text-[12px] text-praxd-text placeholder-praxd-text-muted transition-colors outline-none"
              aria-label="Search pull requests"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-praxd-text-muted hover:text-praxd-text"
                aria-label="Clear search"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Filter button with active indicator */}
          <button
            type="button"
            className={cn(
              "p-1.5 rounded-md border border-praxd-border-soft transition-colors",
              searchQuery
                ? "bg-praxd-blue/10 border-praxd-blue/40 text-praxd-blue"
                : "hover:bg-[#202020] text-praxd-text-secondary"
            )}
            title="Filter options"
            aria-label="Filter pull requests"
          >
            <Filter className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Group Selector (Screenshot displays "Authored ⌵") */}
        <div className="flex items-center justify-between text-[11px] text-praxd-text-muted pt-0.5">
          <button
            type="button"
            className="flex items-center gap-1 hover:text-praxd-text text-praxd-text-secondary font-medium transition-colors"
            aria-haspopup="listbox"
          >
            <span>{selectedGroup}</span>
            <ChevronDown className="w-3 h-3 text-praxd-text-muted" />
          </button>

          <span className="text-[10px] text-praxd-text-muted">
            {filteredPrs.length} {filteredPrs.length === 1 ? "pull request" : "pull requests"}
          </span>
        </div>
      </div>

      {/* PR Rows List */}
      <div
        role="listbox"
        aria-label="Pull requests"
        tabIndex={0}
        onKeyDown={handleListKeyDown}
        className="flex-1 overflow-y-auto p-2 space-y-1 focus:outline-none"
      >
        {filteredPrs.length === 0 ? (
          <div className="p-6 text-center text-praxd-text-muted space-y-1.5">
            <p className="text-[13px] font-medium text-praxd-text-secondary">No pull requests found</p>
            <p className="text-[11px]">
              {searchQuery ? `No matches for "${searchQuery}".` : "No pull requests match this filter."}
            </p>
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="mt-2 text-[12px] text-praxd-blue hover:underline"
              >
                Clear search
              </button>
            )}
          </div>
        ) : (
          filteredPrs.map((pr) => (
            <PullRequestListItem
              key={pr.id}
              pr={pr}
              isSelected={selectedPr?.id === pr.id}
              onSelect={onSelectPr}
            />
          ))
        )}
      </div>

      {/* Sleek, Minimalist Resizer Handle (desktop only - no aggressive blue colors) */}
      <div
        role="separator"
        aria-orientation="vertical"
        aria-label="Resize pull requests sidebar"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "ArrowLeft") {
            setSidebarWidth((prev) => Math.max(MIN_SIDEBAR_WIDTH, prev - 12));
          } else if (e.key === "ArrowRight") {
            setSidebarWidth((prev) => Math.min(MAX_SIDEBAR_WIDTH, prev + 12));
          } else if (e.key === "Enter" || e.key === " ") {
            handleResetWidth();
          }
        }}
        onMouseDown={handleStartResizing}
        onDoubleClick={handleResetWidth}
        className={cn(
          "hidden md:flex absolute top-0 -right-2 w-4 h-full cursor-col-resize z-30 select-none group items-center justify-center transition-colors",
          isResizing ? "bg-white/[0.03]" : "hover:bg-white/[0.015]"
        )}
        title="Drag to resize, double-click to reset (420px)"
      >
        {/* Subtle, refined vertical line */}
        <div
          className={cn(
            "w-[1px] h-full transition-all duration-150",
            isResizing
              ? "bg-neutral-300 shadow-[0_0_8px_rgba(255,255,255,0.2)]"
              : "bg-transparent group-hover:bg-neutral-500/50"
          )}
        />

        {/* Center Pill Grab Indicator (Linear/macOS style) */}
        <div
          className={cn(
            "absolute top-1/2 -translate-y-1/2 w-1 rounded-full transition-all duration-200 pointer-events-none",
            isResizing
              ? "h-10 bg-neutral-200 shadow-[0_0_8px_rgba(255,255,255,0.3)] opacity-100 scale-105"
              : "h-6 bg-neutral-500/50 opacity-0 group-hover:opacity-100 group-hover:h-8"
          )}
        />
      </div>

      {/* Floating Live Dimension HUD Tooltip while dragging */}
      {isResizing && (
        <div
          className="fixed z-50 pointer-events-none px-2.5 py-1 rounded-lg bg-[#181818]/95 backdrop-blur-md border border-praxd-border-soft shadow-2xl text-[11px] font-mono text-praxd-text tabular-nums flex items-center gap-1.5 select-none animate-in fade-in zoom-in-95 duration-100"
          style={{
            left: `${sidebarWidth + 14}px`,
            top: `${Math.max(60, Math.min(mouseY - 14, typeof window !== "undefined" ? window.innerHeight - 50 : 200))}px`,
          }}
        >
          <span className="font-semibold">{sidebarWidth}px</span>
          {sidebarWidth === DEFAULT_SIDEBAR_WIDTH && (
            <span className="text-[10px] px-1.5 py-0.2 rounded bg-neutral-800 text-praxd-green font-sans font-medium border border-praxd-green/30">
              Default
            </span>
          )}
          {sidebarWidth === 340 && (
            <span className="text-[10px] px-1.5 py-0.2 rounded bg-neutral-800 text-praxd-blue font-sans font-medium border border-praxd-blue/30">
              Compact
            </span>
          )}
          {sidebarWidth === 540 && (
            <span className="text-[10px] px-1.5 py-0.2 rounded bg-neutral-800 text-orange-400 font-sans font-medium border border-orange-500/30">
              Wide
            </span>
          )}
        </div>
      )}
    </aside>
  );
}
