import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  Columns,
  AlignJustify,
  WrapText,
  ChevronLeft,
  ChevronRight,
  ArrowLeftRight,
  ChevronsUpDown,
} from "lucide-react";
import { PullRequest, ChangedFile } from "@/types/pr";
import { FileTreeDropdown } from "./file-tree-dropdown";
import { DiffViewer } from "./diff-viewer";
import { cn } from "@/lib/utils";

interface CodeViewProps {
  pr: PullRequest;
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

  // GitHub-style vertical collapsible file state:
  // By default, the 1st file is expanded, and subsequent files are collapsed.
  const [expandedFiles, setExpandedFiles] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {};
    if (pr.files.length > 0) {
      initial[pr.files[0].filename] = true;
    }
    return initial;
  });

  // Re-synchronize expanded files whenever the active PR changes
  useEffect(() => {
    if (pr.files.length > 0) {
      setSelectedFile(pr.files[0]);
      const initial: Record<string, boolean> = {};
      initial[pr.files[0].filename] = true;
      setExpandedFiles(initial);
    }
  }, [pr.id, pr.files]);

  // Keep selectedFile valid if file exists in current fileset
  const activeFile =
    pr.files.find((f) => f.filename === selectedFile.filename) ||
    pr.files[0] ||
    selectedFile;

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
      {/* Top Breadcrumb & Ergonomic Diff Toolbar */}
      <div className="h-[42px] px-4 border-b border-praxd-border-soft bg-praxd-bg flex items-center justify-between shrink-0 select-none text-[12px]">
        {/* Left: Branch flow & multi-file picker with quick navigation */}
        <div className="flex items-center gap-3 min-w-0">
          <div className="flex items-center gap-1.5 text-praxd-text-muted font-mono text-[11px] truncate">
            <span className="text-praxd-text-secondary truncate max-w-[240px]">
              {pr.headRef}
            </span>
            <span className="text-neutral-500 font-mono select-none">→</span>
            <span className="text-praxd-text-muted">{pr.baseRef}</span>
          </div>

          {/* Sticky Multi-File Selector Dropdown + Prev/Next buttons */}
          {pr.files.length > 0 && (
            <div className="flex items-center gap-1.5">
              <FileTreeDropdown
                files={pr.files}
                selectedFile={activeFile}
                onSelectFile={handleSelectFile}
              />

              {pr.files.length > 1 && (
                <>
                  <div className="flex items-center gap-0.5 border border-praxd-border-soft rounded-md bg-[#181818] p-0.5">
                    <button
                      type="button"
                      onClick={handlePrevFile}
                      disabled={!hasPrevFile}
                      className="p-1 rounded text-praxd-text-muted hover:text-praxd-text disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                      title="Previous file"
                      aria-label="Previous changed file"
                    >
                      <ChevronLeft className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={handleNextFile}
                      disabled={!hasNextFile}
                      className="p-1 rounded text-praxd-text-muted hover:text-praxd-text disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                      title="Next file"
                      aria-label="Next changed file"
                    >
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {/* Expand All / Collapse All Toggle Button */}
                  <button
                    type="button"
                    onClick={handleToggleAllFiles}
                    className="flex items-center gap-1.5 px-2 py-1 text-[11px] font-medium rounded-md border border-praxd-border-soft bg-[#181818] text-praxd-text-muted hover:text-praxd-text hover:bg-[#222222] transition-colors"
                    title={allFilesExpanded ? "Collapse all files" : "Expand all files"}
                    aria-label={allFilesExpanded ? "Collapse all files" : "Expand all files"}
                  >
                    <ChevronsUpDown className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">
                      {allFilesExpanded ? "Collapse all" : "Expand all"}
                    </span>
                  </button>
                </>
              )}
            </div>
          )}
        </div>

        {/* Right: Split / Unified Diff Switcher & Display Options */}
        <div className="flex items-center gap-2 shrink-0">
          {/* Dual Sync Scroll Indicator in Split Mode */}
          {diffMode === "split" && !wrapLines && (
            <div
              className="hidden md:flex items-center gap-1.5 px-2 py-1 text-[11px] font-medium rounded-md bg-[#161616] text-praxd-text-secondary border border-praxd-border-soft select-none"
              title="Side-by-side horizontal scrolling is synchronized across both Old and New code panes"
            >
              <ArrowLeftRight className="w-3 h-3 text-praxd-blue" />
              <span>Sync Scroll</span>
            </div>
          )}

          {/* Line Wrap Toggle Button */}
          <button
            type="button"
            onClick={() => setWrapLines(!wrapLines)}
            className={cn(
              "flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-medium rounded-md border transition-colors",
              wrapLines
                ? "bg-[#252525] text-praxd-blue border-praxd-blue/40"
                : "bg-transparent text-praxd-text-muted border-praxd-border-soft hover:text-praxd-text hover:bg-[#1a1a1a]"
            )}
            title={wrapLines ? "Disable line wrapping" : "Wrap long lines"}
            aria-label="Toggle line wrapping"
          >
            <WrapText className="w-3 h-3" />
            <span>Wrap</span>
          </button>

          {/* Segmented Diff Mode Switcher (ADR-0002) */}
          <div
            role="tablist"
            aria-label="Diff view mode"
            className="flex items-center p-0.5 rounded-lg bg-[#1e1e1e] border border-praxd-border-soft shadow-inner"
          >
            <button
              type="button"
              role="tab"
              aria-selected={diffMode === "split"}
              onClick={() => setDiffMode("split")}
              className={cn(
                "flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-medium rounded-md transition-all duration-150",
                diffMode === "split"
                  ? "bg-[#2c2c2c] text-praxd-text shadow-sm"
                  : "text-praxd-text-muted hover:text-praxd-text-secondary hover:bg-[#252525]"
              )}
              title="Side-by-side split diff"
            >
              <Columns className="w-3 h-3" />
              <span>Split</span>
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={diffMode === "unified"}
              onClick={() => setDiffMode("unified")}
              className={cn(
                "flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-medium rounded-md transition-all duration-150",
                diffMode === "unified"
                  ? "bg-[#2c2c2c] text-praxd-text shadow-sm"
                  : "text-praxd-text-muted hover:text-praxd-text-secondary hover:bg-[#252525]"
              )}
              title="Unified inline diff"
            >
              <AlignJustify className="w-3 h-3" />
              <span>Unified</span>
            </button>
          </div>
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
              />
            );
          })
        )}
      </div>
    </div>
  );
}
