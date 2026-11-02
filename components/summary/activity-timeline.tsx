"use client";

import React, { useState, useEffect } from "react";
import {
  ChevronDown,
  ChevronRight,
  GitCommit,
  GitPullRequest,
  MoreHorizontal,
  ShieldAlert,
} from "lucide-react";
import { PullRequest, PRComment } from "@/types/pr";
import { MarkdownContent } from "../markdown-content";
import { CopyIcon } from "../copy-icon";
import { CommentComposer } from "./comment-composer";

export interface ActivityTimelineProps {
  pr: PullRequest;
  onCommentAdded?: (comment: PRComment) => void;
  onCommentsLoaded?: (comments: PRComment[]) => void;
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

export function ActivityTimeline({
  pr,
  onCommentAdded,
  onCommentsLoaded,
}: ActivityTimelineProps) {
  const [isExpanded, setIsExpanded] = useState(true);
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
            if (onCommentsLoaded) {
              onCommentsLoaded(fetchedComments);
            }
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
  }, [pr.id, pr.comments, onCommentsLoaded]);

  const totalEvents = pr.commits.length + 1 + localComments.length;

  const handleCopyComment = (commentId: string, text: string) => {
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText(text);
      setCopiedCommentId(commentId);
      setTimeout(() => setCopiedCommentId(null), 1500);
    }
  };

  return (
    <div className="space-y-3 border-t border-praxd-border-soft pt-4 select-text">
      {/* Activity Timeline Section Header */}
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => setIsExpanded(!isExpanded)}
          className="flex items-center gap-2 text-left group"
        >
          {isExpanded ? (
            <ChevronDown className="w-4 h-4 text-praxd-text-muted group-hover:text-praxd-text transition-colors" />
          ) : (
            <ChevronRight className="w-4 h-4 text-praxd-text-muted group-hover:text-praxd-text transition-colors" />
          )}
          <span className="text-[13px] font-semibold text-praxd-text group-hover:text-white transition-colors">
            Activity Timeline
          </span>
          <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-[#1b1b1b] border border-praxd-border-soft text-praxd-text-muted">
            {totalEvents}
          </span>
        </button>

        <span className="text-[11px] text-praxd-text-muted font-sans">
          {pr.commits.length} commits · {localComments.length} comments
        </span>
      </div>

      {isExpanded && (
        <div className="relative pl-6 space-y-4 pt-1">
          {/* Vertical Connecting Rail */}
          <div className="absolute left-[11px] top-2 bottom-3 w-[2px] bg-praxd-border-soft rounded-full" />

          {/* Event 1: PR Creation Node */}
          <div className="relative flex items-start gap-3 text-[12.5px]">
            <div className="absolute -left-6 mt-1 w-5 h-5 rounded-full bg-[#161616] border-2 border-praxd-green flex items-center justify-center shadow-xs">
              <GitPullRequest className="w-2.5 h-2.5 text-praxd-green" />
            </div>

            <div className="flex items-center gap-2 flex-wrap text-praxd-text min-w-0">
              <img
                src={pr.author.avatarUrl}
                alt={pr.author.login}
                className="w-4 h-4 rounded-full ring-1 ring-white/10"
              />
              <span className="font-semibold">{pr.author.login}</span>
              <span className="text-praxd-text-muted">opened this pull request</span>
              <span className="text-[11px] text-praxd-text-muted">
                {formatRelativeTime(pr.createdAt)}
              </span>
            </div>
          </div>

          {/* Event 2: Commits Group */}
          {pr.commits.map((commit) => (
            <div
              key={commit.sha}
              className="relative flex items-start justify-between gap-3 text-[12px] group"
            >
              <div className="absolute -left-6 mt-1 w-5 h-5 rounded-full bg-[#141414] border border-praxd-border-soft flex items-center justify-center">
                <GitCommit className="w-2.5 h-2.5 text-praxd-text-muted group-hover:text-praxd-text transition-colors" />
              </div>

              <div className="flex items-center gap-2 min-w-0 flex-1">
                <span className="font-medium text-praxd-text truncate max-w-md">
                  {commit.message}
                </span>
                <span className="text-[11px] text-praxd-text-muted shrink-0 hidden sm:inline">
                  {commit.author.login}
                </span>
              </div>

              <div className="flex items-center gap-1.5 shrink-0">
                <CopyIcon
                  value={commit.sha}
                  copied={copiedSha === commit.sha}
                  size={13}
                  strokeWidth={2}
                  className="p-1 rounded hover:bg-[#202020] text-praxd-text-muted hover:text-praxd-text transition-colors"
                  title={copiedSha === commit.sha ? "Copied!" : "Copy commit SHA"}
                  aria-label="Copy commit SHA"
                  onClick={() => handleCopySha(commit.sha)}
                />
                <span className="font-mono text-[11px] text-praxd-blue bg-praxd-blue/10 px-1.5 py-0.5 rounded border border-praxd-blue/20">
                  {commit.sha.substring(0, 7)}
                </span>
                <span className="text-[11px] text-praxd-text-muted hidden md:inline">
                  {formatRelativeTime(commit.committedDate)}
                </span>
              </div>
            </div>
          ))}

          {/* Event 3: Issue Discussion Comments */}
          {localComments.map((comment) => {
            const isBot =
              comment.author.login.includes("[bot]") ||
              comment.author.login.includes("praxd-app") ||
              comment.author.login.toLowerCase().includes("codex");
            const isAuthor = comment.author.login === pr.author.login;
            const isCopied = copiedCommentId === comment.id;

            return (
              <div
                key={comment.id}
                className="relative rounded-xl bg-[#141414] border border-praxd-border-soft overflow-hidden shadow-xs"
              >
                {/* Node marker on rail */}
                <div className="absolute -left-6 top-3 w-5 h-5 rounded-full bg-[#181818] border border-praxd-border flex items-center justify-center">
                  <div className="w-1.5 h-1.5 rounded-full bg-praxd-blue" />
                </div>

                {/* Comment Box Header */}
                <div className="px-3.5 py-2 bg-[#191919] border-b border-praxd-border-soft flex items-center justify-between text-[12px]">
                  <div className="flex items-center gap-2">
                    <img
                      src={comment.author.avatarUrl}
                      alt={comment.author.login}
                      onError={(e) => {
                        (e.target as HTMLImageElement).src = "https://github.com/ghost.png";
                      }}
                      className="w-4 h-4 rounded-full ring-1 ring-white/10"
                    />
                    <span className="font-semibold text-praxd-text">{comment.author.login}</span>

                    {/* Role Badges */}
                    {isBot && (
                      <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-praxd-blue/15 text-praxd-blue border border-praxd-blue/30 uppercase font-semibold">
                        bot
                      </span>
                    )}
                    {isAuthor && !isBot && (
                      <span className="text-[10px] px-1.5 py-0.2 rounded bg-[#252525] text-praxd-text-muted border border-praxd-border-soft">
                        Author
                      </span>
                    )}

                    <span className="text-[11px] text-praxd-text-muted">
                      commented {formatRelativeTime(comment.createdAt)}
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <CopyIcon
                      value={comment.body}
                      copied={isCopied}
                      size={14}
                      strokeWidth={2}
                      className="p-1 rounded hover:bg-[#282828] text-praxd-text-muted hover:text-praxd-text transition-colors"
                      title={isCopied ? "Copied!" : "Copy comment markdown"}
                      aria-label="Copy comment"
                      onClick={() => handleCopyComment(comment.id, comment.body)}
                    />
                  </div>
                </div>

                {/* Comment Markdown Body */}
                <div className="p-3.5 text-[12.5px] leading-relaxed select-text">
                  <MarkdownContent content={comment.body} />
                </div>
              </div>
            );
          })}

          {/* Leave a Comment Rich Composer Component */}
          <CommentComposer
            prId={pr.id}
            author={{
              login: pr.author.login,
              avatarUrl: pr.author.avatarUrl,
              name: pr.author.name,
            }}
            onCommentAdded={(newComment) => {
              setLocalComments((prev) => [...prev, newComment]);
              onCommentAdded?.(newComment);
            }}
          />
        </div>
      )}
    </div>
  );
}
