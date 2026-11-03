"use client";

import React, { useState, useMemo } from "react";
import {
  ChevronDown,
  ChevronRight,
  ChevronLeft,
  FileX,
  CornerDownRight,
  ArrowLeftRight,
} from "lucide-react";
import { ChangedFile, PRComment, AIFinding, DiffLine } from "@/types/pr";
import { buildSplitRows, parsePatchToLines, SplitRow } from "@/lib/diff-parser";
import { cn } from "@/lib/utils";
import { CopyIcon } from "../copy-icon";
import { useDiffScrollSync } from "@/hooks/use-diff-scroll-sync";
import { DiffSplitRow } from "./diff-split-row";
import { DiffUnifiedRow } from "./diff-unified-row";
import { parseFilePath, renderFileBadge } from "./diff-syntax";
import { EyeIcon } from "@/components/ui/eye-icon";

export { parseFilePath, renderFileBadge };

export interface DiffViewerProps {
  file: ChangedFile;
  diffMode: "split" | "unified";
  comments: PRComment[];
  aiFindings?: AIFinding[];
  wrapLines?: boolean;
  isCollapsible?: boolean;
  isExpanded?: boolean;
  onToggleExpand?: () => void;
  isViewed?: boolean;
  onToggleViewed?: () => void;
}

