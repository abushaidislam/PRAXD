"use client";

import React, { useState, useEffect, useRef } from "react";
import {
  ChevronDown,
  ChevronRight,
  GitCommit,
  GitPullRequest,
  MoreHorizontal,
  ShieldAlert,
  Loader2,
  Copy,
  Check,
  Send,
  Eye,
  PenLine,
  Bold,
  Italic,
  Code,
  List,
  Heading,
  Quote,
} from "lucide-react";
import { PullRequest, PRComment } from "@/types/pr";
import { MarkdownContent } from "./markdown-content";

interface ActivityTimelineProps {
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
  const [commentText, setCommentText] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [copiedCommentId, setCopiedCommentId] = useState<string | null>(null);
  const [copiedSha, setCopiedSha] = useState<string | null>(null);
  const [localComments, setLocalComments] = useState<PRComment[]>(() =>
    pr.comments.filter((c) => c.commentType === "issue")
  );

  // Rich Composer State: Write/Preview tab, Profile Selector
  const [activeTab, setActiveTab] = useState<"write" | "preview">("write");
  const [selectedProfile, setSelectedProfile] = useState<"personal" | "bot">("personal");
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);

  const profileMenuRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Close profile dropdown on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (profileMenuRef.current && !profileMenuRef.current.contains(e.target as Node)) {
        setIsProfileMenuOpen(false);
      }
    }
    if (isProfileMenuOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [isProfileMenuOpen]);

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

  // Insert markdown formatting into textarea
  const handleInsertMarkdown = (prefix: string, suffix: string = "") => {
    const textarea = textareaRef.current;
    if (!textarea) {
      setCommentText((prev) => prev + prefix + suffix);
      return;
    }
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const currentText = textarea.value;
    const selected = currentText.substring(start, end);
    const placeholder = prefix === "### " ? "Heading" : "text";
    const replacement = `${prefix}${selected || placeholder}${suffix}`;
    const nextVal = currentText.substring(0, start) + replacement + currentText.substring(end);
    setCommentText(nextVal);
    setTimeout(() => {
      textarea.focus();
      const selStart = start + prefix.length;
      const selEnd = selStart + (selected ? selected.length : placeholder.length);
      textarea.setSelectionRange(selStart, selEnd);
    }, 0);
  };

  const handleAddComment = async (e: React.FormEvent) => {
    e.preventDefault();
    const text = commentText.trim();
    if (!text || isSubmitting) return;

    setIsSubmitting(true);
    const authorPayload =
      selectedProfile === "personal"
        ? {
            login: pr.author.login,
            avatarUrl: pr.author.avatarUrl,
            name: pr.author.name || pr.author.login,
          }
        : {
            login: "praxd-app[bot]",
            avatarUrl: "/logo.png",
            name: "praxd-app[bot]",
          };

    try {
      const res = await fetch(`/api/pull-requests/${pr.id}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          body: text,
          profileType: selectedProfile,
          author: authorPayload,
        }),
      });

      let addedComment: PRComment;
      if (res.ok) {
        const json = await res.json();
        addedComment = json.comment || json.data?.comment || {
          id: `c-local-${Date.now()}`,
          author: authorPayload,
          body: text,
          createdAt: new Date().toISOString(),
          commentType: "issue",
        };
      } else {
        addedComment = {
          id: `c-local-${Date.now()}`,
          author: authorPayload,
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
      setActiveTab("write");
    } catch {
      // Local fallback on network error
      const fallbackComment: PRComment = {
        id: `c-local-${Date.now()}`,
        author: authorPayload,
        body: text,
        createdAt: new Date().toISOString(),
        commentType: "issue",
      };
      setLocalComments((prev) => [...prev, fallbackComment]);
      if (onCommentAdded) {
        onCommentAdded(fallbackComment);
      }
      setCommentText("");
      setActiveTab("write");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-3 border-t border-praxd-border-soft pt-4 select-text">
      {/* Activity Timeline Section Header */}
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => setIsExpanded(!isExpanded)}
          className="flex items-center gap-1.5 text-[14px] font-medium text-praxd-text hover:text-white transition-colors"
          aria-expanded={isExpanded}
        >
          <span>Activity Timeline</span>
          <span className="text-[11.5px] font-normal text-praxd-text-muted">
            ({totalEvents} {totalEvents === 1 ? "event" : "events"})
          </span>
          {isExpanded ? (
            <ChevronDown className="w-4 h-4 text-praxd-text-muted" />
          ) : (
            <ChevronRight className="w-4 h-4 text-praxd-text-muted" />
          )}
        </button>

        <span className="text-[11px] text-praxd-text-muted">
          Commits, reviews & discussion
        </span>
      </div>

      {isExpanded && (
        <div className="space-y-3 pt-1">
          {/* Commits List in Timeline */}
          {pr.commits.map((commit) => (
            <div
              key={commit.sha}
              className="flex items-center justify-between p-2.5 rounded-lg bg-[#181818] border border-praxd-border-soft text-[12px] hover:bg-[#1f1f1f] transition-colors"
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
                      className="w-5 h-5 rounded-full bg-[#2a2a2a] shrink-0 border border-praxd-border-soft object-contain"
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

          {/* Leave a Comment Rich Composer with Profile Selector & Markdown Tabs */}
          <form
            onSubmit={handleAddComment}
            className="mt-4 rounded-xl bg-[#161616] border border-praxd-border-soft focus-within:border-praxd-border overflow-hidden shadow-sm transition-all"
          >
            {/* Composer Header Bar */}
            <div className="px-3 py-2 bg-[#1c1c1c] border-b border-praxd-border-soft flex items-center justify-between gap-2 text-[12px]">
              {/* Left: Mini Profile Selector & Write/Preview Tabs */}
              <div className="flex items-center gap-2 min-w-0">
                {/* Profile Selector Dropdown */}
                <div className="relative" ref={profileMenuRef}>
                  <button
                    type="button"
                    onClick={() => setIsProfileMenuOpen(!isProfileMenuOpen)}
                    className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-[#252525] hover:bg-[#2e2e2e] text-praxd-text border border-praxd-border-soft transition-colors text-[11.5px] font-medium"
                    title="Select author profile for this comment"
                    aria-label="Select comment profile"
                    aria-haspopup="true"
                    aria-expanded={isProfileMenuOpen}
                  >
                    <img
                      src={
                        selectedProfile === "personal"
                          ? pr.author.avatarUrl || "https://github.com/ghost.png"
                          : "/logo.png"
                      }
                      alt={selectedProfile === "personal" ? pr.author.login : "praxd-app[bot]"}
                      onError={(e) => {
                        (e.target as HTMLImageElement).src = "https://github.com/ghost.png";
                      }}
                      className="w-4 h-4 rounded-full bg-[#1b1b1b] shrink-0 object-contain"
                    />
                    <span className="truncate max-w-[110px]">
                      {selectedProfile === "personal" ? pr.author.login : "praxd-app[bot]"}
                    </span>
                    {selectedProfile === "bot" && (
                      <span className="text-[9px] uppercase font-bold px-1 py-0.2 rounded bg-praxd-blue/20 text-praxd-blue border border-praxd-blue/30 leading-none">
                        bot
                      </span>
                    )}
                    <ChevronDown className="w-3 h-3 text-praxd-text-muted shrink-0 ml-0.5" />
                  </button>

                  {/* Profile Selector Popover Dropdown */}
                  {isProfileMenuOpen && (
                    <div className="absolute top-full mt-1.5 left-0 z-40 w-[240px] rounded-xl bg-[#202020] border border-praxd-border shadow-xl p-1.5 space-y-1">
                      <div className="px-2 py-1 text-[10px] font-semibold text-praxd-text-muted uppercase tracking-wider">
                        Comment as
                      </div>

                      {/* Option 1: Personal Profile */}
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedProfile("personal");
                          setIsProfileMenuOpen(false);
                        }}
                        className={`w-full flex items-center justify-between p-2 rounded-lg text-left transition-colors ${
                          selectedProfile === "personal"
                            ? "bg-[#2b2b2b] text-white"
                            : "hover:bg-[#262626] text-praxd-text-secondary"
                        }`}
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <img
                            src={pr.author.avatarUrl || "https://github.com/ghost.png"}
                            alt={pr.author.login}
                            className="w-5 h-5 rounded-full bg-[#1b1b1b] shrink-0"
                          />
                          <div className="min-w-0">
                            <div className="text-[12px] font-medium text-praxd-text truncate">
                              {pr.author.login}
                            </div>
                            <div className="text-[10px] text-praxd-text-muted truncate">
                              Personal profile (You)
                            </div>
                          </div>
                        </div>
                        {selectedProfile === "personal" && (
                          <Check className="w-3.5 h-3.5 text-praxd-blue shrink-0 ml-1" />
                        )}
                      </button>

                      {/* Option 2: PRAXD Bot Profile */}
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedProfile("bot");
                          setIsProfileMenuOpen(false);
                        }}
                        className={`w-full flex items-center justify-between p-2 rounded-lg text-left transition-colors ${
                          selectedProfile === "bot"
                            ? "bg-[#2b2b2b] text-white"
                            : "hover:bg-[#262626] text-praxd-text-secondary"
                        }`}
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <img
                            src="/logo.png"
                            alt="praxd-app[bot]"
                            className="w-5 h-5 rounded-md bg-[#111] shrink-0 object-contain p-0.5 border border-praxd-border-soft"
                          />
                          <div className="min-w-0">
                            <div className="text-[12px] font-medium text-praxd-text flex items-center gap-1.5 truncate">
                              <span>praxd-app[bot]</span>
                              <span className="text-[9px] uppercase font-bold px-1 py-0.2 rounded bg-praxd-blue/20 text-praxd-blue border border-praxd-blue/30 leading-none">
                                bot
                              </span>
                            </div>
                            <div className="text-[10px] text-praxd-text-muted truncate">
                              PRAXD GitHub App bot
                            </div>
                          </div>
                        </div>
                        {selectedProfile === "bot" && (
                          <Check className="w-3.5 h-3.5 text-praxd-blue shrink-0 ml-1" />
                        )}
                      </button>
                    </div>
                  )}
                </div>

                {/* Vertical separator */}
                <div className="h-4 w-[1px] bg-praxd-border-soft mx-0.5" />

                {/* Segmented Write / Preview Tabs */}
                <div className="flex items-center rounded-lg bg-[#141414] p-0.5 border border-praxd-border-soft">
                  <button
                    type="button"
                    onClick={() => setActiveTab("write")}
                    className={`flex items-center gap-1.5 px-2.5 py-0.5 rounded-md text-[11.5px] font-medium transition-colors ${
                      activeTab === "write"
                        ? "bg-[#282828] text-white shadow-xs"
                        : "text-praxd-text-muted hover:text-praxd-text"
                    }`}
                  >
                    <PenLine className="w-3 h-3" />
                    <span>Write</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveTab("preview")}
                    className={`flex items-center gap-1.5 px-2.5 py-0.5 rounded-md text-[11.5px] font-medium transition-colors ${
                      activeTab === "preview"
                        ? "bg-[#282828] text-white shadow-xs"
                        : "text-praxd-text-muted hover:text-praxd-text"
                    }`}
                  >
                    <Eye className="w-3 h-3" />
                    <span>Preview</span>
                  </button>
                </div>
              </div>

              {/* Right: Quick Markdown Formatting Toolbar (Only visible in Write mode) */}
              {activeTab === "write" && (
                <div className="hidden sm:flex items-center gap-0.5 text-praxd-text-muted">
                  <button
                    type="button"
                    onClick={() => handleInsertMarkdown("**", "**")}
                    className="p-1 rounded hover:bg-[#252525] hover:text-white transition-colors"
                    title="Bold (**text**)"
                    aria-label="Insert Bold"
                  >
                    <Bold className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleInsertMarkdown("*", "*")}
                    className="p-1 rounded hover:bg-[#252525] hover:text-white transition-colors"
                    title="Italic (*text*)"
                    aria-label="Insert Italic"
                  >
                    <Italic className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleInsertMarkdown("### ")}
                    className="p-1 rounded hover:bg-[#252525] hover:text-white transition-colors"
                    title="Heading (### Heading)"
                    aria-label="Insert Heading"
                  >
                    <Heading className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleInsertMarkdown("`", "`")}
                    className="p-1 rounded hover:bg-[#252525] hover:text-white transition-colors"
                    title="Inline Code (`code`)"
                    aria-label="Insert Code"
                  >
                    <Code className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleInsertMarkdown("- ")}
                    className="p-1 rounded hover:bg-[#252525] hover:text-white transition-colors"
                    title="Bullet List (- item)"
                    aria-label="Insert Bullet List"
                  >
                    <List className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleInsertMarkdown("> ")}
                    className="p-1 rounded hover:bg-[#252525] hover:text-white transition-colors"
                    title="Quote (> quote)"
                    aria-label="Insert Quote"
                  >
                    <Quote className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
            </div>

            {/* Composer Body: Write Textarea or Live Markdown Preview */}
            {activeTab === "write" ? (
              <textarea
                ref={textareaRef}
                rows={4}
                value={commentText}
                onChange={(e) => setCommentText(e.target.value)}
                onKeyDown={(e) => {
                  if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
                    handleAddComment(e);
                  }
                }}
                placeholder="Leave a comment on this pull request (Markdown supported — Shift+Enter for new line, Ctrl+Enter to send)..."
                disabled={isSubmitting}
                className="w-full p-3.5 bg-[#141414] text-[12.5px] text-praxd-text placeholder-praxd-text-muted focus:outline-none resize-y min-h-[96px] font-sans leading-relaxed border-0"
              />
            ) : (
              <div className="p-3.5 bg-[#141414] min-h-[96px] max-h-[320px] overflow-y-auto text-[12.5px] text-praxd-text-secondary select-text">
                {commentText.trim() ? (
                  <MarkdownContent content={commentText} />
                ) : (
                  <div className="py-6 text-center text-praxd-text-muted text-[12px] italic">
                    Nothing to preview yet. Switch to Write tab to compose your markdown.
                  </div>
                )}
              </div>
            )}

            {/* Composer Footer Bar */}
            <div className="px-3 py-2 bg-[#1a1a1a] border-t border-praxd-border-soft flex items-center justify-between gap-2 text-[11px] text-praxd-text-muted">
              <div className="flex items-center gap-1.5">
                <span>Markdown supported</span>
                <span>·</span>
                <span className="hidden sm:inline">
                  Press{" "}
                  <kbd className="px-1 py-0.5 rounded bg-[#242424] border border-praxd-border-soft text-[10px] font-mono text-praxd-text">
                    Ctrl+Enter
                  </kbd>{" "}
                  to send
                </span>
              </div>

              <div className="flex items-center gap-2">
                {commentText.trim() && (
                  <button
                    type="button"
                    onClick={() => setCommentText("")}
                    className="px-2 py-1 rounded text-praxd-text-muted hover:text-white transition-colors"
                  >
                    Clear
                  </button>
                )}

                <button
                  type="submit"
                  disabled={!commentText.trim() || isSubmitting}
                  className="px-3 py-1.5 rounded-lg bg-white text-black hover:bg-neutral-200 disabled:opacity-40 disabled:hover:bg-white font-semibold text-[12px] flex items-center gap-1.5 transition-colors shadow-xs"
                  aria-label="Send comment"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Posting...</span>
                    </>
                  ) : (
                    <>
                      <Send className="w-3.5 h-3.5" />
                      <span>Comment</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
