"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  ShieldAlert,
  Pencil,
  GitBranch,
  Users,
  MessageSquare,
  CheckCircle2,
  GitPullRequest,
  ChevronDown,
  ChevronRight,
  Check,
  X,
  Loader2,
  FileText,
  ArrowRight,
  Clock,
  AlertCircle,
  XCircle,
  Eye,
  PenLine,
  Bold,
  Italic,
  Heading,
  Code,
  List,
  Quote,
  CheckSquare,
} from "lucide-react";
import { PullRequest, PRComment } from "@/types/pr";
import { CheckRunList } from "./check-run-list";
import { ActivityTimeline } from "./activity-timeline";
import { MarkdownContent } from "../markdown/markdown-content";
import { CheckoutCommandDropdown } from "../diff/checkout-command-dropdown";
import { CopyIcon } from "../ui/copy-icon";
import { SummarySkeleton } from "./summary-skeleton";

interface SummaryViewProps {
  pr: PullRequest;
  onUpdatePr?: (updates: Partial<PullRequest>) => void;
  isLoading?: boolean;
}

export function SummaryView({ pr, onUpdatePr, isLoading = false }: SummaryViewProps) {
  const [isDescriptionExpanded, setIsDescriptionExpanded] = useState(true);

  // In-place title edit state
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [titleInput, setTitleInput] = useState(pr.title);
  const [isSavingTitle, setIsSavingTitle] = useState(false);
  const [titleError, setTitleError] = useState<string | null>(null);

  // In-place body/description edit state
  const [isEditingBody, setIsEditingBody] = useState(false);
  const [bodyInput, setBodyInput] = useState(pr.body || "");
  const [isSavingBody, setIsSavingBody] = useState(false);
  const [bodyError, setBodyError] = useState<string | null>(null);
  const [bodyTab, setBodyTab] = useState<"write" | "preview">("write");

  const prevPrIdRef = useRef(pr.id);
  const bodyTextareaRef = useRef<HTMLTextAreaElement>(null);

  // Copy feedback state
  const [copiedBranch, setCopiedBranch] = useState(false);
  const [copiedDesc, setCopiedDesc] = useState(false);

  // Local comments state synchronized with PR prop and timeline additions
  const [commentsList, setCommentsList] = useState<PRComment[]>(pr.comments || []);

  // Sync inputs when selected PR changes — protects active user edits from background hydration resets
  useEffect(() => {
    // If navigating to a different PR, reset everything cleanly
    if (prevPrIdRef.current !== pr.id) {
      prevPrIdRef.current = pr.id;
      setTitleInput(pr.title);
      setIsEditingTitle(false);
      setTitleError(null);
      setBodyInput(pr.body || "");
      setIsEditingBody(false);
      setBodyError(null);
      setBodyTab("write");
      setCommentsList(pr.comments || []);
      return;
    }

    // On same PR, protect active user drafts from background hydration overwrites
    if (!isEditingTitle) {
      setTitleInput(pr.title);
    }
    if (!isEditingBody) {
      setBodyInput(pr.body || "");
    }
    setCommentsList(pr.comments || []);
  }, [pr.id, pr.title, pr.body, pr.comments, isEditingTitle, isEditingBody]);

  const effectiveCommentCount = Math.max(
    commentsList.length,
    pr.comments?.length || 0,
    pr.commentsCount ?? 0
  );

  const handleCommentsLoaded = useCallback((loaded: PRComment[]) => {
    if (Array.isArray(loaded) && loaded.length > 0) {
      setCommentsList(loaded);
      if (onUpdatePr) {
        onUpdatePr({ comments: loaded, commentsCount: loaded.length });
      }
    }
  }, [onUpdatePr]);

  const handleCommentAdded = useCallback((comment: PRComment) => {
    setCommentsList((prev) => {
      const next = [...prev, comment];
      if (onUpdatePr) {
        onUpdatePr({ comments: next, commentsCount: next.length });
      }
      return next;
    });
  }, [onUpdatePr]);

  const checksList = Array.isArray(pr.checks) ? pr.checks : [];
  const passedChecksCount = checksList.filter((c) => c.conclusion === "success").length;
  const hasFailedChecks =
    pr.checksStatus === "failure" ||
    checksList.some(
      (c) => c.conclusion === "failure" || c.conclusion === "timed_out" || c.conclusion === "cancelled"
    );
  const hasPendingChecks =
    pr.checksStatus === "pending" ||
    checksList.some((c) => c.status === "in_progress" || c.status === "queued");

  const hasShield = pr.title.toLowerCase().includes("sentinel");

  const handleCopyBranch = () => {
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText(pr.headRef);
      setCopiedBranch(true);
      setTimeout(() => setCopiedBranch(false), 1500);
    }
  };

  const handleCopyDesc = () => {
    if (typeof navigator !== "undefined" && navigator.clipboard && pr.body) {
      navigator.clipboard.writeText(pr.body);
      setCopiedDesc(true);
      setTimeout(() => setCopiedDesc(false), 1500);
    }
  };

  // Save Title
  const handleSaveTitle = async () => {
    const trimmed = titleInput.trim();
    if (!trimmed || isSavingTitle) return;

    setIsSavingTitle(true);
    setTitleError(null);
    try {
      const res = await fetch(`/api/pull-requests/${pr.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: trimmed }),
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => null);
        throw new Error(errJson?.error?.message || errJson?.message || "Failed to update title");
      }

      onUpdatePr?.({ title: trimmed });
      setIsEditingTitle(false);
    } catch (err: any) {
      onUpdatePr?.({ title: trimmed });
      if (err?.message && !err.message.includes("fetch")) {
        setTitleError(err.message);
      } else {
        setIsEditingTitle(false);
      }
    } finally {
      setIsSavingTitle(false);
    }
  };

  // Save Description / Body
  const handleSaveBody = async () => {
    if (isSavingBody) return;

    setIsSavingBody(true);
    setBodyError(null);
    try {
      const res = await fetch(`/api/pull-requests/${pr.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: bodyInput }),
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => null);
        throw new Error(errJson?.error?.message || errJson?.message || "Failed to update description");
      }

      onUpdatePr?.({ body: bodyInput });
      setIsEditingBody(false);
      setBodyTab("write");
    } catch (err: any) {
      onUpdatePr?.({ body: bodyInput });
      if (err?.message && !err.message.includes("fetch")) {
        setBodyError(err.message);
      } else {
        setIsEditingBody(false);
      }
    } finally {
      setIsSavingBody(false);
    }
  };

  // Insert markdown formatting into description textarea
  const handleInsertBodyMarkdown = (prefix: string, suffix: string = "") => {
    const textarea = bodyTextareaRef.current;
    if (!textarea) {
      setBodyInput((prev) => prev + prefix + suffix);
      return;
    }
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const currentText = textarea.value;
    const selected = currentText.substring(start, end);
    const placeholder = prefix === "### " ? "Heading" : "text";
    const replacement = `${prefix}${selected || placeholder}${suffix}`;
    const nextVal = currentText.substring(0, start) + replacement + currentText.substring(end);
    setBodyInput(nextVal);
    setTimeout(() => {
      textarea.focus();
      const selStart = start + prefix.length;
      const selEnd = selStart + (selected ? selected.length : placeholder.length);
      textarea.setSelectionRange(selStart, selEnd);
    }, 0);
  };

  if (isLoading) {
    return <SummarySkeleton />;
  }

  return (
    <div className="h-full overflow-y-auto px-4 md:px-8 py-6 select-text">
      <div className="max-w-[780px] mx-auto space-y-6">
        {/* PR Title & Edit Header */}
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-2.5 flex-1 min-w-0">
            {hasShield && (
              <ShieldAlert className="w-6 h-6 text-praxd-blue shrink-0 mt-0.5" />
            )}
            {isEditingTitle ? (
              <div className="w-full space-y-2 rounded-xl bg-[#141414] border border-praxd-border p-3 shadow-md transition-all">
                <div className="flex items-center justify-between text-[11px] text-praxd-text-muted pb-0.5">
                  <span className="font-medium text-praxd-text-secondary uppercase tracking-wider text-[10px]">
                    Edit Title
                  </span>
                  <span>
                    Press{" "}
                    <kbd className="px-1 py-0.5 rounded bg-[#202020] border border-praxd-border-soft text-[10px] font-mono text-praxd-text">
                      Enter
                    </kbd>{" "}
                    to save,{" "}
                    <kbd className="px-1 py-0.5 rounded bg-[#202020] border border-praxd-border-soft text-[10px] font-mono text-praxd-text">
                      Esc
                    </kbd>{" "}
                    to cancel
                  </span>
                </div>

                <input
                  type="text"
                  value={titleInput}
                  onChange={(e) => {
                    setTitleInput(e.target.value);
                    if (titleError) setTitleError(null);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      handleSaveTitle();
                    }
                    if (e.key === "Escape") {
                      e.preventDefault();
                      setTitleInput(pr.title);
                      setIsEditingTitle(false);
                      setTitleError(null);
                    }
                  }}
                  autoFocus
                  disabled={isSavingTitle}
                  className="w-full px-3 py-2 rounded-lg bg-[#181818] border border-praxd-border text-[16px] md:text-[18px] font-semibold text-white placeholder-praxd-text-muted focus:outline-none focus:border-praxd-blue focus:ring-1 focus:ring-praxd-blue transition-all"
                  placeholder="Pull request title"
                />

                {titleError && (
                  <div className="flex items-center gap-2 p-2 rounded-lg bg-red-950/40 border border-red-500/30 text-red-300 text-[11.5px]">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0 text-red-400" />
                    <span className="flex-1">{titleError}</span>
                  </div>
                )}

                <div className="flex items-center justify-end gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      setTitleInput(pr.title);
                      setIsEditingTitle(false);
                      setTitleError(null);
                    }}
                    disabled={isSavingTitle}
                    className="px-3 py-1.5 rounded-lg text-[12px] font-medium bg-[#202020] hover:bg-[#282828] text-praxd-text transition-colors"
                    aria-label="Cancel editing title"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleSaveTitle}
                    disabled={isSavingTitle || !titleInput.trim()}
                    className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-[12px] font-semibold bg-white text-black hover:bg-neutral-200 disabled:opacity-40 disabled:hover:bg-white transition-colors shadow-xs"
                    aria-label="Save title"
                  >
                    {isSavingTitle ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        <span>Saving...</span>
                      </>
                    ) : (
                      <>
                        <Check className="w-3.5 h-3.5" />
                        <span>Save title</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            ) : (
              <h1 className="text-[22px] font-semibold text-praxd-text leading-snug break-words">
                {pr.title}
              </h1>
            )}
          </div>

          {!isEditingTitle && (
            <button
              type="button"
              onClick={() => {
                setIsEditingTitle(true);
                setTitleError(null);
              }}
              className="p-1.5 rounded hover:bg-[#202020] text-praxd-text-muted hover:text-praxd-text transition-colors shrink-0"
              aria-label="Edit title"
              title="Edit title"
            >
              <Pencil className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Author Line */}
        <div className="flex items-center gap-2 text-[12px] text-praxd-text-muted">
          <img
            src={pr.author?.avatarUrl || `https://github.com/${pr.author?.login || "unknown"}.png`}
            alt={pr.author?.login || "author"}
            className="w-4 h-4 rounded-full bg-[#2a2a2a]"
          />
          <span className="font-medium text-praxd-text-secondary">{pr.author?.login || "unknown"}</span>
          <span>·</span>
          <span>{pr.relativeTime}</span>
        </div>

        {/* Metadata Grid (Branch, Reviewers, Comments, Checks, Status) */}
        <div className="space-y-3 py-2 text-[12px]">
          {/* Branch Row */}
          <div className="flex items-center">
            <div className="w-[105px] sm:w-[120px] shrink-0 flex items-center gap-2 text-praxd-text-muted">
              <GitBranch className="w-3.5 h-3.5" />
              <span>Branch</span>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-mono text-praxd-text-secondary text-[11px] bg-[#1a1a1a] px-2 py-0.5 rounded border border-praxd-border-soft flex items-center gap-1.5">
                <span>{pr.headRef}</span>
                <CopyIcon
                  value={pr.headRef}
                  size={13}
                  strokeWidth={2}
                  title={copiedBranch ? "Copied branch!" : "Copy branch name"}
                  aria-label="Copy branch name"
                  className="p-0.5 hover:bg-[#252525] rounded text-praxd-text-muted hover:text-praxd-text transition-colors"
                  onClick={handleCopyBranch}
                />
              </span>
              <span className="text-praxd-text-muted font-mono select-none">→</span>
              <span className="font-mono text-praxd-text-secondary text-[11px] bg-[#1a1a1a] px-2 py-0.5 rounded border border-praxd-border-soft">
                {pr.baseRef}
              </span>
              <div className="flex items-center gap-1 font-mono text-[11px] tabular-nums ml-1">
                <span className="text-praxd-green font-medium">+{pr.additions}</span>
                <span className="text-praxd-red font-medium">-{pr.deletions}</span>
              </div>
              <div className="ml-0 mt-1 sm:ml-2 sm:mt-0">
                <CheckoutCommandDropdown pr={pr} variant="inline" />
              </div>
            </div>
          </div>

          {/* Reviewers Row */}
          <div className="flex items-center">
            <div className="w-[105px] sm:w-[120px] shrink-0 flex items-center gap-2 text-praxd-text-muted">
              <Users className="w-3.5 h-3.5" />
              <span>Reviewers</span>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              {Array.isArray(pr.reviewers) && pr.reviewers.length > 0 ? (
                pr.reviewers.map((rev) => (
                  <div
                    key={rev.login}
                    className="flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-[#181818] border border-praxd-border-soft text-[11.5px]"
                  >
                    {rev.avatarUrl ? (
                      <img
                        src={rev.avatarUrl}
                        alt={rev.login}
                        className="w-3.5 h-3.5 rounded-full object-cover bg-[#252525]"
                      />
                    ) : (
                      <div className="w-3.5 h-3.5 rounded-full bg-[#282828] text-[8px] flex items-center justify-center font-bold text-neutral-300">
                        {rev.login.charAt(0).toUpperCase()}
                      </div>
                    )}
                    <span className="text-praxd-text-secondary">{rev.login}</span>
                    {rev.state === "approved" && (
                      <span title="Approved"><CheckCircle2 className="w-3 h-3 text-praxd-green" /></span>
                    )}
                    {rev.state === "changes_requested" && (
                      <span title="Changes requested"><AlertCircle className="w-3 h-3 text-praxd-amber" /></span>
                    )}
                    {rev.state === "pending" && (
                      <span title="Review pending"><Clock className="w-3 h-3 text-praxd-text-muted" /></span>
                    )}
                  </div>
                ))
              ) : null}
              <button
                type="button"
                className="text-praxd-text-secondary hover:text-praxd-text hover:underline text-[12px] flex items-center gap-1"
              >
                <span>+ Request</span>
              </button>
            </div>
          </div>

          {/* Comments Row */}
          <div className="flex items-center">
            <div className="w-[105px] sm:w-[120px] shrink-0 flex items-center gap-2 text-praxd-text-muted">
              <MessageSquare className="w-3.5 h-3.5" />
              <span>Comments</span>
            </div>
            <span className="text-praxd-text-secondary tabular-nums">
              {effectiveCommentCount} {effectiveCommentCount === 1 ? "comment" : "comments"}
            </span>
          </div>

          {/* Checks Row */}
          <div className="flex items-center">
            <div className="w-[105px] sm:w-[120px] shrink-0 flex items-center gap-2 text-praxd-text-muted">
              {checksList.length === 0 ? (
                <Clock className="w-3.5 h-3.5 text-praxd-text-muted" />
              ) : hasFailedChecks ? (
                <XCircle className="w-3.5 h-3.5 text-praxd-red" />
              ) : hasPendingChecks ? (
                <Clock className="w-3.5 h-3.5 text-praxd-amber" />
              ) : (
                <CheckCircle2 className="w-3.5 h-3.5 text-praxd-green" />
              )}
              <span>Checks</span>
            </div>
            <div className="flex items-center gap-1.5">
              {checksList.length === 0 ? (
                <span className="text-praxd-text-muted font-medium">No checks</span>
              ) : hasFailedChecks ? (
                <span className="text-praxd-red font-medium">Failed</span>
              ) : hasPendingChecks ? (
                <span className="text-praxd-amber font-medium">In progress</span>
              ) : (
                <span className="text-praxd-green font-medium">Passed</span>
              )}
              {checksList.length > 0 && (
                <span className="text-praxd-text-muted text-[11px] tabular-nums font-mono">
                  ({passedChecksCount}/{checksList.length} passed)
                </span>
              )}
            </div>
          </div>

          {/* Status Row */}
          <div className="flex items-center">
            <div className="w-[105px] sm:w-[120px] shrink-0 flex items-center gap-2 text-praxd-text-muted">
              <GitPullRequest className="w-3.5 h-3.5" />
              <span>Status</span>
            </div>
            <div className="flex items-center gap-1 text-praxd-text">
              <span className="capitalize">{pr.state === "open" ? "Ready for review" : pr.state}</span>
            </div>
          </div>
        </div>

        {/* Description Section */}
        <div className="border-t border-praxd-border-soft pt-4 space-y-3">
          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={() => setIsDescriptionExpanded(!isDescriptionExpanded)}
              className="flex items-center gap-1.5 text-[14px] font-medium text-praxd-text hover:text-white transition-colors"
              aria-expanded={isDescriptionExpanded}
            >
              <span>Description</span>
              {isDescriptionExpanded ? (
                <ChevronDown className="w-4 h-4 text-praxd-text-muted" />
              ) : (
                <ChevronRight className="w-4 h-4 text-praxd-text-muted" />
              )}
            </button>
            <div className="flex items-center gap-1.5">
              {pr.body && !isEditingBody && (
                <CopyIcon
                  value={pr.body}
                  size={15}
                  strokeWidth={2}
                  aria-label="Copy description"
                  title={copiedDesc ? "Copied description!" : "Copy description markdown"}
                  className="p-1 rounded hover:bg-[#202020] text-praxd-text-muted hover:text-praxd-text transition-colors"
                  onClick={handleCopyDesc}
                />
              )}
              {!isEditingBody && (
                <button
                  type="button"
                  onClick={() => {
                    setIsEditingBody(true);
                    setIsDescriptionExpanded(true);
                    setBodyError(null);
                  }}
                  className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-[#1c1c1c] hover:bg-[#252525] border border-praxd-border-soft text-praxd-text-muted hover:text-praxd-text text-[11.5px] transition-colors"
                  aria-label="Edit description"
                  title="Edit description"
                >
                  <Pencil className="w-3 h-3" />
                  <span>Edit</span>
                </button>
              )}
            </div>
          </div>

          {isDescriptionExpanded && (
            <div>
              {isEditingBody ? (
                <div className="rounded-xl bg-[#141414] border border-praxd-border-soft focus-within:border-praxd-border shadow-md transition-all overflow-hidden">
                  {/* Toolbar & Tab Header */}
                  <div className="px-3 py-2 bg-[#191919] border-b border-praxd-border-soft flex items-center justify-between gap-2 text-[12px]">
                    {/* Write / Preview Tab Switcher */}
                    <div className="flex items-center gap-1 bg-[#121212] p-0.5 rounded-lg border border-praxd-border-soft">
                      <button
                        type="button"
                        onClick={() => setBodyTab("write")}
                        className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11.5px] font-medium transition-colors ${
                          bodyTab === "write"
                            ? "bg-[#252525] text-white shadow-xs"
                            : "text-praxd-text-muted hover:text-praxd-text"
                        }`}
                        aria-label="Write tab"
                      >
                        <PenLine className="w-3 h-3" />
                        <span>Write</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setBodyTab("preview")}
                        className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11.5px] font-medium transition-colors ${
                          bodyTab === "preview"
                            ? "bg-[#252525] text-white shadow-xs"
                            : "text-praxd-text-muted hover:text-praxd-text"
                        }`}
                        aria-label="Preview tab"
                      >
                        <Eye className="w-3 h-3" />
                        <span>Preview</span>
                      </button>
                    </div>

                    {/* Markdown Quick Formatting Toolbar (only on Write tab) */}
                    {bodyTab === "write" && (
                      <div className="hidden sm:flex items-center gap-0.5 text-praxd-text-muted">
                        <button
                          type="button"
                          onClick={() => handleInsertBodyMarkdown("**", "**")}
                          className="p-1.5 rounded hover:bg-[#252525] hover:text-praxd-text transition-colors"
                          title="Bold (**text**)"
                          aria-label="Bold formatting"
                        >
                          <Bold className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleInsertBodyMarkdown("*", "*")}
                          className="p-1.5 rounded hover:bg-[#252525] hover:text-praxd-text transition-colors"
                          title="Italic (*text*)"
                          aria-label="Italic formatting"
                        >
                          <Italic className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleInsertBodyMarkdown("### ")}
                          className="p-1.5 rounded hover:bg-[#252525] hover:text-praxd-text transition-colors"
                          title="Heading (### title)"
                          aria-label="Heading formatting"
                        >
                          <Heading className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleInsertBodyMarkdown("`", "`")}
                          className="p-1.5 rounded hover:bg-[#252525] hover:text-praxd-text transition-colors"
                          title="Code (`code`)"
                          aria-label="Code formatting"
                        >
                          <Code className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleInsertBodyMarkdown("- ")}
                          className="p-1.5 rounded hover:bg-[#252525] hover:text-praxd-text transition-colors"
                          title="Bullet list (- item)"
                          aria-label="Bullet list formatting"
                        >
                          <List className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleInsertBodyMarkdown("- [ ] ")}
                          className="p-1.5 rounded hover:bg-[#252525] hover:text-praxd-text transition-colors"
                          title="Task list (- [ ] task)"
                          aria-label="Task list formatting"
                        >
                          <CheckSquare className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleInsertBodyMarkdown("> ")}
                          className="p-1.5 rounded hover:bg-[#252525] hover:text-praxd-text transition-colors"
                          title="Quote (> blockquote)"
                          aria-label="Quote formatting"
                        >
                          <Quote className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Editor / Preview Content */}
                  {bodyTab === "write" ? (
                    <textarea
                      ref={bodyTextareaRef}
                      rows={8}
                      value={bodyInput}
                      onChange={(e) => {
                        setBodyInput(e.target.value);
                        if (bodyError) setBodyError(null);
                      }}
                      onKeyDown={(e) => {
                        if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
                          e.preventDefault();
                          handleSaveBody();
                        }
                        if (e.key === "Escape") {
                          e.preventDefault();
                          setBodyInput(pr.body || "");
                          setIsEditingBody(false);
                          setBodyError(null);
                          setBodyTab("write");
                        }
                      }}
                      disabled={isSavingBody}
                      placeholder="Add a detailed description for this pull request... (Markdown supported)"
                      className="w-full p-4 bg-[#141414] text-[13px] text-praxd-text placeholder-praxd-text-muted focus:outline-none resize-y min-h-[160px] font-sans leading-relaxed border-0"
                    />
                  ) : (
                    <div className="p-4 bg-[#141414] min-h-[160px] max-h-[480px] overflow-y-auto text-[13px] text-praxd-text-secondary select-text">
                      {bodyInput.trim() ? (
                        <MarkdownContent content={bodyInput} />
                      ) : (
                        <div className="py-8 text-center text-praxd-text-muted text-[12px] italic">
                          Nothing to preview yet. Switch back to Write tab to add your description.
                        </div>
                      )}
                    </div>
                  )}

                  {/* Error banner if save fails */}
                  {bodyError && (
                    <div className="mx-3 my-2 flex items-center gap-2 p-2.5 rounded-lg bg-red-950/40 border border-red-500/30 text-red-300 text-[11.5px]">
                      <AlertCircle className="w-3.5 h-3.5 shrink-0 text-red-400" />
                      <span className="flex-1">{bodyError}</span>
                    </div>
                  )}

                  {/* Footer Action Bar */}
                  <div className="px-3 py-2 bg-[#181818] border-t border-praxd-border-soft flex items-center justify-between gap-2 text-[11px] text-praxd-text-muted">
                    <div className="flex items-center gap-1.5">
                      <span>Markdown supported</span>
                      <span>·</span>
                      <span className="hidden sm:inline">
                        Press{" "}
                        <kbd className="px-1 py-0.5 rounded bg-[#242424] border border-praxd-border-soft text-[10px] font-mono text-praxd-text">
                          Ctrl+Enter
                        </kbd>{" "}
                        to save,{" "}
                        <kbd className="px-1 py-0.5 rounded bg-[#242424] border border-praxd-border-soft text-[10px] font-mono text-praxd-text">
                          Esc
                        </kbd>{" "}
                        to cancel
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setBodyInput(pr.body || "");
                          setIsEditingBody(false);
                          setBodyError(null);
                          setBodyTab("write");
                        }}
                        disabled={isSavingBody}
                        className="px-3 py-1.5 rounded-lg text-[12px] font-medium bg-[#222222] hover:bg-[#2a2a2a] text-praxd-text transition-colors"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={handleSaveBody}
                        disabled={isSavingBody}
                        className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-[12px] font-semibold bg-white text-black hover:bg-neutral-200 disabled:opacity-40 disabled:hover:bg-white transition-colors shadow-xs"
                        aria-label="Save Description"
                      >
                        {isSavingBody ? (
                          <>
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            <span>Saving...</span>
                          </>
                        ) : (
                          <>
                            <Check className="w-3.5 h-3.5" />
                            <span>Save Description</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              ) : pr.body && pr.body.trim().length > 0 ? (
                <div className="rounded-xl bg-[#161616] border border-praxd-border-soft p-4 text-[13px] leading-relaxed text-praxd-text-secondary select-text">
                  <MarkdownContent content={pr.body} />
                </div>
              ) : (
                <div className="rounded-xl bg-[#161616] border border-praxd-border-soft py-6 text-center text-praxd-text-muted space-y-2">
                  <FileText className="w-5 h-5 mx-auto opacity-40" />
                  <p className="text-[12px]">No description provided for this pull request.</p>
                  <button
                    type="button"
                    onClick={() => {
                      setIsEditingBody(true);
                      setBodyError(null);
                    }}
                    className="inline-flex items-center gap-1 text-[12px] text-praxd-blue hover:text-white transition-colors hover:underline font-medium"
                  >
                    + Add a description
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Checks Section */}
        <CheckRunList checks={pr.checks || []} />

        {/* Activity Timeline & Conversation Comment Section */}
        <ActivityTimeline
          pr={pr}
          onCommentsLoaded={handleCommentsLoaded}
          onCommentAdded={handleCommentAdded}
        />
      </div>
    </div>
  );
}
