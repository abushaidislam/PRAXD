import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import {
  Columns,
  AlignJustify,
  WrapText,
  ArrowLeftRight,
  Check,
  MoreHorizontal,
} from "lucide-react";
import { PullRequest, ChangedFile } from "@/types/pr";

import { DiffViewer } from "./diff-viewer";
import { DiffSplitToggle } from "./diff-split-toggle";
import { FileTreeDropdown } from "./file-tree-dropdown";
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

/**
 * Custom Changed Files icon (two overlapping file/folder squares) matching the reference screenshot.
 * Custom Folder Stack icon matching the reference screenshot:
 * Clean dual-folder outline for opening the changed files drawer.
 */
function FolderStackIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.3"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="w-4 h-4 shrink-0"
    >
      {/* Back folder outline */}
      <path
        d="M4 2.8h3.2l1.2 1.4h3.6a1 1 0 0 1 1 1v4"
        stroke="currentColor"
        strokeOpacity="0.55"
      />
      {/* Front folder */}
      <path d="M2.5 5.5h3.2l1.2 1.4h4.6a1 1 0 0 1 1 1v4.8a1 1 0 0 1-1 1h-9a1 1 0 0 1-1-1v-6.2a1 1 0 0 1 1-1Z" />
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

  // Track files marked as viewed by the reviewer
  const [viewedFiles, setViewedFiles] = useState<Record<string, boolean>>({});

  // GitHub-style vertical collapsible file state:
  // By default, the 1st file is expanded, and subsequent files are collapsed.
  const [expandedFiles, setExpandedFiles] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {};
    if (pr.files.length > 0) {
      initial[pr.files[0].filename] = true;
    }
    return initial;
  });

  // Re-synchronize expanded & viewed files whenever the active PR changes
  useEffect(() => {
    if (pr.files.length > 0) {
      setSelectedFile(pr.files[0]);
      const initial: Record<string, boolean> = {};
      initial[pr.files[0].filename] = true;
      setExpandedFiles(initial);
      setViewedFiles({});
    }
  }, [pr.id, pr.files]);

  // Keep selectedFile valid if file exists in current fileset
  const activeFile =
    pr.files.find((f) => f.filename === selectedFile.filename) ||
    pr.files[0] ||
    selectedFile;

  // Toggle viewed status for a file
  const handleToggleViewed = useCallback((filename: string) => {
    setViewedFiles((prev) => {
      const isCurrentlyViewed = !!prev[filename];
      const nextState = !isCurrentlyViewed;

      // When marking a file as viewed, smoothly collapse it
      if (nextState) {
        setExpandedFiles((exp) => ({
          ...exp,
          [filename]: false,
        }));
      }

      return {
        ...prev,
        [filename]: nextState,
      };
    });
  }, []);

  // Compute viewed count
  const viewedCount = useMemo(() => {
    return pr.files.filter((f) => viewedFiles[f.filename]).length;
  }, [pr.files, viewedFiles]);

  // Toggle individual file collapse / expand
  const handleToggleFile = useCallback((filename: string) => {
    setExpandedFiles((prev) => {
      const currentState = prev[filename] ?? false;
      return {
        ...prev,
        [filename]: !currentState,
      };
    });
  }, []);

  // Check if all files in the PR are expanded
  const allFilesExpanded = useMemo(() => {
    if (pr.files.length === 0) return true;
    return pr.files.every((f) => expandedFiles[f.filename] === true);
  }, [pr.files, expandedFiles]);

  // Bulk expand all / collapse all changed files
  const handleToggleAllFiles = useCallback(() => {
    const nextState = !allFilesExpanded;
    const updated: Record<string, boolean> = {};
    for (const f of pr.files) {
      updated[f.filename] = nextState;
    }
    setExpandedFiles(updated);
  }, [allFilesExpanded, pr.files]);

  // File navigation: jump to and auto-expand target file
  const handleSelectFile = useCallback((file: ChangedFile) => {
    setSelectedFile(file);
    setExpandedFiles((prev) => ({
      ...prev,
      [file.filename]: true,
    }));

    if (typeof window !== "undefined") {
      setTimeout(() => {
        const el = document.getElementById(`file-diff-${encodeURIComponent(file.filename)}`);
        if (el) {
          el.scrollIntoView({ behavior: "smooth", block: "start" });
        }
      }, 50);
    }
  }, []);

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
          <div className="flex items-center gap-1.5 text-praxd-text-muted font-mono text-[11px] truncate shrink-0 max-w-[320px]">
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
                  {/* Background track circle */}
                  <path
                    className="text-neutral-800"
                    strokeWidth="3.5"
                    stroke="currentColor"
                    fill="none"
                    d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                  />
                  {/* Animated foreground progress stroke */}
                  <path
                    className={cn(
                      "transition-all duration-300",
                      viewedCount === pr.files.length && pr.files.length > 0
                        ? "text-emerald-400"
                        : "text-emerald-500"
                    )}
                    strokeDasharray={`${
                      pr.files.length > 0
                        ? Math.round((viewedCount / pr.files.length) * 100)
                        : 0
                    }, 100`}
                    strokeWidth="3.5"
                    strokeLinecap="round"
                    stroke="currentColor"
                    fill="none"
                    d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                  />
                </svg>
                {/* Subtle centered checkmark when 100% complete */}
                {viewedCount === pr.files.length && pr.files.length > 0 && (
                  <Check className="w-2 h-2 text-emerald-400 absolute" />
                )}
              </div>

              <span className="tabular-nums text-neutral-300 font-medium whitespace-nowrap text-[11px]">
                {viewedCount}/{pr.files.length}
              </span>
              <span className="text-[10px] text-neutral-500 whitespace-nowrap">viewed</span>
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
              title={allFilesExpanded ? "Collapse all files" : "Expand all files"}
              aria-label={allFilesExpanded ? "Collapse all files" : "Expand all files"}
            >
              <CollapseLinesIcon isAllExpanded={allFilesExpanded} />
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
              align="right"
              trigger={
                <button
                  type="button"
                  className="p-1.5 rounded-md text-neutral-400 hover:text-white hover:bg-[#1e1e1e] transition-colors"
                  title={`Changed files (${pr.files.length})`}
                  aria-label={`Changed files (${pr.files.length})`}
                >
                  <FolderStackIcon />
                </button>
              }
            />
          )}
        </div>
      </div>

      {/* GitHub-Style Vertical Collapsible Diff Content Area */}
      <div className="flex-1 overflow-y-auto min-h-0 bg-[#0e0e0e]">
        {pr.files.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-12 text-center text-praxd-text-muted space-y-2">
            <p className="text-sm font-medium text-praxd-text">No changed files</p>
            <p className="text-xs text-praxd-text-muted">
              This pull request contains no file changes.
            </p>
          </div>
        ) : (
          pr.files.map((file, idx) => {
            const isExpanded = expandedFiles[file.filename] ?? (idx === 0);
            const isViewed = viewedFiles[file.filename] ?? false;
            return (
              <DiffViewer
                key={file.filename}
                file={file}
                diffMode={diffMode}
                comments={pr.comments}
                aiFindings={pr.aiFindings}
                wrapLines={wrapLines}
                isCollapsible={true}
                isExpanded={isExpanded}
                onToggleExpand={() => handleToggleFile(file.filename)}
                isViewed={isViewed}
                onToggleViewed={() => handleToggleViewed(file.filename)}
              />
            );
          })
        )}
      </div>
    </div>
  );
}
