import React, { useState, useMemo, useRef, useEffect } from "react";
import {
  Plus,
  ChevronDown,
  ChevronRight,
  ChevronLeft,
  FileX,
  CornerDownRight,
  MessageSquare,
  Check,
  ArrowLeftRight,
  Copy,
  Settings,
  FileCode,
} from "lucide-react";
import { ChangedFile, PRComment, AIFinding, DiffLine } from "@/types/pr";
import { AIReviewCard } from "./ai-review-card";
import { buildSplitRows, parsePatchToLines, SplitRow } from "@/lib/diff-parser";
import { cn } from "@/lib/utils";

export interface DiffViewerProps {
  file: ChangedFile;
  diffMode: "split" | "unified";
  comments: PRComment[];
  aiFindings?: AIFinding[];
  wrapLines?: boolean;
  isCollapsible?: boolean;
  isExpanded?: boolean;
  onToggleExpand?: () => void;
}

export function parseFilePath(filePath: string) {
  const parts = filePath.split("/");
  const basename = parts.pop() || filePath;
  const dirname = parts.join("/");
  return { basename, dirname };
}

export function renderFileBadge(filename: string) {
  const lower = filename.toLowerCase();
  const ext = lower.split(".").pop() || "";

  if (ext === "md" || ext === "markdown") {
    return (
      <span className="font-bold text-[11px] text-sky-400 font-mono tracking-tighter shrink-0 select-none">
        M↓
      </span>
    );
  }

  if (ext === "ts" || ext === "tsx") {
    return (
      <span className="px-1 py-0.2 rounded text-[10px] bg-blue-950/60 text-blue-400 font-mono font-bold border border-blue-700/50 shrink-0 select-none">
        TS
      </span>
    );
  }

  if (ext === "js" || ext === "jsx" || ext === "mjs" || ext === "cjs") {
    return (
      <span className="px-1 py-0.2 rounded text-[10px] bg-yellow-950/60 text-amber-300 font-mono font-bold border border-yellow-700/50 shrink-0 select-none">
        JS
      </span>
    );
  }

  if (
    ext === "json" ||
    ext === "yml" ||
    ext === "yaml" ||
    ext === "toml" ||
    lower.includes(".env") ||
    lower.includes("config")
  ) {
    return <Settings className="w-3.5 h-3.5 text-neutral-400 shrink-0" />;
  }

  if (ext === "css" || ext === "scss" || ext === "sass" || ext === "less") {
    return (
      <span className="px-1 py-0.2 rounded text-[10px] bg-purple-950/60 text-purple-300 font-mono font-bold border border-purple-700/50 shrink-0 select-none">
        CSS
      </span>
    );
  }

  return <FileCode className="w-3.5 h-3.5 text-neutral-400 shrink-0" />;
}