export const DiffViewer = React.memo(function DiffViewer({
  file,
  diffMode,
  comments,
  aiFindings = [],
  wrapLines = false,
  isCollapsible = false,
  isExpanded = true,
  onToggleExpand,
  isViewed = false,
  onToggleViewed,
}: DiffViewerProps) {
  const [unmodifiedExpanded, setUnmodifiedExpanded] = useState(false);
  const [activeCommentLine, setActiveCommentLine] = useState<number | null>(null);
  const [draftCommentText, setDraftCommentText] = useState("");
  const [localInlineComments, setLocalInlineComments] = useState<PRComment[]>(
    comments.filter((c) => c.commentType === "review" && c.path === file.filename)
  );

  // File path copy feedback state
  const [copiedPath, setCopiedPath] = useState(false);
  const handleCopyPath = () => {
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText(file.filename);
      setCopiedPath(true);
      setTimeout(() => setCopiedPath(false), 1500);
    }
  };

  // Compute effective diff lines: skips parsing if file is collapsed (Lazy Parsing)
  const effectiveLines: DiffLine[] = useMemo(() => {
    if (isCollapsible && !isExpanded) {
      return [];
    }
    if (file.lines && file.lines.length > 0) {
      return file.lines;
    }
    if (file.patch) {
      return parsePatchToLines(file.patch);
    }
    return [];
  }, [file.lines, file.patch, isCollapsible, isExpanded]);

  // Compute synchronized split rows to prevent height desynchronization
  const splitRows: SplitRow[] = useMemo(() => {
    return buildSplitRows(effectiveLines);
  }, [effectiveLines]);

  // Dynamic horizontal scroll boundaries based on the longest diff line
  const maxLineLength = useMemo(() => {
    if (effectiveLines.length === 0) return 60;
    return Math.max(...effectiveLines.map((l) => (l.content ? l.content.length : 0)), 60);
  }, [effectiveLines]);

  // Synchronized Dual-Pane Scroll Hook
  const {
    scrollX,
    maxScrollX,
    isDragging,
    containerRef,
    trackRef,
    thumbWidthPercent,
    thumbLeftPercent,
    handleKeyDown,
    handleThumbMouseDown,
    handleTrackClick,
    scrollLeftStep,
    scrollRightStep,
    resetScroll,
  } = useDiffScrollSync({
    filename: file.filename,
    diffMode,
    wrapLines,
    maxLineLength,
  });

  // Context lines revealed when unmodified lines are expanded
  const expandedContextLines = useMemo(() => {
    if (file.filename === "extension/content.js") {
      return [
        { oldNum: 10, newNum: 10, text: "    // initialize mutation observers for dynamic tabs" },
        { oldNum: 11, newNum: 11, text: "    const observer = new MutationObserver(callback);" },
        { oldNum: 12, newNum: 12, text: "    observer.observe(targetNode, config);" },
      ];
    }
    const firstLineNum = effectiveLines.find((l) => l.newLineNumber)?.newLineNumber || 1;
    const count = Math.min(file.unmodifiedLinesBefore || 3, 3);
    const start = Math.max(1, firstLineNum - count);
    const result = [];
    for (let i = 0; i < count; i++) {
      const num = start + i;
      result.push({
        oldNum: num,
        newNum: num,
        text: `    // ... context around line ${num} ...`,
      });
    }
    return result;
  }, [file.filename, file.unmodifiedLinesBefore, effectiveLines]);

  // Scenario P0-06: File without patch or binary file handling
  const { basename, dirname } = parseFilePath(file.filename);

  const renderHeader = (expanded: boolean) => (
    <div
      id={`file-diff-${encodeURIComponent(file.filename)}`}
      className={cn(
        "flex items-center justify-between px-4 py-2.5 border-b border-praxd-border-soft bg-[#141414] text-[12px] shrink-0 sticky top-0 z-20 select-none transition-colors",
        isCollapsible && "cursor-pointer hover:bg-[#181818]",
        isViewed ? "bg-[#111111]" : "bg-[#141414]"
      )}
      onClick={isCollapsible ? onToggleExpand : undefined}
      role={isCollapsible ? "button" : undefined}
      tabIndex={isCollapsible ? 0 : undefined}
      onKeyDown={
        isCollapsible
          ? (e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onToggleExpand?.();
              }
            }
          : undefined
      }
      aria-expanded={isCollapsible ? expanded : undefined}
      aria-label={isCollapsible ? `${expanded ? "Collapse" : "Expand"} ${file.filename}` : undefined}
    >
      <div className="flex items-center gap-2.5 min-w-0">
        <div className="shrink-0">{renderFileBadge(file.filename)}</div>
        <span className="font-mono text-[13px] font-semibold text-neutral-200 truncate">
          {basename}
        </span>
        {dirname && (
          <span className="font-mono text-[12px] text-neutral-500 hidden sm:inline-block truncate">
            {dirname}
          </span>
        )}
        <span className="sr-only">{file.filename}</span>
        <CopyIcon
          value={file.filename}
          size={14}
          strokeWidth={2}
          title={copiedPath ? "Copied path!" : "Copy file path"}
          aria-label="Copy file path"
          className="p-1 rounded hover:bg-[#252525] text-praxd-text-muted hover:text-praxd-text transition-colors shrink-0 ml-1"
          onClick={(e: React.MouseEvent) => {
            e.stopPropagation();
            handleCopyPath();
          }}
        />
      </div>

      <div className="flex items-center gap-3 shrink-0">
        {/* Viewed Eye-Icon Toggle */}
        {onToggleViewed && (
          <EyeIcon
            size={16}
            duration={0.6}
            viewed={isViewed}
            onToggle={() => {
              onToggleViewed?.();
            }}
            onClick={(e) => e.stopPropagation()}
            className="p-1 rounded text-neutral-400 hover:text-neutral-200 hover:bg-[#222222] transition-colors shrink-0"
            title={isViewed ? "Mark file as unviewed" : "Mark file as viewed"}
            aria-label={isViewed ? `Mark as unviewed: ${file.filename}` : `Mark as viewed: ${file.filename}`}
          />
        )}

        {/* Change metrics (+additions -deletions) */}
        <div className="flex items-center gap-1.5 text-[11px] font-mono select-none">
          {file.additions > 0 && (
            <span className="text-praxd-green font-medium">+{file.additions}</span>
          )}
          {file.deletions > 0 && (
            <span className="text-praxd-red font-medium">-{file.deletions}</span>
          )}
          {file.additions === 0 && file.deletions === 0 && (
            <span className="text-praxd-text-muted">0</span>
          )}
        </div>

        {/* Collapsible Chevron */}
        {isCollapsible && (
          <div className="p-1 rounded text-praxd-text-muted hover:text-praxd-text transition-colors">
            {expanded ? (
              <ChevronDown className="w-4 h-4" />
            ) : (
              <ChevronRight className="w-4 h-4" />
            )}
          </div>
        )}
      </div>
    </div>
  );

  // If collapsible and currently collapsed, render ONLY the header
  if (isCollapsible && !isExpanded) {
    return (
      <div className="flex flex-col min-w-0 bg-[#0e0e0e] border-b border-praxd-border-soft select-none">
        {renderHeader(false)}
      </div>
    );
  }

  // File without patch or binary file handling
  if (effectiveLines.length === 0) {
    return (
      <div className="flex flex-col border-b border-praxd-border-soft bg-[#0e0e0e]">
        {renderHeader(true)}
        <div className="flex flex-col items-center justify-center p-12 text-center text-praxd-text-muted space-y-3 bg-[#131313] min-h-[220px]">
          <FileX className="w-10 h-10 text-praxd-text-muted" />
          <div className="space-y-1">
            <p className="text-[14px] font-medium text-praxd-text">
              Diff unavailable for this file
            </p>
            <p className="text-[12px] max-w-sm text-praxd-text-muted">
              This file is binary or does not have a text patch available in this pull request.
            </p>
          </div>
          <span className="text-[11px] text-praxd-blue font-mono bg-[#1c1c1c] px-2.5 py-1 rounded border border-praxd-border-soft">
            {file.filename}
          </span>
        </div>
      </div>
    );
  }

  const handleAddInlineComment = (lineNumber: number) => {
    if (!draftCommentText.trim()) return;

    const newComment: PRComment = {
      id: `c-inline-${Date.now()}`,
      author: {
        login: "abushaidislam",
        avatarUrl: "https://avatars.githubusercontent.com/u/1024025?v=4",
      },
      body: draftCommentText.trim(),
      createdAt: new Date().toISOString(),
      commentType: "review",
      path: file.filename,
      line: lineNumber,
      side: "RIGHT",
    };

    setLocalInlineComments((prev) => [...prev, newComment]);
    setDraftCommentText("");
    setActiveCommentLine(null);
  };

  return (
    <div className="flex-1 flex flex-col min-w-0 bg-[#0e0e0e] select-text">
      {/* File Header Bar */}
      {renderHeader(true)}

      {/* Split Column Subheader Bar */}
      {diffMode === "split" && (
        <div className="flex border-b border-praxd-border-soft bg-[#131313] text-[11px] font-mono text-praxd-text-muted select-none shrink-0">
          {/* Left Column Label (Base / Old) */}
          <div className="w-1/2 flex items-center justify-between px-3 py-1.5 border-r border-praxd-border-soft/60">
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-red-500/80" />
              <span className="font-semibold text-neutral-300">Base</span>
              <span className="text-[10px] text-neutral-500">(Old Revision)</span>
            </div>
            <span className="text-[10px] text-neutral-500">Unchanged / Deleted</span>
          </div>

          {/* Right Column Label (Head / New) */}
          <div className="w-1/2 flex items-center justify-between px-3 py-1.5">
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500/80" />
              <span className="font-semibold text-neutral-300">Head</span>
              <span className="text-[10px] text-neutral-500">(New Revision)</span>
            </div>
            <span className="text-[10px] text-neutral-500">Added / Modified</span>
          </div>
        </div>
      )}

      {/* Unmodified Context Expansion Bar (Context Folding) */}
      {(file.unmodifiedLinesBefore || 0) > 0 && (
        <div className="bg-[#121212] border-b border-praxd-border-soft text-[11px] select-none">
          <button
            type="button"
            onClick={() => setUnmodifiedExpanded(!unmodifiedExpanded)}
            className="w-full flex items-center gap-2 px-3 py-1 text-praxd-text-muted hover:text-praxd-text hover:bg-[#1a1a1a] transition-colors"
          >
            <CornerDownRight className="w-3.5 h-3.5 text-praxd-blue shrink-0" />
            <span className="font-mono">
              {unmodifiedExpanded
                ? `Collapse ${file.unmodifiedLinesBefore || 3} unmodified context lines`
                : `Expand context (${file.unmodifiedLinesBefore || 3} unmodified lines above)`}
            </span>
          </button>

          {/* Expanded unmodified context rows */}
          {unmodifiedExpanded && (
            <div className="border-t border-praxd-border-soft/40 bg-[#0f0f0f] divide-y divide-praxd-border-soft/20 font-code text-[12px] leading-5">
              {expandedContextLines.map((ctx, i) => (
                <div key={i} className="flex items-stretch text-neutral-400">
                  <div className="w-12 shrink-0 px-2 text-right text-neutral-600 border-r border-praxd-border-soft/40 tabular-nums select-none bg-[#0e0e0e]">
                    {ctx.oldNum}
                  </div>
                  {diffMode === "unified" && (
                    <div className="w-12 shrink-0 px-2 text-right text-neutral-600 border-r border-praxd-border-soft/40 tabular-nums select-none bg-[#0e0e0e]">
                      {ctx.newNum}
                    </div>
                  )}
                  <div className="flex-1 overflow-hidden">
                    <div
                      style={{
                        transform: !wrapLines ? `translateX(-${scrollX}px)` : undefined,
                        transition: isDragging ? "none" : "transform 50ms ease-out",
                      }}
                      className="px-3 text-neutral-400 whitespace-pre"
                    >
                      {ctx.text}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Main Diff Content Container */}
      <div
        ref={containerRef}
        tabIndex={0}
        onKeyDown={handleKeyDown}
        className="flex-1 overflow-y-auto overflow-x-hidden font-code text-[12px] leading-5 bg-[#0e0e0e] outline-none"
      >
        {diffMode === "split" ? (
          /* ================= SYNCHRONIZED SPLIT DIFF ================= */
          <div className="w-full divide-y divide-praxd-border-soft/20">
            {splitRows.map((row) => (
              <DiffSplitRow
                key={row.id}
                row={row}
                wrapLines={wrapLines}
                scrollX={scrollX}
                isDragging={isDragging}
                localInlineComments={localInlineComments}
                aiFindings={aiFindings}
                filename={file.filename}
                activeCommentLine={activeCommentLine}
                draftCommentText={draftCommentText}
                onSetActiveCommentLine={setActiveCommentLine}
                onDraftCommentChange={setDraftCommentText}
                onAddInlineComment={handleAddInlineComment}
              />
            ))}
          </div>
        ) : (
          /* ================= UNIFIED DIFF MODE ================= */
          <div className="w-full divide-y divide-praxd-border-soft/20">
            {effectiveLines.map((line, idx) => (
              <DiffUnifiedRow
                key={`uni-${idx}`}
                line={line}
                idx={idx}
                wrapLines={wrapLines}
                scrollX={scrollX}
                isDragging={isDragging}
                localInlineComments={localInlineComments}
                aiFindings={aiFindings}
                filename={file.filename}
                activeCommentLine={activeCommentLine}
                draftCommentText={draftCommentText}
                onSetActiveCommentLine={setActiveCommentLine}
                onDraftCommentChange={setDraftCommentText}
                onAddInlineComment={handleAddInlineComment}
              />
            ))}
          </div>
        )}
      </div>

      {/* Synchronized Dual-Pane Scrollbar Footer */}
      {!wrapLines && maxScrollX > 0 && (
        <div className="shrink-0 flex items-center justify-between px-4 py-2 bg-[#121212] border-t border-praxd-border-soft text-[11px] select-none shadow-sm">
          {/* Left: Lockstep status & Live pixel offset */}
          <div className="flex items-center gap-2.5">
            <div className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-praxd-blue/10 text-praxd-blue font-medium border border-praxd-blue/20">
              <ArrowLeftRight className="w-3 h-3" />
              <span className="hidden sm:inline">Dual-Pane Sync Scroll</span><span className="sm:hidden">Sync</span>
            </div>
            <span className="font-mono text-[11px] text-neutral-400">
              {Math.round(scrollX)}px / {Math.round(maxScrollX)}px
            </span>
            {scrollX > 0 && (
              <button
                type="button"
                onClick={resetScroll}
                className="text-[11px] text-praxd-blue hover:text-blue-400 underline font-medium transition-colors"
              >
                Reset to start
              </button>
            )}
          </div>

          {/* Center / Right: Interactive Track & Draggable Thumb */}
          <div className="flex items-center gap-2 flex-1 max-w-md ml-2 sm:ml-6">
            {/* Step Left */}
            <button
              type="button"
              onClick={() => scrollLeftStep(80)}
              disabled={scrollX <= 0}
              className="p-1 rounded text-praxd-text-muted hover:text-praxd-text hover:bg-[#1f1f1f] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              title="Scroll left (or Shift+Wheel Left)"
              aria-label="Scroll left"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>

            {/* Track */}
            <div
              ref={trackRef}
              onClick={handleTrackClick}
              className="flex-1 h-2.5 bg-[#1a1a1a] hover:bg-[#222222] rounded-full relative cursor-pointer overflow-hidden border border-praxd-border-soft transition-colors"
              title="Click to jump or drag thumb to scroll both panes in lockstep"
            >
              {/* Thumb */}
              <div
                onMouseDown={handleThumbMouseDown}
                style={{
                  width: `${thumbWidthPercent}%`,
                  left: `${thumbLeftPercent}%`,
                }}
                className={cn(
                  "absolute top-0 bottom-0 rounded-full cursor-grab active:cursor-grabbing transition-colors",
                  isDragging ? "bg-praxd-blue" : "bg-neutral-500 hover:bg-neutral-400"
                )}
              />
            </div>

            {/* Step Right */}
            <button
              type="button"
              onClick={() => scrollRightStep(80)}
              disabled={scrollX >= maxScrollX}
              className="p-1 rounded text-praxd-text-muted hover:text-praxd-text hover:bg-[#1f1f1f] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              title="Scroll right (or Shift+Wheel Right)"
              aria-label="Scroll right"
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
});
