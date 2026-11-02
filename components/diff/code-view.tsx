"use client";

import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import {
  AlignJustify,
  Columns,
  WrapText,
  Check,
  MoreHorizontal,
  ArrowLeftRight,
} from "lucide-react";
import { PullRequest, ChangedFile } from "@/types/pr";
import { DiffViewer } from "./diff-viewer";
import { DiffSplitToggle } from "../ui/diff-split-toggle";
import { FileTreeDropdown } from "./file-tree-dropdown";
import { useCollapsibleFiles } from "@/hooks/use-collapsible-files";
import { cn } from "@/lib/utils";

interface CodeViewProps {
  pr: PullRequest;
}

/**
 * Custom Collapse / Expand all files lines icon matching the reference screenshot:
 * Two arrows facing each other (collapse) or away (expand) alongside horizontal lines.
 */
function CollapseLinesIcon({ isAllExpanded }: { isAllExpanded: boolean }) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="w-3.5 h-3.5 shrink-0"
    >
      {isAllExpanded ? (
        // Collapse: arrows pointing towards the center
        <>
          <path d="M4 1.5v4.5" />
          <path d="M1.8 4.2L4 6.4l2.2-2.2" />
          <path d="M4 14.5v-4.5" />
          <path d="M1.8 11.8L4 9.6l2.2 2.2" />
          <path d="M8.5 5h5.5" />
          <path d="M8.5 11h3.5" />
        </>
      ) : (
        // Expand: arrows pointing away from center
        <>
          <path d="M4 6V1.5" />
          <path d="M1.8 3.7L4 1.5l2.2 2.2" />
          <path d="M4 10v4.5" />
          <path d="M1.8 12.3L4 14.5l2.2-2.2" />
          <path d="M8.5 5h5.5" />
          <path d="M8.5 11h3.5" />
        </>
      )}
    </svg>
  );
}


