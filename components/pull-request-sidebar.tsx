import React, { useState, useMemo } from "react";
import { Search, Filter, ChevronDown, X, PanelLeftClose } from "lucide-react";
import { PullRequest } from "@/types/pr";
import { PullRequestListItem } from "./pull-request-list-item";
import { cn } from "@/lib/utils";

interface PullRequestSidebarProps {
  pullRequests: PullRequest[];
  selectedPr: PullRequest | null;
  onSelectPr: (pr: PullRequest) => void;
  isOpen: boolean;
  onToggleOpen: () => void;
}

type TabType = "all" | "reviewing" | "authored";

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

  if (!isOpen) {
    return null;
  }

  return (
    <aside
      className="w-full md:w-[420px] shrink-0 border-r border-praxd-border-soft bg-praxd-sidebar flex flex-col h-full select-none"
      aria-label="Pull requests inbox"
    >
      {/* Top Header Region: Tabs & Sidebar close button */}
      <div className="p-3 pb-2 space-y-2.5 border-b border-praxd-border-soft">
        <div className="relative flex items-center justify-center min-h-[32px]">
          {/* Centered Segmented Tabs: All / Reviewing / Authored */}
          <div
            role="tablist"
            aria-label="PR Inbox View Filter"
            className="flex items-center p-0.5 rounded-lg bg-[#202020] border border-praxd-border-soft shadow-inner"
          >
            {(["all", "reviewing", "authored"] as TabType[]).map((tab) => {
              const label = tab === "all" ? "All" : tab === "reviewing" ? "Reviewing" : "Authored";
              const isActive = activeTab === tab;
              return (
                <button
                  key={tab}
                  role="tab"
                  aria-selected={isActive}
                  onClick={() => setActiveTab(tab)}
                  className={cn(
                    "px-3 py-1 text-[12px] font-medium rounded-md transition-all duration-150 capitalize focus:outline-none focus-visible:ring-1 focus-visible:ring-praxd-blue",
                    isActive
                      ? "bg-[#2e2e2e] text-praxd-text shadow-sm"
                      : "text-praxd-text-muted hover:text-praxd-text-secondary hover:bg-[#252525]"
                  )}
                >
                  {label}
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
        className="flex-1 overflow-y-auto p-2 space-y-1"
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
    </aside>
  );
}