export function DiffViewer({
  file,
  diffMode,
  comments,
  aiFindings = [],
  wrapLines = false,
  isCollapsible = false,
  isExpanded = true,
  onToggleExpand,
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


  // Synchronized Dual-Pane Horizontal Scroll State
  const [scrollX, setScrollX] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [containerWidth, setContainerWidth] = useState(960);
  const containerRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const dragStartRef = useRef<{ startX: number; startScrollX: number }>({
    startX: 0,
    startScrollX: 0,
  });

  // Compute effective diff lines: uses file.lines or parses file.patch on the fly
  const effectiveLines: DiffLine[] = useMemo(() => {
    if (file.lines && file.lines.length > 0) {
      return file.lines;
    }
    if (file.patch) {
      return parsePatchToLines(file.patch);
    }
    return [];
  }, [file.lines, file.patch]);

  // Compute synchronized split rows to prevent height desynchronization
  const splitRows: SplitRow[] = useMemo(() => {
    return buildSplitRows(effectiveLines);
  }, [effectiveLines]);

  // Dynamic horizontal scroll boundaries based on the longest diff line
  const maxLineLength = useMemo(() => {
    if (effectiveLines.length === 0) return 60;
    return Math.max(...effectiveLines.map((l) => (l.content ? l.content.length : 0)), 60);
  }, [effectiveLines]);

  // Monitor container width dynamically with ResizeObserver (with JSDOM / Node test fallback)
  useEffect(() => {
    if (!containerRef.current) return;
    const updateWidth = () => {
      if (containerRef.current) {
        setContainerWidth(containerRef.current.clientWidth || 960);
      }
    };
    updateWidth();

    if (typeof ResizeObserver !== "undefined") {
      const observer = new ResizeObserver(updateWidth);
      observer.observe(containerRef.current);
      return () => observer.disconnect();
    }

    if (typeof window !== "undefined") {
      window.addEventListener("resize", updateWidth);
      return () => window.removeEventListener("resize", updateWidth);
    }
  }, []);

  // Compute column visible width & max scroll range
  // In split mode, each column is 50% minus gutter (48px) and internal padding (24px)
  const columnWidth = useMemo(() => {
    if (diffMode === "split") {
      return Math.max(300, containerWidth / 2 - 72);
    }
    return Math.max(400, containerWidth - 120);
  }, [diffMode, containerWidth]);

  const maxScrollX = useMemo(() => {
    if (wrapLines) return 0;
    const contentWidth = Math.max(columnWidth, maxLineLength * 7.6 + 60);
    return Math.max(0, contentWidth - columnWidth);
  }, [wrapLines, maxLineLength, columnWidth]);

  // Reset scroll whenever the file changes or line wrap is toggled
  useEffect(() => {
    setScrollX(0);
  }, [file.filename, wrapLines]);

  // Synchronized Wheel Event Listener (Trackpad swipe deltaX & Shift + Mouse wheel deltaY)
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleWheel = (e: WheelEvent) => {
      if (wrapLines || maxScrollX <= 0) return;

      const isHorizontal =
        Math.abs(e.deltaX) > Math.abs(e.deltaY) || (e.shiftKey && e.deltaY !== 0);

      if (isHorizontal) {
        e.preventDefault();
        const delta = Math.abs(e.deltaX) > 0 ? e.deltaX : e.shiftKey ? e.deltaY : 0;
        setScrollX((prev) => Math.max(0, Math.min(maxScrollX, prev + delta)));
      }
    };

    container.addEventListener("wheel", handleWheel, { passive: false });
    return () => {
      container.removeEventListener("wheel", handleWheel);
    };
  }, [wrapLines, maxScrollX]);

  // Keyboard navigation for horizontal scroll (ArrowLeft, ArrowRight, Home, End)
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (wrapLines || maxScrollX <= 0) return;
    if (e.key === "ArrowLeft") {
      e.preventDefault();
      setScrollX((prev) => Math.max(0, prev - 50));
    } else if (e.key === "ArrowRight") {
      e.preventDefault();
      setScrollX((prev) => Math.min(maxScrollX, prev + 50));
    } else if (e.key === "Home") {
      e.preventDefault();
      setScrollX(0);
    } else if (e.key === "End") {
      e.preventDefault();
      setScrollX(maxScrollX);
    }
  };

  // Draggable Scrollbar Thumb Handling
  const handleThumbMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
    dragStartRef.current = {
      startX: e.clientX,
      startScrollX: scrollX,
    };
  };

  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (!trackRef.current || maxScrollX <= 0) return;
      const trackRect = trackRef.current.getBoundingClientRect();
      const trackWidth = trackRect.width;
      const deltaMouseX = e.clientX - dragStartRef.current.startX;
      const scrollDelta = (deltaMouseX / trackWidth) * maxScrollX;
      const newScrollX = Math.max(
        0,
        Math.min(maxScrollX, dragStartRef.current.startScrollX + scrollDelta)
      );
      setScrollX(newScrollX);
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isDragging, maxScrollX]);

  const handleTrackClick = (e: React.MouseEvent) => {
    if (!trackRef.current || maxScrollX <= 0) return;
    const trackRect = trackRef.current.getBoundingClientRect();
    const clickX = e.clientX - trackRect.left;
    const ratio = Math.max(0, Math.min(1, clickX / trackRect.width));
    setScrollX(ratio * maxScrollX);
  };

  // Scrollbar dimensions
  const visibleRatio = Math.min(1, columnWidth / (columnWidth + maxScrollX));
  const thumbWidthPercent = Math.max(16, Math.min(80, visibleRatio * 100));
  const availableThumbTrack = 100 - thumbWidthPercent;
  const scrollRatio = maxScrollX > 0 ? scrollX / maxScrollX : 0;
  const thumbLeftPercent = scrollRatio * availableThumbTrack;

  // Context lines revealed when unmodified lines are expanded
  const expandedContextLines = useMemo(() => {
    if (file.filename === "extension/content.js") {
      return [
        { oldNum: 1638, newNum: 1638, text: "    // Initialize overlay manager" },
        { oldNum: 1639, newNum: 1639, text: "    const banner = document.createElement('div');" },
        { oldNum: 1640, newNum: 1640, text: "    banner.className = 'zcrap-inspector-banner';" },
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
        "flex items-center justify-between px-4 py-2.5 border-b border-praxd-border-soft bg-[#141414] text-[12px] shrink-0 sticky top-0 z-20 backdrop-blur-sm select-none transition-colors",
        isCollapsible && "cursor-pointer hover:bg-[#181818]"
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
          <span className="font-mono text-[12px] text-neutral-500 truncate">
            {dirname}
          </span>
        )}
        <span className="sr-only">{file.filename}</span>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            handleCopyPath();
          }}
          className="p-1 rounded hover:bg-[#252525] text-praxd-text-muted hover:text-praxd-text transition-colors shrink-0 ml-1"
          title={copiedPath ? "Copied path!" : "Copy file path"}
          aria-label="Copy file path"
        >
          {copiedPath ? (
            <Check className="w-3.5 h-3.5 text-praxd-green" />
          ) : (
            <Copy className="w-3.5 h-3.5" />
          )}
        </button>
      </div>

      <div className="flex items-center gap-3 shrink-0">
        <div className="flex items-center gap-1.5 font-mono text-[11px] tabular-nums font-semibold">
          <span className="text-[#3fb950]">+{file.additions}</span>
          <span className="text-[#f85149]">-{file.deletions}</span>
        </div>
        {isCollapsible ? (
          <div className="p-0.5 text-neutral-400">
            {expanded ? (
              <ChevronDown className="w-4 h-4 text-neutral-300" />
            ) : (
              <ChevronRight className="w-4 h-4 text-neutral-400" />
            )}
          </div>
        ) : (
          <span className="text-[11px] text-praxd-text-muted font-mono">
            {effectiveLines.length} diff lines
          </span>
        )}
      </div>
    </div>
  );

  // If collapsed in a multi-file list, render only the single-line header
  if (isCollapsible && !isExpanded) {
    return (
      <div className="border-b border-praxd-border-soft bg-[#121212]">
        {renderHeader(false)}
      </div>
    );
  }

  // Binary file or file without patch
  if (effectiveLines.length === 0) {
    return (
      <div className="flex flex-col border-b border-praxd-border-soft bg-[#0e0e0e]">
        {renderHeader(true)}
        <div className="flex flex-col items-center justify-center p-12 text-center text-praxd-text-muted space-y-3 bg-[#131313]">
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

  // Modern syntax tokenization with HTML tag and string recognition
  const renderHighlightedCode = (text: string, isDeleted = false, isAdded = false) => {
    if (!text) return <span>&nbsp;</span>;

    if (text.trim().startsWith("//")) {
      return <span className="text-[#768390] italic">{text}</span>;
    }

    const tokens = text.split(
      /(\b(?:const|let|var|function|return|import|export|from|if|else|true|false|document|window)\b|'[^']*'|"[^"]*"|`[^`]*`|<[^>]+>)/g
    );

    return (
      <>
        {tokens.map((token, i) => {
          if (!token) return null;

          if (
            [
              "const",
              "let",
              "var",
              "function",
              "return",
              "import",
              "export",
              "from",
              "if",
              "else",
            ].includes(token)
          ) {
            return (
              <span key={i} className="text-[#f47067] font-semibold">
                {token}
              </span>
            );
          }
          if (["document", "window"].includes(token)) {
            return (
              <span key={i} className="text-[#d2a8ff]">
                {token}
              </span>
            );
          }
          if (["true", "false"].includes(token)) {
            return (
              <span key={i} className="text-[#6cb6ff]">
                {token}
              </span>
            );
          }
          if (
            (token.startsWith("'") && token.endsWith("'")) ||
            (token.startsWith('"') && token.endsWith('"')) ||
            (token.startsWith("`") && token.endsWith("`"))
          ) {
            return (
              <span
                key={i}
                className={cn(
                  "text-[#96d0ff]",
                  isDeleted && "bg-red-950/60 rounded px-0.5",
                  isAdded && "bg-emerald-950/70 rounded px-0.5"
                )}
              >
                {token}
              </span>
            );
          }
          if (token.startsWith("<") && token.endsWith(">")) {
            return (
              <span key={i} className="text-[#7ee787] font-mono">
                {token}
              </span>
            );
          }
          return <span key={i}>{token}</span>;
        })}
      </>
    );
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
              <span className="text-[10px] text-neutral-500 font-sans">(Original revision)</span>
            </div>
            <span className="text-[10px] text-neutral-500 uppercase tracking-wider font-semibold">
              Old
            </span>
          </div>

          {/* Right Column Label (Head / New) */}
          <div className="w-1/2 flex items-center justify-between px-3 py-1.5">
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500/80" />
              <span className="font-semibold text-neutral-300">Head</span>
              <span className="text-[10px] text-neutral-500 font-sans">(Modified revision)</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="flex items-center gap-1 text-[10px] text-praxd-blue font-sans">
                <ArrowLeftRight className="w-3 h-3" />
                <span>Synced</span>
              </span>
              <span className="text-[10px] text-emerald-400 uppercase tracking-wider font-semibold">
                New
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Unmodified Lines Bar */}
      {file.unmodifiedLinesBefore && (
        <div className="flex flex-col bg-[#141414] border-b border-praxd-border-soft text-[11px] font-mono select-none">
          <button
            type="button"
            onClick={() => setUnmodifiedExpanded(!unmodifiedExpanded)}
            className="w-full flex items-center justify-center py-1.5 px-4 text-praxd-text-muted hover:text-praxd-text hover:bg-[#1a1a1a] transition-colors gap-2"
          >
            {unmodifiedExpanded ? (
              <ChevronDown className="w-3.5 h-3.5 text-praxd-blue" />
            ) : (
              <ChevronRight className="w-3.5 h-3.5 text-praxd-text-muted" />
            )}
            <span>
              {unmodifiedExpanded
                ? "Collapse unchanged lines"
                : `> ${file.unmodifiedLinesBefore} unmodified lines`}
            </span>
          </button>

          {/* Context lines revealed when expanded */}
          {unmodifiedExpanded && (
            <div className="border-t border-praxd-border-soft/60 bg-[#111111] text-[12px] font-code divide-y divide-praxd-border-soft/30">
              {expandedContextLines.map((ctx) => (
                <div key={ctx.newNum} className="flex items-center text-praxd-text-muted py-0.5">
                  <div className="w-12 px-2 text-right select-none text-[11px] text-neutral-600 tabular-nums">
                    {ctx.oldNum}
                  </div>
                  <div className="w-12 px-2 text-right select-none text-[11px] text-neutral-600 border-r border-praxd-border-soft tabular-nums">
                    {ctx.newNum}
                  </div>
                  <div className="flex-1 min-w-0 overflow-hidden relative">
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
            {splitRows.map((row) => {
              const rightLineNum = row.right?.lineNumber;
              const leftLineNum = row.left?.lineNumber;

              // Check for inline comments and AI findings on right side line
              const lineComments = rightLineNum
                ? localInlineComments.filter((c) => c.line === rightLineNum)
                : [];
              const lineAiFindings = rightLineNum
                ? aiFindings.filter(
                    (f) => f.filePath === file.filename && f.line === rightLineNum
                  )
                : [];
              const hasAnnotation =
                lineComments.length > 0 ||
                lineAiFindings.length > 0 ||
                activeCommentLine === rightLineNum;

              return (
                <div key={row.id} className="flex flex-col">
                  {/* Paired Line Row (Left & Right synchronized) */}
                  <div className="flex items-stretch group hover:bg-[#161616] transition-colors">
                    {/* LEFT COLUMN: Old Revision */}
                    <div
                      className={cn(
                        "w-1/2 flex border-r border-praxd-border-soft/60 border-l relative overflow-hidden",
                        row.left?.type === "deletion"
                          ? "bg-[#281416]/50 border-l-praxd-red"
                          : "border-l-transparent bg-transparent"
                      )}
                    >
                      {/* Pinned Gutter (Line Number + Comment Button) */}
                      <div className="w-12 shrink-0 px-2 text-right select-none text-[11px] text-praxd-text-muted tabular-nums relative flex items-center justify-end z-10 border-r border-praxd-border-soft/40 bg-[#0e0e0e]">
                        <span className="group-hover:opacity-0 transition-opacity">
                          {row.left?.lineNumber || ""}
                        </span>
                        {row.left?.lineNumber && (
                          <button
                            type="button"
                            onClick={() => setActiveCommentLine(row.left?.lineNumber!)}
                            className="absolute inset-0 m-auto w-4 h-4 rounded bg-[#2b2b2b] text-praxd-text opacity-0 group-hover:opacity-100 flex items-center justify-center hover:bg-neutral-600 transition-all shadow-sm"
                            title={`Comment on line ${row.left.lineNumber}`}
                          >
                            <Plus className="w-3 h-3" />
                          </button>
                        )}
                      </div>

                      {/* Code Area with Synchronized Horizontal Translation */}
                      <div className="flex-1 min-w-0 overflow-hidden relative">
                        <div
                          style={{
                            transform: !wrapLines ? `translateX(-${scrollX}px)` : undefined,
                            transition: isDragging ? "none" : "transform 50ms ease-out",
                          }}
                          className={cn(
                            "px-3 text-praxd-text",
                            wrapLines
                              ? "whitespace-pre-wrap break-words"
                              : "whitespace-pre font-mono inline-block min-w-full"
                          )}
                        >
                          {row.left ? (
                            renderHighlightedCode(row.left.content, row.left.type === "deletion")
                          ) : (
                            <span className="text-neutral-700 select-none">&nbsp;</span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* RIGHT COLUMN: New Revision */}
                    <div
                      className={cn(
                        "w-1/2 flex border-l relative overflow-hidden",
                        row.right?.type === "addition"
                          ? "bg-[#122619]/50 border-l-praxd-green"
                          : "border-l-transparent bg-transparent"
                      )}
                    >
                      {/* Pinned Gutter (Line Number + Comment Button) */}
                      <div className="w-12 shrink-0 px-2 text-right select-none text-[11px] text-praxd-text-muted tabular-nums relative flex items-center justify-end z-10 border-r border-praxd-border-soft/40 bg-[#0e0e0e]">
                        <span className="group-hover:opacity-0 transition-opacity">
                          {row.right?.lineNumber || ""}
                        </span>
                        {row.right?.lineNumber && (
                          <button
                            type="button"
                            onClick={() => setActiveCommentLine(row.right?.lineNumber!)}
                            className="absolute inset-0 m-auto w-4 h-4 rounded bg-[#2b2b2b] text-praxd-text opacity-0 group-hover:opacity-100 flex items-center justify-center hover:bg-praxd-blue hover:text-white transition-all shadow-sm"
                            title={`Comment on line ${row.right.lineNumber}`}
                          >
                            <Plus className="w-3 h-3" />
                          </button>
                        )}
                      </div>

                      {/* Code Area with Synchronized Horizontal Translation */}
                      <div className="flex-1 min-w-0 overflow-hidden relative">
                        <div
                          style={{
                            transform: !wrapLines ? `translateX(-${scrollX}px)` : undefined,
                            transition: isDragging ? "none" : "transform 50ms ease-out",
                          }}
                          className={cn(
                            "px-3 text-praxd-text",
                            wrapLines
                              ? "whitespace-pre-wrap break-words"
                              : "whitespace-pre font-mono inline-block min-w-full"
                          )}
                        >
                          {row.right ? (
                            renderHighlightedCode(
                              row.right.content,
                              false,
                              row.right.type === "addition"
                            )
                          ) : (
                            <span className="text-neutral-700 select-none">&nbsp;</span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* ANNOTATIONS (AI Review Findings & Inline Comments) */}
                  {/* Embedded directly beneath row with full synchronization */}
                  {hasAnnotation && (
                    <div className="flex bg-[#141414] border-t border-b border-praxd-border-soft/60">
                      {/* Left filler maintains column balance */}
                      <div className="w-1/2 border-r border-praxd-border-soft/60 bg-[#111111]/60" />

                      {/* Right annotation container */}
                      <div className="w-1/2 p-3 space-y-3 font-sans">
                        {/* AI Finding Card */}
                        {lineAiFindings.map((finding) => (
                          <AIReviewCard key={finding.id} finding={finding} />
                        ))}

                        {/* Existing Inline Comments */}
                        {lineComments.map((comm) => (
                          <div
                            key={comm.id}
                            className="p-3 rounded-lg bg-[#181818] border border-praxd-border-soft text-[12px] shadow-sm space-y-1.5"
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <img
                                  src={comm.author.avatarUrl}
                                  alt={comm.author.login}
                                  className="w-4 h-4 rounded-full ring-1 ring-white/10"
                                />
                                <span className="font-semibold text-praxd-text">
                                  {comm.author.login}
                                </span>
                              </div>
                              <span className="text-[11px] text-praxd-text-muted">1h ago</span>
                            </div>
                            <p className="text-praxd-text-secondary leading-relaxed pl-6">
                              {comm.body}
                            </p>
                          </div>
                        ))}

                        {/* Active inline comment composer */}
                        {activeCommentLine === rightLineNum && (
                          <div className="p-3 rounded-lg bg-[#191919] border border-praxd-border text-[12px] space-y-2.5 shadow-md">
                            <div className="flex items-center gap-2 text-praxd-text-muted text-[11px]">
                              <MessageSquare className="w-3.5 h-3.5 text-praxd-blue" />
                              <span>Commenting on line {rightLineNum}</span>
                            </div>
                            <textarea
                              value={draftCommentText}
                              onChange={(e) => setDraftCommentText(e.target.value)}
                              onKeyDown={(e) => {
                                if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
                                  handleAddInlineComment(rightLineNum!);
                                } else if (e.key === "Escape") {
                                  setActiveCommentLine(null);
                                  setDraftCommentText("");
                                }
                              }}
                              placeholder="Write a comment... (Cmd+Enter to send, Esc to cancel)"
                              className="w-full bg-[#111111] border border-praxd-border-soft rounded p-2.5 text-praxd-text placeholder-praxd-text-muted focus:outline-none focus:border-praxd-blue text-[12px] font-sans"
                              rows={3}
                              autoFocus
                            />
                            <div className="flex items-center justify-between text-[11px] text-praxd-text-muted">
                              <span>Markdown supported</span>
                              <div className="flex items-center gap-2">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setActiveCommentLine(null);
                                    setDraftCommentText("");
                                  }}
                                  className="px-2.5 py-1 text-praxd-text-muted hover:text-praxd-text transition-colors"
                                >
                                  Cancel
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleAddInlineComment(rightLineNum!)}
                                  disabled={!draftCommentText.trim()}
                                  className="px-3 py-1 rounded bg-praxd-blue hover:bg-blue-600 text-white font-medium disabled:opacity-40 transition-colors shadow-sm"
                                >
                                  Add comment
                                </button>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          /* ================= UNIFIED DIFF MODE ================= */
          <div className="w-full divide-y divide-praxd-border-soft/20">
            {effectiveLines.map((line, idx) => {
              const isAddition = line.type === "addition";
              const isDeletion = line.type === "deletion";
              const lineNum = line.newLineNumber || line.oldLineNumber;

              const lineComments = line.newLineNumber
                ? localInlineComments.filter((c) => c.line === line.newLineNumber)
                : [];
              const lineAiFindings = line.newLineNumber
                ? aiFindings.filter(
                    (f) => f.filePath === file.filename && f.line === line.newLineNumber
                  )
                : [];
              const hasAnnotation =
                lineComments.length > 0 ||
                lineAiFindings.length > 0 ||
                activeCommentLine === lineNum;

              return (
                <div key={`uni-${idx}`} className="flex flex-col">
                  <div
                    className={cn(
                      "flex items-stretch group hover:bg-[#161616] transition-colors border-l relative overflow-hidden",
                      isAddition
                        ? "bg-[#122619]/50 border-l-praxd-green"
                        : isDeletion
                        ? "bg-[#281416]/50 border-l-praxd-red"
                        : "border-l-transparent"
                    )}
                  >
                    {/* Old line number */}
                    <div className="w-12 shrink-0 px-2 text-right select-none text-[11px] text-praxd-text-muted tabular-nums bg-[#0e0e0e] z-10">
                      {line.oldLineNumber || ""}
                    </div>

                    {/* New line number + Hover '+' button */}
                    <div className="w-12 shrink-0 px-2 text-right select-none text-[11px] text-praxd-text-muted border-r border-praxd-border-soft/60 tabular-nums relative flex items-center justify-end bg-[#0e0e0e] z-10">
                      <span className="group-hover:opacity-0 transition-opacity">
                        {line.newLineNumber || ""}
                      </span>
                      {lineNum && (
                        <button
                          type="button"
                          onClick={() => setActiveCommentLine(lineNum)}
                          className="absolute inset-0 m-auto w-4 h-4 rounded bg-[#2b2b2b] text-praxd-text opacity-0 group-hover:opacity-100 flex items-center justify-center hover:bg-praxd-blue hover:text-white transition-all shadow-sm"
                          title={`Comment on line ${lineNum}`}
                          aria-label={`Comment on line ${lineNum}`}
                        >
                          <Plus className="w-3 h-3" />
                        </button>
                      )}
                    </div>

                    {/* Prefix sign (+ / -) */}
                    <div className="w-6 shrink-0 text-center select-none text-neutral-500 font-mono bg-[#0e0e0e] z-10">
                      {isAddition ? "+" : isDeletion ? "-" : " "}
                    </div>

                    {/* Code Content */}
                    <div className="flex-1 min-w-0 overflow-hidden relative">
                      <div
                        style={{
                          transform: !wrapLines ? `translateX(-${scrollX}px)` : undefined,
                          transition: isDragging ? "none" : "transform 50ms ease-out",
                        }}
                        className={cn(
                          "px-3 text-praxd-text",
                          wrapLines
                            ? "whitespace-pre-wrap break-words"
                            : "whitespace-pre font-mono inline-block min-w-full"
                        )}
                      >
                        {renderHighlightedCode(line.content, isDeletion, isAddition)}
                      </div>
                    </div>
                  </div>

                  {/* Unified Annotations (AI Card & Comments) */}
                  {hasAnnotation && (
                    <div className="pl-24 pr-6 py-3 bg-[#141414] border-t border-b border-praxd-border-soft/60 space-y-3 font-sans">
                      {lineAiFindings.map((finding) => (
                        <AIReviewCard key={finding.id} finding={finding} />
                      ))}

                      {lineComments.map((comm) => (
                        <div
                          key={comm.id}
                          className="p-3 rounded-lg bg-[#181818] border border-praxd-border-soft text-[12px] shadow-sm space-y-1.5"
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <img
                                src={comm.author.avatarUrl}
                                alt={comm.author.login}
                                className="w-4 h-4 rounded-full ring-1 ring-white/10"
                              />
                              <span className="font-semibold text-praxd-text">
                                {comm.author.login}
                              </span>
                            </div>
                            <span className="text-[11px] text-praxd-text-muted">1h ago</span>
                          </div>
                          <p className="text-praxd-text-secondary leading-relaxed pl-6">
                            {comm.body}
                          </p>
                        </div>
                      ))}

                      {activeCommentLine === lineNum && (
                        <div className="p-3 rounded-lg bg-[#191919] border border-praxd-border text-[12px] space-y-2.5 shadow-md">
                          <textarea
                            value={draftCommentText}
                            onChange={(e) => setDraftCommentText(e.target.value)}
                            onKeyDown={(e) => {
                              if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
                                handleAddInlineComment(lineNum!);
                              } else if (e.key === "Escape") {
                                setActiveCommentLine(null);
                                setDraftCommentText("");
                              }
                            }}
                            placeholder="Write a comment... (Cmd+Enter to send, Esc to cancel)"
                            className="w-full bg-[#111111] border border-praxd-border-soft rounded p-2.5 text-praxd-text placeholder-praxd-text-muted focus:outline-none focus:border-praxd-blue text-[12px] font-sans"
                            rows={3}
                            autoFocus
                          />
                          <div className="flex items-center justify-end gap-2 text-[11px]">
                            <button
                              type="button"
                              onClick={() => {
                                setActiveCommentLine(null);
                                setDraftCommentText("");
                              }}
                              className="px-2.5 py-1 text-praxd-text-muted hover:text-praxd-text transition-colors"
                            >
                              Cancel
                            </button>
                            <button
                              type="button"
                              onClick={() => handleAddInlineComment(lineNum!)}
                              disabled={!draftCommentText.trim()}
                              className="px-3 py-1 rounded bg-praxd-blue hover:bg-blue-600 text-white font-medium disabled:opacity-40 transition-colors shadow-sm"
                            >
                              Add comment
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
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
              <span>Dual-Pane Sync Scroll</span>
            </div>
            <span className="font-mono text-[11px] text-neutral-400">
              {Math.round(scrollX)}px / {Math.round(maxScrollX)}px
            </span>
            {scrollX > 0 && (
              <button
                type="button"
                onClick={() => setScrollX(0)}
                className="text-[11px] text-praxd-blue hover:text-blue-400 underline font-medium transition-colors"
              >
                Reset to start
              </button>
            )}
          </div>

          {/* Center / Right: Interactive Track & Draggable Thumb */}
          <div className="flex items-center gap-2 flex-1 max-w-md ml-6">
            {/* Step Left */}
            <button
              type="button"
              onClick={() => setScrollX((prev) => Math.max(0, prev - 80))}
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
              onClick={() => setScrollX((prev) => Math.min(maxScrollX, prev + 80))}
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
}
