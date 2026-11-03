"use client";

import React, { useState, useRef, useEffect } from "react";
import {
  ChevronDown,
  Check,
  PenLine,
  Eye,
  Bold,
  Italic,
  Heading,
  Code,
  List,
  Quote,
  Send,
  Loader2,
} from "lucide-react";
import { PRComment } from "@/types/pr";
import { MarkdownContent } from "../markdown-content";

export interface CommentComposerProps {
  prId: string;
  author: {
    login: string;
    avatarUrl?: string;
    name?: string;
  };
  onCommentAdded?: (comment: PRComment) => void;
}

export function CommentComposer({ prId, author, onCommentAdded }: CommentComposerProps) {
  const [commentText, setCommentText] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
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
            login: author.login,
            avatarUrl: author.avatarUrl || "https://github.com/ghost.png",
            name: author.name || author.login,
          }
        : {
            login: "praxd-app[bot]",
            avatarUrl: "/logo.png",
            name: "praxd-app[bot]",
          };

    try {
      const res = await fetch(`/api/pull-requests/${prId}/comments`, {
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

      onCommentAdded?.(addedComment);
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
      onCommentAdded?.(fallbackComment);
      setCommentText("");
      setActiveTab("write");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="relative flex items-start gap-3 mt-4">
      {/* Connector line coming from previous timeline items down to avatar */}
      <div className="absolute left-[15px] -top-4 h-6 w-[2px] bg-praxd-border-soft" />

      {/* Profile Avatar on Timeline Rail */}
      <div className="relative z-10 w-8 h-8 shrink-0 flex items-center justify-center mt-1">
        <img
          src={
            selectedProfile === "personal"
              ? author.avatarUrl || "https://github.com/ghost.png"
              : "/logo.png"
          }
          alt={selectedProfile === "personal" ? author.login : "praxd-app[bot]"}
          onError={(e) => {
            (e.target as HTMLImageElement).src = "https://github.com/ghost.png";
          }}
          className="w-7 h-7 rounded-full ring-4 ring-[#111111] border border-white/10 object-cover bg-[#1c1c1c] shadow-xs"
        />
      </div>

      {/* Composer Card Form */}
      <form
        onSubmit={handleAddComment}
        className="relative flex-1 min-w-0 rounded-xl bg-[#161616] border border-praxd-border-soft focus-within:border-praxd-border shadow-sm transition-all group/composer"
      >
        {/* Caret pointing left towards avatar */}
        <div className="absolute -left-[5px] top-3.5 w-2.5 h-2.5 rotate-45 bg-[#1c1c1c] border-l border-b border-praxd-border-soft group-focus-within/composer:border-praxd-border transition-colors pointer-events-none" />

        {/* Composer Header Bar */}
        <div className="px-3 py-2 bg-[#1c1c1c] rounded-t-xl border-b border-praxd-border-soft flex items-center justify-between gap-2 text-[12px]">
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
                    ? author.avatarUrl || "https://github.com/ghost.png"
                    : "/logo.png"
                }
                alt={selectedProfile === "personal" ? author.login : "praxd-app[bot]"}
                onError={(e) => {
                  (e.target as HTMLImageElement).src = "https://github.com/ghost.png";
                }}
                className="w-4 h-4 rounded-full bg-[#1b1b1b] shrink-0 object-contain"
              />
              <span className="truncate max-w-[110px]">
                {selectedProfile === "personal" ? author.login : "praxd-app[bot]"}
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
                      src={author.avatarUrl || "https://github.com/ghost.png"}
                      alt={author.login}
                      className="w-5 h-5 rounded-full bg-[#1b1b1b] shrink-0"
                    />
                    <div className="min-w-0">
                      <div className="text-[12px] font-medium text-praxd-text truncate">
                        {author.login}
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
      <div className="px-3 py-2 bg-[#1a1a1a] rounded-b-xl border-t border-praxd-border-soft flex items-center justify-between gap-2 text-[11px] text-praxd-text-muted">
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
  );
}