export function CodeView({ pr }: CodeViewProps) {
  const [selectedFile, setSelectedFile] = useState<ChangedFile>(
    pr.files[0] || {
      filename: "no-files-changed",
      status: "modified",
      additions: 0,
      deletions: 0,
      changes: 0,
      lines: [],
    }
  );

  const [diffMode, setDiffMode] = useState<"split" | "unified">("split");

  // On compact/mobile screens (< 768px), default to unified diff mode per UI/UX spec
  useEffect(() => {
    if (typeof window !== "undefined" && window.innerWidth < 768) {
      setDiffMode("unified");
    }
  }, []);
  const [wrapLines, setWrapLines] = useState(false);
  const [isMoreMenuOpen, setIsMoreMenuOpen] = useState(false);
  const moreMenuRef = useRef<HTMLDivElement>(null);

  // Close more menu when clicking outside or pressing Escape
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (moreMenuRef.current && !moreMenuRef.current.contains(event.target as Node)) {
        setIsMoreMenuOpen(false);
      }
    }
    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsMoreMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    window.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      window.removeEventListener("keydown", handleEscape);
    };
  }, []);

  // Use Custom Hook for collapsible files & viewed tracking
  const {
    expandedFiles,
    viewedFiles,
    toggleFileExpanded,
    toggleFileViewed,
    expandAll,
    collapseAll,
    isAllExpanded,
    viewedCount,
    totalFiles,
  } = useCollapsibleFiles({
    files: pr.files,
    prId: pr.id,
  });

  // Keep selectedFile valid if file exists in current fileset
  const activeFile =
    pr.files.find((f) => f.filename === selectedFile.filename) ||
    pr.files[0] ||
    selectedFile;

  // Bulk expand all / collapse all changed files
  const handleToggleAllFiles = useCallback(() => {
    if (isAllExpanded) {
      collapseAll();
    } else {
      expandAll();
    }
  }, [isAllExpanded, collapseAll, expandAll]);

  // File navigation: jump to and auto-expand target file
  const handleSelectFile = useCallback(
    (file: ChangedFile) => {
      setSelectedFile(file);
      if (!expandedFiles[file.filename]) {
        toggleFileExpanded(file.filename);
      }

      if (typeof window !== "undefined") {
        setTimeout(() => {
          const el = document.getElementById(`file-diff-${encodeURIComponent(file.filename)}`);
          if (el) {
            el.scrollIntoView({ behavior: "smooth", block: "start" });
          }
        }, 50);
      }
    },
    [expandedFiles, toggleFileExpanded]
  );

  // File navigation: previous / next file indices
  const currentFileIndex = pr.files.findIndex((f) => f.filename === activeFile.filename);
  const hasPrevFile = currentFileIndex > 0;
  const hasNextFile = currentFileIndex >= 0 && currentFileIndex < pr.files.length - 1;

  const handlePrevFile = useCallback(() => {
    if (hasPrevFile) {
      const target = pr.files[currentFileIndex - 1];
      handleSelectFile(target);
    }
  }, [hasPrevFile, currentFileIndex, pr.files, handleSelectFile]);

  const handleNextFile = useCallback(() => {
    if (hasNextFile) {
      const target = pr.files[currentFileIndex + 1];
      handleSelectFile(target);
    }
  }, [hasNextFile, currentFileIndex, pr.files, handleSelectFile]);

  // Keyboard navigation for changed files: [ for previous, ] for next
  useEffect(() => {
    const handleFileKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const isEditing =
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable);
      if (isEditing) return;

      if (e.key === "[" && hasPrevFile) {
        e.preventDefault();
        handlePrevFile();
      } else if (e.key === "]" && hasNextFile) {
        e.preventDefault();
        handleNextFile();
      }
    };

    window.addEventListener("keydown", handleFileKey);
    return () => window.removeEventListener("keydown", handleFileKey);
  }, [hasPrevFile, hasNextFile, handlePrevFile, handleNextFile]);

  return (
    <div className="h-full flex flex-col min-w-0 bg-[#0e0e0e]">
      {/* Top Breadcrumb & Clean Icon-Only Action Toolbar */}
      <div className="h-[40px] px-3.5 border-b border-praxd-border-soft bg-praxd-bg flex items-center justify-between shrink-0 select-none text-[12px] relative z-30 gap-3">
        {/* Left: Branch flow matching reference UI & Circular Review Progress */}
        <div className="flex items-center gap-2.5 min-w-0 flex-1 overflow-hidden">
          {/* Branch flow — matching reference UI: headRef > baseRef */}
          <div className="flex items-center gap-1.5 text-praxd-text-muted font-mono text-[11px] truncate shrink min-w-0 max-w-[150px] sm:max-w-[220px] md:max-w-[320px]">
            <span className="text-praxd-text-secondary truncate">
              {pr.headRef}
            </span>
            <span className="text-neutral-500 font-mono select-none">&gt;</span>
            <span className="text-praxd-text-muted truncate">{pr.baseRef}</span>
          </div>

          {/* Circular Review Progress Indicator */}
          {pr.files.length > 0 && (
            <div
              className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-[#161616] border border-praxd-border-soft text-[11px] font-mono select-none shrink-0"
              title={`${viewedCount} of ${pr.files.length} files reviewed`}
              aria-label={`Review progress: ${viewedCount} of ${pr.files.length} files reviewed`}
            >
              {/* SVG Circular Progress Ring */}
              <div className="relative w-3.5 h-3.5 flex items-center justify-center shrink-0">
                <svg className="w-full h-full -rotate-90" viewBox="0 0 36 36">
                  <path
                    className="text-neutral-800"
                    strokeWidth="3.5"
                    stroke="currentColor"
                    fill="none"
                    d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                  />
                  <path
                    className={cn(
                      "transition-all duration-300 ease-out",
                      viewedCount === totalFiles && totalFiles > 0
                        ? "text-emerald-400 stroke-[4]"
                        : "text-emerald-500"
                    )}
                    strokeDasharray={`${totalFiles > 0 ? (viewedCount / totalFiles) * 100 : 0}, 100`}
                    strokeWidth="3.5"
                    strokeLinecap="round"
                    stroke="currentColor"
                    fill="none"
                    d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                  />
                </svg>
                {viewedCount === totalFiles && totalFiles > 0 && (
                  <Check className="w-2.5 h-2.5 text-emerald-400 absolute stroke-[3]" />
                )}
              </div>
              <span className="text-neutral-300 font-semibold tabular-nums">
                {viewedCount}/{totalFiles}
              </span>
              <span className="text-[10px] text-neutral-500 whitespace-nowrap hidden sm:inline">viewed</span>
            </div>
          )}
        </div>

        {/* Right: Clean Icon-Only Action Toolbar matching reference screenshot */}
        <div className="flex items-center gap-1 shrink-0 text-neutral-400">
          {/* Accessible Diff View Mode Tablist (ADR-0002 / Screen Readers / Automated Tests) */}
          <div role="tablist" aria-label="Diff view mode" className="sr-only">
            <button
              type="button"
              role="tab"
              aria-label="Split"
              aria-selected={diffMode === "split"}
              onClick={() => setDiffMode("split")}
            >
              Split
            </button>
            <button
              type="button"
              role="tab"
              aria-label="Unified"
              aria-selected={diffMode === "unified"}
              onClick={() => setDiffMode("unified")}
            >
              Unified
            </button>
          </div>

          {/* 1. More Options Dropdown (...) */}
          <div className="relative" ref={moreMenuRef}>
            <button
              type="button"
              onClick={() => setIsMoreMenuOpen((v) => !v)}
              className={cn(
                "p-1.5 rounded-md transition-colors",
                isMoreMenuOpen
                  ? "bg-[#252525] text-white"
                  : "text-neutral-400 hover:text-white hover:bg-[#1e1e1e]"
              )}
              title="Diff display options"
              aria-label="Diff display options"
              aria-expanded={isMoreMenuOpen}
            >
              <MoreHorizontal className="w-4 h-4" />
            </button>

            {isMoreMenuOpen && (
              <div
                className="absolute right-0 top-full mt-1.5 w-56 rounded-lg bg-[#181818] border border-praxd-border shadow-2xl z-50 p-1.5 space-y-1 text-[12px] animate-in fade-in zoom-in-95 duration-100 select-none"
                role="menu"
              >
                {/* Wrap Lines Toggle */}
                <button
                  type="button"
                  role="menuitemcheckbox"
                  aria-checked={wrapLines}
                  onClick={() => {
                    setWrapLines(!wrapLines);
                    setIsMoreMenuOpen(false);
                  }}
                  className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-md text-neutral-300 hover:text-white hover:bg-[#252525] transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <WrapText className="w-3.5 h-3.5 text-neutral-400" />
                    <span>Wrap long lines</span>
                  </div>
                  {wrapLines && <Check className="w-3.5 h-3.5 text-praxd-blue" />}
                </button>

                {/* Synchronized Scrolling Indicator / Toggle */}
                <button
                  type="button"
                  role="menuitemcheckbox"
                  aria-checked={diffMode === "split" && !wrapLines}
                  onClick={() => {
                    if (diffMode !== "split") setDiffMode("split");
                    if (wrapLines) setWrapLines(false);
                    setIsMoreMenuOpen(false);
                  }}
                  className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-md text-neutral-300 hover:text-white hover:bg-[#252525] transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <ArrowLeftRight className="w-3.5 h-3.5 text-neutral-400" />
                    <span>Synchronized scrolling</span>
                  </div>
                  {diffMode === "split" && !wrapLines && (
                    <Check className="w-3.5 h-3.5 text-praxd-blue" />
                  )}
                </button>

                <div className="h-px bg-praxd-border-soft my-1" />

                {/* Diff View Mode direct selection */}
                <div className="px-2.5 py-1 text-[10px] uppercase font-semibold text-neutral-500 tracking-wider">
                  Diff View Mode
                </div>
                <button
                  type="button"
                  role="menuitemradio"
                  aria-checked={diffMode === "split"}
                  onClick={() => {
                    setDiffMode("split");
                    setIsMoreMenuOpen(false);
                  }}
                  className={cn(
                    "w-full flex items-center justify-between px-2.5 py-1.5 rounded-md transition-colors",
                    diffMode === "split"
                      ? "bg-[#252525] text-white"
                      : "text-neutral-300 hover:text-white hover:bg-[#202020]"
                  )}
                >
                  <div className="flex items-center gap-2">
                    <Columns className="w-3.5 h-3.5 text-neutral-400" />
                    <span>Side-by-side split</span>
                  </div>
                  {diffMode === "split" && <Check className="w-3.5 h-3.5 text-praxd-blue" />}
                </button>
                <button
                  type="button"
                  role="menuitemradio"
                  aria-checked={diffMode === "unified"}
                  onClick={() => {
                    setDiffMode("unified");
                    setIsMoreMenuOpen(false);
                  }}
                  className={cn(
                    "w-full flex items-center justify-between px-2.5 py-1.5 rounded-md transition-colors",
                    diffMode === "unified"
                      ? "bg-[#252525] text-white"
                      : "text-neutral-300 hover:text-white hover:bg-[#202020]"
                  )}
                >
                  <div className="flex items-center gap-2">
                    <AlignJustify className="w-3.5 h-3.5 text-neutral-400" />
                    <span>Unified inline</span>
                  </div>
                  {diffMode === "unified" && <Check className="w-3.5 h-3.5 text-praxd-blue" />}
                </button>
              </div>
            )}
          </div>

          {/* 2. Collapse / Expand All Files Icon Button */}
          {pr.files.length > 0 && (
            <button
              type="button"
              onClick={handleToggleAllFiles}
              className="p-1.5 rounded-md text-neutral-400 hover:text-white hover:bg-[#1e1e1e] transition-colors"
              title={isAllExpanded ? "Collapse all files" : "Expand all files"}
              aria-label={isAllExpanded ? "Collapse all files" : "Expand all files"}
            >
              <CollapseLinesIcon isAllExpanded={isAllExpanded} />
            </button>
          )}

          {/* 3. Red/Green Animated Diff Split/Unified Toggle */}
          <DiffSplitToggle
            size={18}
            isSplit={diffMode === "split"}
            onSplitChange={(isSplit: boolean) => setDiffMode(isSplit ? "split" : "unified")}
            title={
              diffMode === "split"
                ? "Diff mode: Split (click to switch to Unified)"
                : "Diff mode: Unified (click to switch to Split)"
            }
            className="p-1 rounded-md text-neutral-400 hover:text-white hover:bg-[#1e1e1e] transition-colors"
          />

          {/* 4. Changed Files Drawer / Tree Icon Button */}
          {pr.files.length > 0 && (
            <FileTreeDropdown
              files={pr.files}
              selectedFile={activeFile}
              onSelectFile={handleSelectFile}
            />
          )}
        </div>
      </div>

      {/* GitHub-Style Vertical Collapsible Diff Stream */}
      <div className="flex-1 overflow-y-auto divide-y divide-praxd-border-soft divide-solid bg-[#0e0e0e]">
        {pr.files.map((f) => (
          <DiffViewer
            key={f.filename}
            file={f}
            diffMode={diffMode}
            comments={pr.comments}
            aiFindings={pr.aiFindings}
            wrapLines={wrapLines}
            isCollapsible={true}
            isExpanded={expandedFiles[f.filename] ?? false}
            onToggleExpand={() => toggleFileExpanded(f.filename)}
            isViewed={viewedFiles[f.filename] ?? false}
            onToggleViewed={() => toggleFileViewed(f.filename)}
          />
        ))}
      </div>
    </div>
  );
}
