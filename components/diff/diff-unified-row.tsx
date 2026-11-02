"use client";

import React from "react";
import { Plus } from "lucide-react";
import { DiffLine } from "@/types/pr";
import { PRComment, AIFinding } from "@/types/pr";
import { cn } from "@/lib/utils";
import { AIReviewCard } from "../ai-review-card";
import { renderHighlightedCode } from "./diff-syntax";

export interface DiffUnifiedRowProps {
  line: DiffLine;
  idx: number;
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

export function DiffUnifiedRow({
  line,
  idx,
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
}: DiffUnifiedRowProps) {
  const isAddition = line.type === "addition";
  const isDeletion = line.type === "deletion";
  const lineNum = line.newLineNumber || line.oldLineNumber;

  const lineComments = line.newLineNumber
    ? localInlineComments.filter((c) => c.line === line.newLineNumber)
    : [];
  const lineAiFindings = line.newLineNumber
    ? aiFindings.filter((f) => f.filePath === filename && f.line === line.newLineNumber)
    : [];
  const hasAnnotation =
    lineComments.length > 0 || lineAiFindings.length > 0 || activeCommentLine === lineNum;

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
        <div className="w-12 shrink-0 px-2 text-right select-none text-[11px] text-praxd-text-muted tabular-nums bg-[#0e0e0e] z-[1]">
          {line.oldLineNumber || ""}
        </div>

        {/* New line number + Hover '+' button */}
        <div className="w-12 shrink-0 px-2 text-right select-none text-[11px] text-praxd-text-muted border-r border-praxd-border-soft/60 tabular-nums relative flex items-center justify-end bg-[#0e0e0e] z-[1]">
          <span className="group-hover:opacity-0 transition-opacity">
            {line.newLineNumber || ""}
          </span>
          {lineNum && (
            <button
              type="button"
              onClick={() => onSetActiveCommentLine(lineNum)}
              className="absolute inset-0 m-auto w-4 h-4 rounded bg-[#2b2b2b] text-praxd-text opacity-0 group-hover:opacity-100 flex items-center justify-center hover:bg-praxd-blue hover:text-white transition-all shadow-sm"
              title={`Comment on line ${lineNum}`}
              aria-label={`Comment on line ${lineNum}`}
            >
              <Plus className="w-3 h-3" />
            </button>
          )}
        </div>

        {/* Prefix sign (+ / -) */}
        <div className="w-6 shrink-0 text-center select-none text-neutral-500 font-mono bg-[#0e0e0e] z-[1]">
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
                onChange={(e) => onDraftCommentChange(e.target.value)}
                onKeyDown={(e) => {
                  if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
                    onAddInlineComment(lineNum!);
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
              <div className="flex items-center justify-end gap-2 text-[11px]">
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
                  onClick={() => onAddInlineComment(lineNum!)}
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
}
