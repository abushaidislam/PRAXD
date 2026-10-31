"use client";

import React, { useState, useEffect } from "react";
import {
  ChevronDown,
  ChevronRight,
  GitCommit,
  GitPullRequest,
  MoreHorizontal,
  ArrowUp,
  ShieldAlert,
  Loader2,
  Copy,
  Check,
} from "lucide-react";
import { PullRequest, PRComment } from "@/types/pr";
import { MarkdownContent } from "./markdown-content";

interface ActivityTimelineProps {
  pr: PullRequest;
  onCommentAdded?: (comment: PRComment) => void;
}

function formatRelativeTime(dateStr?: string): string {
  if (!dateStr) return "now";
  const diffMs = Date.now() - new Date(dateStr).getTime();
  if (isNaN(diffMs) || diffMs < 0) return "now";
  const sec = Math.floor(diffMs / 1000);
  if (sec < 60) return `${sec}s`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h`;
  const days = Math.floor(hr / 24);
  if (days < 30) return `${days}d`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months}mo`;
  return `${Math.floor(months / 12)}y`;
}

export function ActivityTimeline({ pr, onCommentAdded }: ActivityTimelineProps) {
  const [isExpanded, setIsExpanded] = useState(true);
  const [commentText, setCommentText] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [copiedCommentId, setCopiedCommentId] = useState<string | null>(null);
  const [copiedSha, setCopiedSha] = useState<string | null>(null);
  const [localComments, setLocalComments] = useState<PRComment[]>(() =>
    pr.comments.filter((c) => c.commentType === "issue")
  );

  const handleCopySha = (sha: string) => {
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText(sha);
      setCopiedSha(sha);
      setTimeout(() => setCopiedSha(null), 1500);
    }
  };

  // Sync comments on PR change and load fresh comments from API
  useEffect(() => {
    setLocalComments(pr.comments.filter((c) => c.commentType === "issue"));

    let isMounted = true;
    async function loadFreshComments() {
      try {
        const res = await fetch(`/api/pull-requests/${pr.id}/comments`);
        if (res.ok) {
          const json = await res.json();
          const fetchedComments = json.comments || json.data?.comments;
          if (isMounted && Array.isArray(fetchedComments)) {
            setLocalComments(fetchedComments);
          }
        }
      } catch {
        // Fallback to initial comments
      }
    }

    loadFreshComments();
    return () => {
      isMounted = false;
    };
  }, [pr.id, pr.comments]);

  const totalEvents = pr.commits.length + 1 + localComments.length;

  const handleCopyComment = (commentId: string, text: string) => {
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText(text);
      setCopiedCommentId(commentId);
      setTimeout(() => setCopiedCommentId(null), 1500);
    }
  };

  const handleAddComment = async (e: React.FormEvent) => {
    e.preventDefault();
    const text = commentText.trim();
    if (!text || isSubmitting) return;

    setIsSubmitting(true);
    try {
      const res = await fetch(`/api/pull-requests/${pr.id}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: text }),
      });

      let addedComment: PRComment;
      if (res.ok) {
        const json = await res.json();
        addedComment = json.comment || json.data?.comment || {
          id: `c-local-${Date.now()}`,
          author: {
            login: pr.author.login,
            avatarUrl: pr.author.avatarUrl,
            name: pr.author.name,
          },
          body: text,
          createdAt: new Date().toISOString(),
          commentType: "issue",
        };
      } else {
        addedComment = {
          id: `c-local-${Date.now()}`,
          author: {
            login: pr.author.login,
            avatarUrl: pr.author.avatarUrl,
            name: pr.author.name,
          },
          body: text,
          createdAt: new Date().toISOString(),
          commentType: "issue",
        };
      }

      setLocalComments((prev) => [...prev, addedComment]);
      if (onCommentAdded) {
        onCommentAdded(addedComment);
      }
      setCommentText("");
    } catch {
      // Local fallback on network error
      const fallbackComment: PRComment = {
        id: `c-local-${Date.now()}`,
        author: {
          login: pr.author.login,
          avatarUrl: pr.author.avatarUrl,
          name: pr.author.name,
        },
        body: text,
        createdAt: new Date().toISOString(),
        commentType: "issue",
      };
      setLocalComments((prev) => [...prev, fallbackComment]);
      if (onCommentAdded) {
        onCommentAdded(fallbackComment);
      }
      setCommentText("");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-3 border-t border-praxd-border-soft pt-4 select-text">
      {/* Activity Heading with count */}
      <button
        type="button"
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex items-center gap-1.5 text-[14px] font-medium text-praxd-text hover:text-white transition-colors"
        aria-expanded={isExpanded}
      >
        <span>Activity</span>
        {isExpanded ? (
          <ChevronDown className="w-4 h-4 text-praxd-text-muted" />
        ) : (
          <ChevronRight className="w-4 h-4 text-praxd-text-muted" />
        )}
        <span className="text-[12px] text-praxd-text-muted font-normal ml-0.5">{totalEvents}</span>
      </button>

      {isExpanded && (
        <div className="space-y-3 pt-1">
          {/* Commits */}
          {pr.commits.map((commit) => (
            <div
              key={commit.sha}
              className="flex items-center justify-between p-2.5 rounded-lg bg-[#181818] border border-praxd-border-soft text-[12px] hover:border-praxd-border transition-colors"
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <GitCommit className="w-4 h-4 text-praxd-text-muted shrink-0" />
                <ShieldAlert className="w-3.5 h-3.5 text-praxd-blue shrink-0" />
                <span className="font-medium text-praxd-text truncate max-w-[420px]" title={commit.message}>
                  {commit.message}
                </span>
              </div>
              <div className="flex items-center gap-2.5 shrink-0 text-praxd-text-muted text-[11px]">
                <button
                  type="button"
                  onClick={() => handleCopySha(commit.sha)}
                  className="font-mono text-praxd-text-secondary hover:text-white px-1.5 py-0.5 rounded bg-[#1f1f1f] border border-praxd-border-soft flex items-center gap-1 transition-colors"
                  title={copiedSha === commit.sha ? "Copied SHA!" : `Copy full SHA: ${commit.sha}`}
                  aria-label={`Copy commit ${commit.shortSha}`}
                >
                  <span>{commit.shortSha}</span>
                  {copiedSha === commit.sha ? (
                    <Check className="w-2.5 h-2.5 text-praxd-green" />
                  ) : (
                    <Copy className="w-2.5 h-2.5 text-neutral-500" />
                  )}
                </button>
                <img
                  src={commit.author.avatarUrl || "https://github.com/ghost.png"}
                  alt={commit.author.login}
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = "https://github.com/ghost.png";
                  }}
                  className="w-4 h-4 rounded-full bg-[#2a2a2a]"
                />
                <span className="tabular-nums">{formatRelativeTime(commit.committedDate)}</span>
              </div>
            </div>
          ))}

          {/* PR Opened Event */}
          <div className="flex items-center justify-between p-2.5 rounded-lg bg-[#181818] border border-praxd-border-soft text-[12px]">
            <div className="flex items-center gap-2.5">
              <GitPullRequest className="w-4 h-4 text-praxd-green shrink-0" />
              <span className="text-praxd-text">
                <strong className="font-medium text-white">{pr.author.login}</strong> opened this pull request
              </span>
            </div>
            <span className="text-praxd-text-muted text-[11px]">{pr.relativeTime}</span>
          </div>

          {/* Comments with High-Fidelity Markdown & Bot Badges */}
          {localComments.map((comment) => {
            const isBot =
              comment.author.login.endsWith("[bot]") ||
              comment.author.login.toLowerCase().includes("bot");
            const isAuthor = comment.author.login === pr.author.login;
            const isCopied = copiedCommentId === comment.id;

            return (
              <div
                key={comment.id}
                className="rounded-xl bg-[#161616] border border-praxd-border-soft overflow-hidden shadow-sm transition-all"
              >
                {/* Comment Header Bar */}
                <div className="px-3.5 py-2 bg-[#1c1c1c] border-b border-praxd-border-soft flex items-center justify-between text-[12px]">
                  <div className="flex items-center gap-2 min-w-0">
                    <img
                      src={comment.author.avatarUrl || "https://github.com/ghost.png"}
                      alt={comment.author.login}
                      onError={(e) => {
                        (e.target as HTMLImageElement).src = "https://github.com/ghost.png";
                      }}
                      className="w-5 h-5 rounded-full bg-[#2a2a2a] shrink-0 border border-praxd-border-soft"
                    />
                    <span className="font-medium text-praxd-text truncate">
                      {comment.author.login}
                    </span>

                    {/* Bot Badge */}
                    {isBot && (
                      <span className="text-[10px] uppercase font-semibold px-1.5 py-0.2 rounded bg-[#252525] text-praxd-text-muted border border-praxd-border-soft tracking-wider shrink-0">
                        bot
                      </span>
                    )}

                    {/* PR Author Badge */}
                    {isAuthor && !isBot && (
                      <span className="text-[10px] uppercase font-semibold px-1.5 py-0.2 rounded bg-praxd-blue/15 text-praxd-blue border border-praxd-blue/30 tracking-wider shrink-0">
                        Author
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-2 text-praxd-text-muted text-[11.5px] shrink-0">
                    <span>{formatRelativeTime(comment.createdAt)}</span>
                    <button
                      type="button"
                      onClick={() => handleCopyComment(comment.id, comment.body)}
                      className="p-1 rounded hover:bg-[#282828] text-praxd-text-muted hover:text-praxd-text transition-colors"
                      title={isCopied ? "Copied!" : "Copy comment markdown"}
                      aria-label="Copy comment"
                    >
                      {isCopied ? (
                        <Check className="w-3.5 h-3.5 text-praxd-green" />
                      ) : (
                        <Copy className="w-3.5 h-3.5" />
                      )}
                    </button>
                  </div>
                </div>

                {/* Comment Markdown Body */}
                <div className="p-3.5 text-[12.5px] leading-relaxed select-text">
                  <MarkdownContent content={comment.body} />
                </div>
              </div>
            );
          })}

          {/* Leave a Comment Composer */}
          <form
            onSubmit={handleAddComment}
            className="mt-3 flex items-center gap-2.5 p-2 rounded-xl bg-[#1c1c1c] border border-praxd-border-soft focus-within:border-praxd-border transition-colors"
          >
            <img
              src={pr.author.avatarUrl || "https://github.com/ghost.png"}
              alt={pr.author.login}
              onError={(e) => {
                (e.target as HTMLImageElement).src = "https://github.com/ghost.png";
              }}
              className="w-6 h-6 rounded-full ml-1 bg-[#282828]"
            />
            <input
              type="text"
              value={commentText}
              onChange={(e) => setCommentText(e.target.value)}
              placeholder="Leave a comment on this pull request..."
              disabled={isSubmitting}
              className="flex-1 bg-transparent text-[12.5px] text-praxd-text placeholder-praxd-text-muted focus:outline-none"
            />
            <button
              type="submit"
              disabled={!commentText.trim() || isSubmitting}
              className="w-7 h-7 rounded-full bg-[#2c2c2c] hover:bg-[#383838] disabled:opacity-40 disabled:hover:bg-[#2c2c2c] flex items-center justify-center text-praxd-text transition-colors"
              aria-label="Send comment"
            >
              {isSubmitting ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <ArrowUp className="w-3.5 h-3.5" />
              )}
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
