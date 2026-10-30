import React, { useState, useMemo } from "react";
import {
  Plus,
  ChevronDown,
  ChevronRight,
  FileX,
  CornerDownRight,
  MessageSquare,
  Check,
} from "lucide-react";
import { ChangedFile, PRComment, AIFinding, DiffLine } from "@/types/pr";
import { AIReviewCard } from "./ai-review-card";
import { buildSplitRows, parsePatchToLines, SplitRow } from "@/lib/diff-parser";
import { cn } from "@/lib/utils";

interface DiffViewerProps {
  file: ChangedFile;
  diffMode: "split" | "unified";
  comments: PRComment[];
  aiFindings?: AIFinding[];
  wrapLines?: boolean;
}

export function DiffViewer({
  file,
  diffMode,
  comments,
  aiFindings = [],
  wrapLines = false,
}: DiffViewerProps) {
  const [unmodifiedExpanded, setUnmodifiedExpanded] = useState(false);
  const [activeCommentLine, setActiveCommentLine] = useState<number | null>(null);
  const [draftCommentText, setDraftCommentText] = useState("");
  const [localInlineComments, setLocalInlineComments] = useState<PRComment[]>(
    comments.filter((c) => c.commentType === "review" && c.path === file.filename)
  );

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

  // Scenario P0-06: File without patch or binary file
  if (effectiveLines.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-center text-praxd-text-muted space-y-3 bg-[#131313] border border-praxd-border-soft rounded-lg m-4">
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

  // Realistic mock context lines revealed when unmodified lines are expanded
  const expandedContextLines = [
    { oldNum: 1638, newNum: 1638, text: "    // Initialize overlay manager" },
    { oldNum: 1639, newNum: 1639, text: "    const banner = document.createElement('div');" },
    { oldNum: 1640, newNum: 1640, text: "    banner.className = 'zcrap-inspector-banner';" },
  ];

  return (
    <div className="flex-1 flex flex-col min-w-0 bg-[#0e0e0e] select-text">
      {/* File Header Bar */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-praxd-border-soft bg-[#151515] text-[12px] shrink-0">
        <div className="flex items-center gap-2">
          <span className="px-1.5 py-0.5 rounded text-[10px] bg-yellow-950/50 text-amber-300 font-mono font-bold border border-yellow-700/40">
            JS
          </span>
          <span className="font-mono text-praxd-text font-medium">{file.filename}</span>
          <div className="flex items-center gap-1 font-mono text-[11px] ml-1">
            <span className="text-praxd-green font-medium">+{file.additions}</span>
            <span className="text-praxd-red font-medium">-{file.deletions}</span>
          </div>
        </div>

        <div className="flex items-center gap-2 text-[11px] text-praxd-text-muted font-mono">
          <span>{effectiveLines.length} diff lines</span>
        </div>
      </div>

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
                  <div className="flex-1 px-3 text-neutral-400 whitespace-pre">
                    {ctx.text}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Main Diff Content Container */}
      <div className="flex-1 overflow-auto font-code text-[12px] leading-5 bg-[#0e0e0e]">
        {diffMode === "split" ? (
          /* ================= SYNCHRONIZED SPLIT DIFF ================= */
          <div className="min-w-[960px] divide-y divide-praxd-border-soft/20">
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
              const hasAnnotation = lineComments.length > 0 || lineAiFindings.length > 0 || activeCommentLine === rightLineNum;

              return (
                <div key={row.id} className="flex flex-col">
                  {/* Paired Line Row (Left & Right synchronized) */}
                  <div className="flex items-stretch group hover:bg-[#161616] transition-colors">
                    {/* LEFT COLUMN: Old Revision */}
                    <div
                      className={cn(
                        "w-1/2 flex border-r border-praxd-border-soft/60 border-l-2",
                        row.left?.type === "deletion"
                          ? "bg-[#281416]/50 border-praxd-red"
                          : "border-transparent bg-transparent"
                      )}
                    >
                      {/* Gutter */}
                      <div className="w-12 shrink-0 px-2 text-right select-none text-[11px] text-praxd-text-muted tabular-nums relative flex items-center justify-end">
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

                      {/* Code */}
                      <div
                        className={cn(
                          "flex-1 px-3 text-praxd-text min-w-0",
                          wrapLines ? "whitespace-pre-wrap break-words" : "whitespace-pre overflow-x-auto"
                        )}
                      >
                        {row.left
                          ? renderHighlightedCode(row.left.content, row.left.type === "deletion")
                          : <span className="text-neutral-700 select-none">&nbsp;</span>}
                      </div>
                    </div>

                    {/* RIGHT COLUMN: New Revision */}
                    <div
                      className={cn(
                        "w-1/2 flex border-l-2",
                        row.right?.type === "addition"
                          ? "bg-[#122619]/50 border-praxd-green"
                          : "border-transparent bg-transparent"
                      )}
                    >
                      {/* Gutter */}
                      <div className="w-12 shrink-0 px-2 text-right select-none text-[11px] text-praxd-text-muted tabular-nums relative flex items-center justify-end">
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

                      {/* Code */}
                      <div
                        className={cn(
                          "flex-1 px-3 text-praxd-text min-w-0",
                          wrapLines ? "whitespace-pre-wrap break-words" : "whitespace-pre overflow-x-auto"
                        )}
                      >
                        {row.right
                          ? renderHighlightedCode(row.right.content, false, row.right.type === "addition")
                          : <span className="text-neutral-700 select-none">&nbsp;</span>}
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
          <div className="min-w-[760px] divide-y divide-praxd-border-soft/20">
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
              const hasAnnotation = lineComments.length > 0 || lineAiFindings.length > 0 || activeCommentLine === lineNum;

              return (
                <div key={`uni-${idx}`} className="flex flex-col">
                  <div
                    className={cn(
                      "flex items-stretch group hover:bg-[#161616] transition-colors border-l-2",
                      isAddition
                        ? "bg-[#122619]/50 border-praxd-green"
                        : isDeletion
                        ? "bg-[#281416]/50 border-praxd-red"
                        : "border-transparent"
                    )}
                  >
                    {/* Old line number */}
                    <div className="w-12 shrink-0 px-2 text-right select-none text-[11px] text-praxd-text-muted tabular-nums">
                      {line.oldLineNumber || ""}
                    </div>

                    {/* New line number + Hover '+' button */}
                    <div className="w-12 shrink-0 px-2 text-right select-none text-[11px] text-praxd-text-muted border-r border-praxd-border-soft/60 tabular-nums relative flex items-center justify-end">
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
                    <div className="w-6 shrink-0 text-center select-none text-neutral-500 font-mono">
                      {isAddition ? "+" : isDeletion ? "-" : " "}
                    </div>

                    {/* Code Content */}
                    <div
                      className={cn(
                        "flex-1 px-3 text-praxd-text min-w-0",
                        wrapLines ? "whitespace-pre-wrap break-words" : "whitespace-pre overflow-x-auto"
                      )}
                    >
                      {renderHighlightedCode(line.content, isDeletion, isAddition)}
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
    </div>
  );
}
