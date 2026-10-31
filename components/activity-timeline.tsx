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
} from "lucide-react";
import { PullRequest, PRComment } from "@/types/pr";

interface ActivityTimelineProps {
  pr: PullRequest;
  onCommentAdded?: (comment: PRComment) => void;
}

export function ActivityTimeline({ pr, onCommentAdded }: ActivityTimelineProps) {
  const [isExpanded, setIsExpanded] = useState(true);
  const [commentText, setCommentText] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [localComments, setLocalComments] = useState<PRComment[]>(() =>
    pr.comments.filter((c) => c.commentType === "issue")
  );

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
        <div className="space-y-2 pt-1">
          {/* Commits */}
          {pr.commits.map((commit) => (
            <div
              key={commit.sha}
              className="flex items-center justify-between p-2.5 rounded-lg bg-[#181818] border border-praxd-border-soft text-[12px]"
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <GitCommit className="w-4 h-4 text-praxd-text-muted shrink-0" />
                <ShieldAlert className="w-3.5 h-3.5 text-praxd-blue shrink-0" />
                <span className="font-medium text-praxd-text truncate max-w-[420px]">{commit.message}</span>
              </div>
              <div className="flex items-center gap-2.5 shrink-0 text-praxd-text-muted text-[11px]">
                <code className="font-mono text-praxd-text-secondary">{commit.shortSha}</code>
                <img
                  src={commit.author.avatarUrl}
                  alt={commit.author.login}
                  className="w-4 h-4 rounded-full"
                />
                <span>1h</span>
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

          {/* Comments */}
          {localComments.map((comment) => (
            <div
              key={comment.id}
              className="p-3 rounded-lg bg-[#181818] border border-praxd-border-soft text-[12px] space-y-2"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <img
                    src={comment.author.avatarUrl}
                    alt={comment.author.login}
                    className="w-5 h-5 rounded-full bg-[#2a2a2a]"
                  />
                  <span className="font-medium text-praxd-text">{comment.author.login}</span>
                </div>
                <div className="flex items-center gap-2 text-praxd-text-muted text-[11px]">
                  <span>1h</span>
                  <button
                    type="button"
                    className="p-0.5 hover:text-praxd-text transition-colors"
                    aria-label="Comment actions"
                  >
                    <MoreHorizontal className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
              <div className="text-praxd-text-secondary leading-relaxed pl-7 text-[12.5px] whitespace-pre-wrap">
                {comment.body}
              </div>
            </div>
          ))}

          {/* Leave a Comment Composer */}
          <form
            onSubmit={handleAddComment}
            className="mt-3 flex items-center gap-2.5 p-2 rounded-xl bg-[#1c1c1c] border border-praxd-border-soft focus-within:border-praxd-border transition-colors"
          >
            <img
              src={pr.author.avatarUrl}
              alt={pr.author.login}
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
