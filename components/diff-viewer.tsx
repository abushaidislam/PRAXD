import React, { useState } from "react";
import { Plus, ChevronDown, ChevronRight, FileX } from "lucide-react";
import { ChangedFile, PRComment, AIFinding } from "@/types/pr";
import { AIReviewCard } from "./ai-review-card";
import { cn } from "@/lib/utils";

interface DiffViewerProps {
  file: ChangedFile;
  diffMode: "split" | "unified";
  comments: PRComment[];
  aiFindings?: AIFinding[];
}

export function DiffViewer({
  file,
  diffMode,
  comments,
  aiFindings = [],
}: DiffViewerProps) {
  const [unmodifiedExpanded, setUnmodifiedExpanded] = useState(false);
  const [activeCommentLine, setActiveCommentLine] = useState<number | null>(null);
  const [draftCommentText, setDraftCommentText] = useState("");
  const [localInlineComments, setLocalInlineComments] = useState<PRComment[]>(
    comments.filter((c) => c.commentType === "review" && c.path === file.filename)
  );

  // Scenario P0-06: File without patch or binary file
  if (!file.lines || file.lines.length === 0) {
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

  // Syntax highlighter helper for JavaScript lines
  const renderHighlightedCode = (text: string) => {
    // Basic regex-based syntax tokenization for clean presentation
    if (text.trim().startsWith("//")) {
      return <span className="text-[#6e7681] italic">{text}</span>;
    }

    const tokens = text.split(/(\b(?:const|let|var|function|return|import|export|if|else|true|false)\b|'[^']*'|"[^"]*"|`[^`]*`)/g);

    return (
      <>
        {tokens.map((token, i) => {
          if (["const", "let", "var", "function", "return", "import", "export", "if", "else"].includes(token)) {
            return (
              <span key={i} className="text-[#ff7b72] font-semibold">
                {token}
              </span>
            );
          }
          if (["true", "false"].includes(token)) {
            return (
              <span key={i} className="text-[#79c0ff]">
                {token}
              </span>
            );
          }
          if ((token.startsWith("'") && token.endsWith("'")) || (token.startsWith('"') && token.endsWith('"')) || (token.startsWith("`") && token.endsWith("`"))) {
            return (
              <span key={i} className="text-[#a5d6ff]">
                {token}
              </span>
            );
          }
          return <span key={i}>{token}</span>;
        })}
      </>
    );
  };

  // Split lines into left side and right side
  // In split diff, deletions go left, additions go right, context lines go both
  return (
    <div className="flex-1 flex flex-col min-w-0 bg-[#121212] select-text">
      {/* File Header Bar */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-praxd-border-soft bg-[#171717] text-[12px] shrink-0">
        <div className="flex items-center gap-2">
          <span className="px-1 py-0.5 rounded text-[10px] bg-yellow-950/40 text-amber-300 font-mono font-bold border border-yellow-800/40">
            JS
          </span>
          <span className="font-mono text-praxd-text font-medium">{file.filename}</span>
          <div className="flex items-center gap-1 font-mono text-[11px] ml-1">
            <span className="text-praxd-green">+{file.additions}</span>
            <span className="text-praxd-red">-{file.deletions}</span>
          </div>
        </div>
      </div>

      {/* Unmodified Lines Bar */}
      {file.unmodifiedLinesBefore && (
        <div className="flex items-center justify-center py-1.5 px-4 bg-[#161616] border-b border-praxd-border-soft text-[11px] text-praxd-text-muted font-mono select-none">
          <button
            type="button"
            onClick={() => setUnmodifiedExpanded(!unmodifiedExpanded)}
            className="flex items-center gap-1.5 hover:text-praxd-text transition-colors"
          >
            {unmodifiedExpanded ? (
              <ChevronDown className="w-3.5 h-3.5" />
            ) : (
              <ChevronRight className="w-3.5 h-3.5" />
            )}
            <span>
              {unmodifiedExpanded ? "Collapse unchanged lines" : `${file.unmodifiedLinesBefore} unmodified lines`}
            </span>
          </button>
        </div>
      )}

      {/* Main Diff Content with horizontal scrolling contained within the container */}
      <div className="flex-1 overflow-x-auto overflow-y-auto font-code text-[12px] leading-5">
        {diffMode === "split" ? (
          /* ================= SPLIT (SIDE-BY-SIDE) DIFF ================= */
          <div className="min-w-[900px] flex">
            {/* Left Side: Old Revision */}
            <div className="w-1/2 border-r border-praxd-border-soft overflow-x-auto">
              {file.lines.map((line, idx) => {
                // If it's an addition only, show empty line placeholder on the left side
                if (line.type === "addition") {
                  return (
                    <div key={`left-${idx}`} className="h-5 bg-[#141414] border-b border-transparent" />
                  );
                }

                const isDeletion = line.type === "deletion";

                return (
                  <div
                    key={`left-${idx}`}
                    className={cn(
                      "flex items-stretch group hover:bg-[#1f1f1f] transition-colors border-l-2",
                      isDeletion ? "bg-[#381a1a]/40 border-praxd-red" : "border-transparent"
                    )}
                  >
                    {/* Line number gutter with '+' hover affordance */}
                    <div className="w-12 shrink-0 px-2 text-right select-none text-[11px] text-praxd-text-muted relative flex items-center justify-end group">
                      <span className="group-hover:opacity-0 transition-opacity">
                        {line.oldLineNumber}
                      </span>
                      <button
                        type="button"
                        onClick={() => setActiveCommentLine(line.oldLineNumber || idx)}
                        className="absolute inset-0 m-auto w-4 h-4 rounded bg-[#2b2b2b] text-praxd-text opacity-0 group-hover:opacity-100 flex items-center justify-center hover:bg-praxd-blue hover:text-white transition-all shadow-sm"
                        title="Add comment to line"
                        aria-label={`Comment on line ${line.oldLineNumber}`}
                      >
                        <Plus className="w-3 h-3" />
                      </button>
                    </div>

                    {/* Code Content */}
                    <div className="flex-1 px-3 whitespace-pre overflow-x-auto text-praxd-text">
                      {renderHighlightedCode(line.content)}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Right Side: New Revision */}
            <div className="w-1/2 overflow-x-auto">
              {file.lines.map((line, idx) => {
                // If it's a deletion only, show empty line placeholder on the right side
                if (line.type === "deletion") {
                  return (
                    <div key={`right-${idx}`} className="h-5 bg-[#141414] border-b border-transparent" />
                  );
                }

                const isAddition = line.type === "addition";
                const lineNum = line.newLineNumber;

                // Check for inline comments and AI findings on this line
                const lineComments = localInlineComments.filter((c) => c.line === lineNum);
                const lineAiFindings = aiFindings.filter(
                  (f) => f.filePath === file.filename && f.line === lineNum
                );

                return (
                  <div key={`right-${idx}`}>
                    <div
                      className={cn(
                        "flex items-stretch group hover:bg-[#1f1f1f] transition-colors border-l-2",
                        isAddition ? "bg-[#183622]/40 border-praxd-green" : "border-transparent"
                      )}
                    >
                      {/* Line number gutter with '+' hover affordance */}
                      <div className="w-12 shrink-0 px-2 text-right select-none text-[11px] text-praxd-text-muted relative flex items-center justify-end group">
                        <span className="group-hover:opacity-0 transition-opacity">
                          {line.newLineNumber}
                        </span>
                        <button
                          type="button"
                          onClick={() => setActiveCommentLine(line.newLineNumber || idx)}
                          className="absolute inset-0 m-auto w-4 h-4 rounded bg-[#2b2b2b] text-praxd-text opacity-0 group-hover:opacity-100 flex items-center justify-center hover:bg-praxd-blue hover:text-white transition-all shadow-sm"
                          title="Add comment to line"
                          aria-label={`Comment on line ${line.newLineNumber}`}
                        >
                          <Plus className="w-3 h-3" />
                        </button>
                      </div>

                      {/* Code Content */}
                      <div className="flex-1 px-3 whitespace-pre overflow-x-auto text-praxd-text">
                        {renderHighlightedCode(line.content)}
                      </div>
                    </div>

                    {/* AI Finding Card Anchor beneath line */}
                    {lineAiFindings.map((finding) => (
                      <AIReviewCard key={finding.id} finding={finding} />
                    ))}

                    {/* Existing Inline Comments */}
                    {lineComments.map((comm) => (
                      <div
                        key={comm.id}
                        className="my-2 mx-4 p-3 rounded-lg bg-[#181818] border border-praxd-border-soft text-[12px] font-sans"
                      >
                        <div className="flex items-center justify-between mb-1.5">
                          <div className="flex items-center gap-2">
                            <img
                              src={comm.author.avatarUrl}
                              alt={comm.author.login}
                              className="w-4 h-4 rounded-full"
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
                    {activeCommentLine === lineNum && (
                      <div className="my-2 mx-4 p-3 rounded-lg bg-[#1a1a1a] border border-praxd-border text-[12px] font-sans space-y-2">
                        <textarea
                          value={draftCommentText}
                          onChange={(e) => setDraftCommentText(e.target.value)}
                          placeholder={`Leave a comment on line ${lineNum}...`}
                          className="w-full bg-[#141414] border border-praxd-border-soft rounded p-2 text-praxd-text placeholder-praxd-text-muted focus:outline-none focus:border-praxd-blue"
                          rows={2}
                          autoFocus
                        />
                        <div className="flex items-center justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              setActiveCommentLine(null);
                              setDraftCommentText("");
                            }}
                            className="px-2.5 py-1 text-[11px] text-praxd-text-muted hover:text-praxd-text"
                          >
                            Cancel
                          </button>
                          <button
                            type="button"
                            onClick={() => handleAddInlineComment(lineNum!)}
                            disabled={!draftCommentText.trim()}
                            className="px-3 py-1 rounded bg-praxd-blue text-white text-[11px] font-medium disabled:opacity-40"
                          >
                            Add comment
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          /* ================= UNIFIED DIFF MODE ================= */
          <div className="min-w-[700px]">
            {file.lines.map((line, idx) => {
              const isAddition = line.type === "addition";
              const isDeletion = line.type === "deletion";
              const lineNum = line.newLineNumber || line.oldLineNumber;

              const lineComments = localInlineComments.filter((c) => c.line === line.newLineNumber);
              const lineAiFindings = aiFindings.filter(
                (f) => f.filePath === file.filename && f.line === line.newLineNumber
              );

              return (
                <div key={`uni-${idx}`}>
                  <div
                    className={cn(
                      "flex items-stretch group hover:bg-[#1f1f1f] transition-colors border-l-2",
                      isAddition
                        ? "bg-[#183622]/40 border-praxd-green"
                        : isDeletion
                        ? "bg-[#381a1a]/40 border-praxd-red"
                        : "border-transparent"
                    )}
                  >
                    {/* Old line number */}
                    <div className="w-12 shrink-0 px-2 text-right select-none text-[11px] text-praxd-text-muted">
                      {line.oldLineNumber}
                    </div>

                    {/* New line number */}
                    <div className="w-12 shrink-0 px-2 text-right select-none text-[11px] text-praxd-text-muted border-r border-praxd-border-soft relative flex items-center justify-end group">
                      <span className="group-hover:opacity-0 transition-opacity">
                        {line.newLineNumber}
                      </span>
                      <button
                        type="button"
                        onClick={() => setActiveCommentLine(lineNum || idx)}
                        className="absolute inset-0 m-auto w-4 h-4 rounded bg-[#2b2b2b] text-praxd-text opacity-0 group-hover:opacity-100 flex items-center justify-center hover:bg-praxd-blue hover:text-white transition-all shadow-sm"
                        title="Add comment to line"
                        aria-label={`Comment on line ${lineNum}`}
                      >
                        <Plus className="w-3 h-3" />
                      </button>
                    </div>

                    {/* Code Content */}
                    <div className="flex-1 px-3 whitespace-pre overflow-x-auto text-praxd-text">
                      {renderHighlightedCode(line.content)}
                    </div>
                  </div>

                  {/* AI Finding Card Anchor */}
                  {lineAiFindings.map((finding) => (
                    <AIReviewCard key={finding.id} finding={finding} />
                  ))}

                  {/* Inline Comments */}
                  {lineComments.map((comm) => (
                    <div
                      key={comm.id}
                      className="my-2 mx-8 p-3 rounded-lg bg-[#181818] border border-praxd-border-soft text-[12px] font-sans"
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-semibold text-praxd-text">{comm.author.login}</span>
                        <span className="text-[11px] text-praxd-text-muted">1h ago</span>
                      </div>
                      <p className="text-praxd-text-secondary leading-relaxed">{comm.body}</p>
                    </div>
                  ))}

                  {/* Active Comment composer */}
                  {activeCommentLine === lineNum && (
                    <div className="my-2 mx-8 p-3 rounded-lg bg-[#1a1a1a] border border-praxd-border text-[12px] font-sans space-y-2">
                      <textarea
                        value={draftCommentText}
                        onChange={(e) => setDraftCommentText(e.target.value)}
                        placeholder={`Leave a comment on line ${lineNum}...`}
                        className="w-full bg-[#141414] border border-praxd-border-soft rounded p-2 text-praxd-text placeholder-praxd-text-muted focus:outline-none focus:border-praxd-blue"
                        rows={2}
                        autoFocus
                      />
                      <div className="flex items-center justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            setActiveCommentLine(null);
                            setDraftCommentText("");
                          }}
                          className="px-2.5 py-1 text-[11px] text-praxd-text-muted hover:text-praxd-text"
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          onClick={() => handleAddInlineComment(lineNum!)}
                          disabled={!draftCommentText.trim()}
                          className="px-3 py-1 rounded bg-praxd-blue text-white text-[11px] font-medium disabled:opacity-40"
                        >
                          Add comment
                        </button>
                      </div>
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
