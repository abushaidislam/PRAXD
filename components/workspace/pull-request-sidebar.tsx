import React, { useState, useMemo, useEffect, useCallback, useRef } from "react";
import { Search, Filter, ChevronDown, X, PanelLeftClose, RefreshCw, Check, RotateCcw } from "lucide-react";
import { PullRequest, PRState } from "@/types/pr";
import { PullRequestListItem } from "./pull-request-list-item";
import { PRSidebarSkeleton } from "./pr-sidebar-skeleton";
import { BrandLogo } from "../ui/brand-logo";
import { cn } from "@/lib/utils";

interface PullRequestSidebarProps {
  pullRequests: PullRequest[];
  selectedPr: PullRequest | null;
  onSelectPr: (pr: PullRequest) => void;
  isOpen: boolean;
  onToggleOpen: () => void;
  hasMore?: boolean;
  isLoadingMore?: boolean;
  onLoadMore?: () => void;
  totalCount?: number | null;
  onSync?: () => Promise<void> | void;
  isSyncing?: boolean;
  isLoading?: boolean;
}

type TabType = "all" | "reviewing" | "authored";
type SortOption = "updated" | "created" | "changes" | "comments";
type FilterStateOption = "all" | "open" | "merged" | "closed";

const GROUP_OPTIONS = [
  "All PRs",
  "Authored",
  "Reviewing",
  "Open PRs",
  "Merged PRs",
  "Closed PRs",
] as const;

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
  hasMore = false,
  isLoadingMore = false,
  onLoadMore,
  totalCount = null,
  onSync,
  isSyncing = false,
  isLoading = false,
}: PullRequestSidebarProps) {
  const [activeTab, setActiveTab] = useState<TabType>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedGroup, setSelectedGroup] = useState<string>("All PRs");

  // Advanced Filtering & Sorting state
  const [filterState, setFilterState] = useState<FilterStateOption>("all");
  const [filterRepo, setFilterRepo] = useState<string>("all");
  const [sortBy, setSortBy] = useState<SortOption>("updated");
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [isGroupOpen, setIsGroupOpen] = useState(false);

  const filterRef = useRef<HTMLDivElement>(null);
  const groupRef = useRef<HTMLDivElement>(null);

  // Tab switch handler keeps group in sync
  const handleTabChange = useCallback((tab: TabType) => {
    setActiveTab(tab);
    if (tab === "all") setSelectedGroup("All PRs");
    else if (tab === "reviewing") setSelectedGroup("Reviewing");
    else if (tab === "authored") setSelectedGroup("Authored");
  }, []);

  // Group switch handler
  const handleGroupSelect = useCallback((group: string) => {
    setSelectedGroup(group);
    setIsGroupOpen(false);
    if (group === "All PRs") {
      setActiveTab("all");
      setFilterState("all");
    } else if (group === "Authored") {
      setActiveTab("authored");
    } else if (group === "Reviewing") {
      setActiveTab("reviewing");
    } else if (group === "Open PRs") {
      setFilterState("open");
    } else if (group === "Merged PRs") {
      setFilterState("merged");
    } else if (group === "Closed PRs") {
      setFilterState("closed");
    }
  }, []);

  // Close popovers on outside click or Escape key
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      if (filterRef.current && !filterRef.current.contains(target)) {
        setIsFilterOpen(false);
      }
      if (groupRef.current && !groupRef.current.contains(target)) {
        setIsGroupOpen(false);
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setIsFilterOpen(false);
        setIsGroupOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

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

  // Extract distinct repositories for filtering
  const availableRepos = useMemo(() => {
    const set = new Set<string>();
    pullRequests.forEach((pr) => {
      if (pr.repoName) set.add(pr.repoName);
    });
    return Array.from(set).sort();
  }, [pullRequests]);

  // Determine if any popover filter or custom sort is active
  const hasActiveFilters = useMemo(() => {
    return filterState !== "all" || filterRepo !== "all" || sortBy !== "updated";
  }, [filterState, filterRepo, sortBy]);

  const activeFiltersCount = useMemo(() => {
    let count = 0;
    if (filterState !== "all") count++;
    if (filterRepo !== "all") count++;
    if (sortBy !== "updated") count++;
    return count;
  }, [filterState, filterRepo, sortBy]);

  const handleResetFilters = useCallback(() => {
    setFilterState("all");
    setFilterRepo("all");
    setSortBy("updated");
  }, []);

  // Filtering based on Tab, Group, Search query, and Popover Filters
  const filteredPrs = useMemo(() => {
    const list = pullRequests.filter((pr) => {
      // 1. Tab filter
      if (activeTab === "authored" && pr.category !== "authored") return false;
      if (activeTab === "reviewing" && pr.category !== "reviewing") return false;

      // 2. State filter (from popover or group selector)
      const effectiveState =
        filterState !== "all"
          ? filterState
          : selectedGroup === "Open PRs"
          ? "open"
          : selectedGroup === "Merged PRs"
          ? "merged"
          : selectedGroup === "Closed PRs"
          ? "closed"
          : "all";

      if (effectiveState !== "all" && pr.state !== effectiveState) return false;

      // 3. Repository filter (from filter popover)
      if (filterRepo !== "all" && pr.repoName !== filterRepo) return false;

      // 5. Search query filter (matches title, repoOwner, repoName, headRef, author, number)
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase().trim();
        const matchesTitle = pr.title.toLowerCase().includes(query);
        const matchesRepo = `${pr.repoOwner}/${pr.repoName}`.toLowerCase().includes(query);
        const matchesBranch = pr.headRef.toLowerCase().includes(query) || pr.baseRef.toLowerCase().includes(query);
        const matchesAuthor = pr.author.login.toLowerCase().includes(query) || (pr.author.name?.toLowerCase().includes(query) ?? false);
        const matchesNumber = pr.number.toString() === query || `#${pr.number}` === query;

        if (!matchesTitle && !matchesRepo && !matchesBranch && !matchesAuthor && !matchesNumber) {
          return false;
        }
      }

      return true;
    });

    // 6. Sorting logic
    list.sort((a, b) => {
      if (sortBy === "created") {
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      }
      if (sortBy === "changes") {
        const changesA = (a.additions || 0) + (a.deletions || 0);
        const changesB = (b.additions || 0) + (b.deletions || 0);
        return changesB - changesA;
      }
      if (sortBy === "comments") {
        const commentsA = a.commentsCount ?? a.comments?.length ?? 0;
        const commentsB = b.commentsCount ?? b.comments?.length ?? 0;
        return commentsB - commentsA;
      }
      // Default: "updated"
      return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
    });

    return list;
  }, [pullRequests, activeTab, selectedGroup, filterState, filterRepo, searchQuery, sortBy]);

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
        {/* Row 1: Brand identity, Sync button & Collapse toggle button */}
        <div className="flex items-center justify-between min-h-[28px]">
          <div className="flex items-center gap-2" title="PRAXD PR Workspace">
            <BrandLogo size="sm" showText />
          </div>

          <div className="flex items-center gap-1">
            {onSync && (
              <button
                type="button"
                onClick={onSync}
                disabled={isSyncing}
                className={cn(
                  "p-1.5 rounded-md hover:bg-[#222222] text-praxd-text-secondary hover:text-praxd-text transition-colors",
                  isSyncing && "text-praxd-blue animate-spin"
                )}
                title="Sync pull requests from GitHub"
                aria-label="Sync pull requests from GitHub"
              >
                <RefreshCw className={cn("w-3.5 h-3.5", isSyncing && "animate-spin text-praxd-blue")} />
              </button>
            )}

            <button
              type="button"
              onClick={onToggleOpen}
              className="p-1.5 rounded-md hover:bg-[#222222] text-praxd-text-secondary hover:text-praxd-text transition-colors"
              title="Collapse inbox (Ctrl+B)"
              aria-label="Collapse inbox sidebar"
            >
              <PanelLeftClose className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Row 2: Full-Width 3-Column Segmented Tabs: All / Reviewing / Authored */}
        <div
          role="tablist"
          aria-label="PR Inbox View Filter"
          className="grid grid-cols-3 w-full p-0.5 rounded-lg bg-[#202020] border border-praxd-border-soft shadow-inner"
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
                onClick={() => handleTabChange(tab)}
                className={cn(
                  "flex items-center justify-center gap-1.5 px-2 py-1.5 text-[12px] font-medium rounded-md transition-all duration-150 capitalize focus:outline-none focus-visible:ring-1 focus-visible:ring-praxd-blue truncate min-w-0",
                  isActive
                    ? "bg-[#2e2e2e] text-praxd-text shadow-sm"
                    : "text-praxd-text-muted hover:text-praxd-text-secondary hover:bg-[#252525]"
                )}
              >
                <span className="truncate">{label}</span>
                <span
                  className={cn(
                    "text-[10px] px-1.5 py-0.2 rounded-full font-mono tabular-nums leading-none shrink-0",
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

          {/* Filter Popover Container */}
          <div className="relative" ref={filterRef}>
            <button
              type="button"
              onClick={() => setIsFilterOpen((prev) => !prev)}
              className={cn(
                "relative p-1.5 rounded-md border transition-colors flex items-center justify-center",
                hasActiveFilters || isFilterOpen
                  ? "bg-praxd-blue/15 border-praxd-blue/40 text-praxd-blue shadow-sm"
                  : "border-praxd-border-soft hover:bg-[#202020] text-praxd-text-secondary"
              )}
              title="Filter & sort options"
              aria-label="Filter pull requests"
              aria-expanded={isFilterOpen}
            >
              <Filter className="w-3.5 h-3.5" />
              {hasActiveFilters && (
                <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-praxd-blue ring-2 ring-praxd-sidebar" />
              )}
            </button>

            {/* Floating Filter Popover */}
            {isFilterOpen && (
              <div className="absolute right-0 top-full mt-2 w-72 bg-[#181818] border border-praxd-border-soft rounded-lg shadow-2xl p-3 z-50 text-[12px] space-y-3 animate-in fade-in zoom-in-95 duration-100">
                {/* Popover Header */}
                <div className="flex items-center justify-between pb-2 border-b border-praxd-border-soft/60">
                  <div className="flex items-center gap-1.5 font-medium text-praxd-text">
                    <Filter className="w-3.5 h-3.5 text-praxd-blue" />
                    <span>Filter & Sort</span>
                    {hasActiveFilters && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-praxd-blue/20 text-praxd-blue font-mono font-semibold">
                        {activeFiltersCount}
                      </span>
                    )}
                  </div>
                  {hasActiveFilters && (
                    <button
                      type="button"
                      onClick={handleResetFilters}
                      className="text-[11px] text-praxd-text-muted hover:text-praxd-text flex items-center gap-1 transition-colors"
                      title="Reset all filters"
                    >
                      <RotateCcw className="w-3 h-3" />
                      <span>Reset</span>
                    </button>
                  )}
                </div>

                {/* Filter Section: PR State */}
                <div className="space-y-1.5">
                  <label className="text-[10px] font-semibold uppercase tracking-wider text-praxd-text-muted">
                    State
                  </label>
                  <div className="grid grid-cols-4 gap-1">
                    {(
                      [
                        { id: "all" as const, label: "All", dot: undefined },
                        { id: "open" as const, label: "Open", dot: "bg-emerald-400" },
                        { id: "merged" as const, label: "Merged", dot: "bg-purple-400" },
                        { id: "closed" as const, label: "Closed", dot: "bg-red-400" },
                      ]
                    ).map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => setFilterState(item.id)}
                        className={cn(
                          "py-1 px-1.5 rounded-md text-[11px] font-medium text-center transition-all flex items-center justify-center gap-1 border",
                          filterState === item.id
                            ? "bg-praxd-blue/20 border-praxd-blue text-praxd-blue"
                            : "bg-[#202020] border-transparent text-praxd-text-secondary hover:text-praxd-text hover:bg-[#252525]"
                        )}
                      >
                        {item.dot && <span className={cn("w-1.5 h-1.5 rounded-full shrink-0", item.dot)} />}
                        <span>{item.label}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Filter Section: Repository */}
                {availableRepos.length > 0 && (
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-semibold uppercase tracking-wider text-praxd-text-muted">
                      Repository
                    </label>
                    <select
                      value={filterRepo}
                      onChange={(e) => setFilterRepo(e.target.value)}
                      className="w-full bg-[#202020] border border-praxd-border-soft rounded-md px-2.5 py-1.5 text-[11px] text-praxd-text outline-none focus:border-praxd-blue cursor-pointer"
                    >
                      <option value="all">All Repositories ({pullRequests.length})</option>
                      {availableRepos.map((repo) => {
                        const repoCount = pullRequests.filter((p) => p.repoName === repo).length;
                        return (
                          <option key={repo} value={repo}>
                            {repo} ({repoCount})
                          </option>
                        );
                      })}
                    </select>
                  </div>
                )}

                {/* Filter Section: Sort Order */}
                <div className="space-y-1.5">
                  <label className="text-[10px] font-semibold uppercase tracking-wider text-praxd-text-muted">
                    Sort By
                  </label>
                  <div className="grid grid-cols-2 gap-1">
                    {(
                      [
                        { id: "updated", label: "Recently Updated" },
                        { id: "created", label: "Recently Created" },
                        { id: "changes", label: "Most Changes" },
                        { id: "comments", label: "Most Comments" },
                      ] as const
                    ).map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => setSortBy(item.id)}
                        className={cn(
                          "py-1 px-2 rounded-md text-[11px] font-medium text-left transition-all flex items-center justify-between border",
                          sortBy === item.id
                            ? "bg-praxd-blue/20 border-praxd-blue text-praxd-blue"
                            : "bg-[#202020] border-transparent text-praxd-text-secondary hover:text-praxd-text hover:bg-[#252525]"
                        )}
                      >
                        <span className="truncate">{item.label}</span>
                        {sortBy === item.id && <Check className="w-3 h-3 shrink-0 ml-1" />}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Active Filter Chips (if any filter is applied) */}
        {hasActiveFilters && (
          <div className="flex items-center flex-wrap gap-1.5 pt-0.5">
            {filterState !== "all" && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#202020] border border-praxd-border-soft text-[10px] text-praxd-text font-medium">
                <span className="capitalize">{filterState}</span>
                <button
                  type="button"
                  onClick={() => setFilterState("all")}
                  className="hover:text-red-400 text-praxd-text-muted"
                >
                  <X className="w-2.5 h-2.5" />
                </button>
              </span>
            )}
            {filterRepo !== "all" && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#202020] border border-praxd-border-soft text-[10px] text-praxd-text font-medium">
                <span className="truncate max-w-[100px]">{filterRepo}</span>
                <button
                  type="button"
                  onClick={() => setFilterRepo("all")}
                  className="hover:text-red-400 text-praxd-text-muted"
                >
                  <X className="w-2.5 h-2.5" />
                </button>
              </span>
            )}
            {sortBy !== "updated" && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#202020] border border-praxd-border-soft text-[10px] text-praxd-text font-medium">
                <span>
                  {sortBy === "created"
                    ? "Newest"
                    : sortBy === "changes"
                    ? "Changes"
                    : "Comments"}
                </span>
                <button
                  type="button"
                  onClick={() => setSortBy("updated")}
                  className="hover:text-red-400 text-praxd-text-muted"
                >
                  <X className="w-2.5 h-2.5" />
                </button>
              </span>
            )}
            <button
              type="button"
              onClick={handleResetFilters}
              className="text-[10px] text-praxd-text-muted hover:text-praxd-text underline ml-0.5"
            >
              Clear
            </button>
          </div>
        )}

        {/* Group Selector Dropdown */}
        <div className="flex items-center justify-between text-[11px] text-praxd-text-muted pt-0.5">
          <div className="relative" ref={groupRef}>
            <button
              type="button"
              onClick={() => setIsGroupOpen((prev) => !prev)}
              className="flex items-center gap-1 hover:text-praxd-text text-praxd-text-secondary font-medium transition-colors focus:outline-none"
              aria-haspopup="listbox"
              aria-expanded={isGroupOpen}
            >
              <span>{selectedGroup}</span>
              <ChevronDown className={cn("w-3 h-3 text-praxd-text-muted transition-transform", isGroupOpen && "rotate-180")} />
            </button>

            {isGroupOpen && (
              <div
                role="listbox"
                aria-label="Filter group"
                className="absolute left-0 top-full mt-1.5 w-44 bg-[#181818] border border-praxd-border-soft rounded-lg shadow-xl p-1 z-50 animate-in fade-in zoom-in-95 duration-100"
              >
                {GROUP_OPTIONS.map((group) => {
                  const isSelected = selectedGroup === group;
                  return (
                    <button
                      key={group}
                      role="option"
                      aria-selected={isSelected}
                      type="button"
                      onClick={() => handleGroupSelect(group)}
                      className={cn(
                        "w-full flex items-center justify-between px-2.5 py-1.5 rounded-md text-[11px] font-medium transition-colors text-left",
                        isSelected
                          ? "bg-praxd-blue/15 text-praxd-blue"
                          : "text-praxd-text-secondary hover:text-praxd-text hover:bg-[#222222]"
                      )}
                    >
                      <span>{group}</span>
                      {isSelected && <Check className="w-3.5 h-3.5 text-praxd-blue shrink-0" />}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          <span className="text-[10px] text-praxd-text-muted font-mono tabular-nums">
            {totalCount
              ? `Showing ${filteredPrs.length} of ${totalCount}`
              : `${filteredPrs.length} ${filteredPrs.length === 1 ? "pull request" : "pull requests"}`}
          </span>
        </div>
      </div>

      {/* PR Rows List */}
      <div
        role="listbox"
        aria-label="Pull requests"
        tabIndex={0}
        onKeyDown={handleListKeyDown}
        onScroll={(e) => {
          const target = e.currentTarget;
          if (hasMore && !isLoadingMore && onLoadMore && target.scrollHeight - target.scrollTop <= target.clientHeight + 120) {
            onLoadMore();
          }
        }}
        className="flex-1 overflow-y-auto p-2 space-y-1 focus:outline-none"
      >
        {isLoading && filteredPrs.length === 0 ? (
          <PRSidebarSkeleton count={6} />
        ) : filteredPrs.length === 0 ? (
          <div className="p-6 text-center text-praxd-text-muted space-y-1.5">
            <p className="text-[13px] font-medium text-praxd-text-secondary">No pull requests found</p>
            <p className="text-[11px]">
              {searchQuery
                ? `No matches for "${searchQuery}".`
                : hasActiveFilters
                ? "No pull requests match the selected filters."
                : "No pull requests found in this group."}
            </p>
            {(searchQuery || hasActiveFilters) && (
              <button
                type="button"
                onClick={() => {
                  setSearchQuery("");
                  handleResetFilters();
                }}
                className="mt-2 text-[12px] text-praxd-blue hover:underline"
              >
                Clear all filters & search
              </button>
            )}
          </div>
        ) : (
          <>
            {filteredPrs.map((pr) => (
              <PullRequestListItem
                key={pr.id}
                pr={pr}
                isSelected={selectedPr?.id === pr.id}
                onSelect={onSelectPr}
              />
            ))}

            {hasMore && (
              <div className="pt-2 pb-1 px-1">
                <button
                  type="button"
                  disabled={isLoadingMore}
                  onClick={onLoadMore}
                  className="w-full py-2 px-3 text-[11px] font-medium text-praxd-text-secondary hover:text-white bg-[#191919] hover:bg-[#222222] border border-praxd-border-soft rounded-lg transition-all flex items-center justify-center gap-2 shadow-sm"
                >
                  {isLoadingMore ? (
                    <>
                      <span className="w-3.5 h-3.5 border-2 border-praxd-blue border-t-transparent rounded-full animate-spin" />
                      <span>Loading more PRs...</span>
                    </>
                  ) : (
                    <span>Load more pull requests</span>
                  )}
                </button>
              </div>
            )}
          </>
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
