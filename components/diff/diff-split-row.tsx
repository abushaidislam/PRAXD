"use client";

import React from "react";
import { Plus, MessageSquare } from "lucide-react";
import { SplitRow } from "@/lib/diff-parser";
import { PRComment, AIFinding } from "@/types/pr";
import { cn } from "@/lib/utils";
import { AIReviewCard } from "../ai-review-card";
import { renderHighlightedCode } from "./diff-syntax";

export interface DiffSplitRowProps {
  row: SplitRow;
  wrapLines: boolean;
  scrollX: number;
  isDragging: boolean;
  localInlineComments: PRComment[];
  aiFindings: AIFinding[];
  filename: string;
  activeCommentLine: number | null;
  draftCommentText: string;
  onSetActiveCommentLine: (line: number | null) => void;
  onDraftCommentChange: (text: string) => void;
  onAddInlineComment: (line: number) => void;
}

export function DiffSplitRow({
  row,
  wrapLines,
  scrollX,
  isDragging,
  localInlineComments,
  aiFindings,
  filename,
  activeCommentLine,
  draftCommentText,
  onSetActiveCommentLine,
  onDraftCommentChange,
  onAddInlineComment,
}: DiffSplitRowProps) {
  const rightLineNum = row.right?.lineNumber;

  // Check for inline comments and AI findings on right side line
  const lineComments = rightLineNum
    ? localInlineComments.filter((c) => c.line === rightLineNum)
    : [];
  const lineAiFindings = rightLineNum
    ? aiFindings.filter((f) => f.filePath === filename && f.line === rightLineNum)
    : [];
  const hasAnnotation =
    lineComments.length > 0 || lineAiFindings.length > 0 || activeCommentLine === rightLineNum;

  return (
    <div className="flex flex-col">
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
          <div className="w-12 shrink-0 px-2 text-right select-none text-[11px] text-praxd-text-muted tabular-nums relative flex items-center justify-end z-[1] border-r border-praxd-border-soft/40 bg-[#0e0e0e]">
            <span className="group-hover:opacity-0 transition-opacity">
              {row.left?.lineNumber || ""}
            </span>
            {row.left?.lineNumber && (
              <button
                type="button"
                onClick={() => onSetActiveCommentLine(row.left?.lineNumber!)}
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
          <div className="w-12 shrink-0 px-2 text-right select-none text-[11px] text-praxd-text-muted tabular-nums relative flex items-center justify-end z-[1] border-r border-praxd-border-soft/40 bg-[#0e0e0e]">
            <span className="group-hover:opacity-0 transition-opacity">
              {row.right?.lineNumber || ""}
            </span>
            {row.right?.lineNumber && (
              <button
                type="button"
                onClick={() => onSetActiveCommentLine(row.right?.lineNumber!)}
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
                  onChange={(e) => onDraftCommentChange(e.target.value)}
                  onKeyDown={(e) => {
                    if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
                      onAddInlineComment(rightLineNum!);
                    } else if (e.key === "Escape") {
                      onSetActiveCommentLine(null);
                      onDraftCommentChange("");
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
                        onSetActiveCommentLine(null);
                        onDraftCommentChange("");
                      }}
                      className="px-2.5 py-1 text-praxd-text-muted hover:text-praxd-text transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={() => onAddInlineComment(rightLineNum!)}
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
}
