"use client";

import React, { useState, useEffect } from "react";
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
  Copy,
  ArrowRight,
  Clock,
  AlertCircle,
} from "lucide-react";
import { PullRequest } from "@/types/pr";
import { CheckRunList } from "./check-run-list";
import { ActivityTimeline } from "./activity-timeline";
import { MarkdownContent } from "./markdown-content";
import { CheckoutCommandDropdown } from "./checkout-command-dropdown";

interface SummaryViewProps {
  pr: PullRequest;
  onUpdatePr?: (updates: Partial<PullRequest>) => void;
}

export function SummaryView({ pr, onUpdatePr }: SummaryViewProps) {
  const [isDescriptionExpanded, setIsDescriptionExpanded] = useState(true);

  // In-place title edit state
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [titleInput, setTitleInput] = useState(pr.title);
  const [isSavingTitle, setIsSavingTitle] = useState(false);

  // In-place body/description edit state
  const [isEditingBody, setIsEditingBody] = useState(false);
  const [bodyInput, setBodyInput] = useState(pr.body || "");
  const [isSavingBody, setIsSavingBody] = useState(false);

  // Copy feedback state
  const [copiedBranch, setCopiedBranch] = useState(false);
  const [copiedDesc, setCopiedDesc] = useState(false);

  // Sync inputs when selected PR changes
  useEffect(() => {
    setTitleInput(pr.title);
    setIsEditingTitle(false);
    setBodyInput(pr.body || "");
    setIsEditingBody(false);
  }, [pr.id, pr.title, pr.body]);

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
    try {
      const res = await fetch(`/api/pull-requests/${pr.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: trimmed }),
      });

      if (res.ok) {
        if (onUpdatePr) onUpdatePr({ title: trimmed });
      } else {
        if (onUpdatePr) onUpdatePr({ title: trimmed });
      }
      setIsEditingTitle(false);
    } catch {
      if (onUpdatePr) onUpdatePr({ title: trimmed });
      setIsEditingTitle(false);
    } finally {
      setIsSavingTitle(false);
    }
  };

  // Save Description / Body
  const handleSaveBody = async () => {
    if (isSavingBody) return;

    setIsSavingBody(true);
    try {
      const res = await fetch(`/api/pull-requests/${pr.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: bodyInput }),
      });

      if (res.ok) {
        if (onUpdatePr) onUpdatePr({ body: bodyInput });
      } else {
        if (onUpdatePr) onUpdatePr({ body: bodyInput });
      }
      setIsEditingBody(false);
    } catch {
      if (onUpdatePr) onUpdatePr({ body: bodyInput });
      setIsEditingBody(false);
    } finally {
      setIsSavingBody(false);
    }
  };

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
              <div className="flex items-center gap-2 flex-1">
                <input
                  type="text"
                  value={titleInput}
                  onChange={(e) => setTitleInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleSaveTitle();
                    if (e.key === "Escape") {
                      setTitleInput(pr.title);
                      setIsEditingTitle(false);
                    }
                  }}
                  autoFocus
                  disabled={isSavingTitle}
                  className="flex-1 px-3 py-1.5 rounded-lg bg-[#161616] border border-praxd-border text-[18px] font-semibold text-white focus:outline-none focus:ring-1 focus:ring-praxd-blue"
                  placeholder="Pull request title"
                />
                <button
                  type="button"
                  onClick={handleSaveTitle}
                  disabled={isSavingTitle || !titleInput.trim()}
                  className="p-1.5 rounded-lg bg-praxd-green text-black hover:bg-emerald-600 transition-colors disabled:opacity-50"
                  aria-label="Save title"
                >
                  {isSavingTitle ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Check className="w-4 h-4" />
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setTitleInput(pr.title);
                    setIsEditingTitle(false);
                  }}
                  disabled={isSavingTitle}
                  className="p-1.5 rounded-lg hover:bg-[#202020] text-praxd-text-muted hover:text-praxd-text transition-colors"
                  aria-label="Cancel editing title"
                >
                  <X className="w-4 h-4" />
                </button>
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
              onClick={() => setIsEditingTitle(true)}
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
            src={pr.author.avatarUrl}
            alt={pr.author.login}
            className="w-4 h-4 rounded-full bg-[#2a2a2a]"
          />
          <span className="font-medium text-praxd-text-secondary">{pr.author.login}</span>
          <span>·</span>
          <span>{pr.relativeTime}</span>
        </div>

        {/* Metadata Grid (Branch, Reviewers, Comments, Checks, Status) */}
        <div className="space-y-3 py-2 text-[12px]">
          {/* Branch Row */}
          <div className="flex items-center">
            <div className="w-[120px] flex items-center gap-2 text-praxd-text-muted">
              <GitBranch className="w-3.5 h-3.5" />
              <span>Branch</span>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-mono text-praxd-text-secondary text-[11px] bg-[#1a1a1a] px-2 py-0.5 rounded border border-praxd-border-soft flex items-center gap-1.5 max-w-full">
                <span className="truncate max-w-[200px] sm:max-w-[280px]" title={pr.headRef}>
                  {pr.headRef}
                </span>
                <button
                  type="button"
                  onClick={handleCopyBranch}
                  className="p-1 hover:bg-[#252525] rounded text-praxd-text-muted hover:text-praxd-text transition-colors shrink-0"
                  title={copiedBranch ? "Copied branch!" : "Copy branch name"}
                  aria-label="Copy branch name"
                >
                  {copiedBranch ? (
                    <Check className="w-3 h-3 text-praxd-green" />
                  ) : (
                    <Copy className="w-3 h-3" />
                  )}
                </button>
              </span>
              <span className="text-praxd-text-muted font-mono select-none">→</span>
              <span className="font-mono text-praxd-text-secondary text-[11px] bg-[#1a1a1a] px-2 py-0.5 rounded border border-praxd-border-soft">
                {pr.baseRef}
              </span>
              <div className="flex items-center gap-1 font-mono text-[11px] tabular-nums ml-1">
                <span className="text-praxd-green font-medium">+{pr.additions}</span>
                <span className="text-praxd-red font-medium">-{pr.deletions}</span>
              </div>
              <div className="ml-2">
                <CheckoutCommandDropdown pr={pr} variant="inline" />
              </div>
            </div>
          </div>

          {/* Reviewers Row */}
          <div className="flex items-center">
            <div className="w-[120px] flex items-center gap-2 text-praxd-text-muted">
              <Users className="w-3.5 h-3.5" />
              <span>Reviewers</span>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              {pr.reviewers && pr.reviewers.length > 0 ? (
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
            <div className="w-[120px] flex items-center gap-2 text-praxd-text-muted">
              <MessageSquare className="w-3.5 h-3.5" />
              <span>Comments</span>
            </div>
            <span className="text-praxd-text-secondary tabular-nums">
              {pr.comments.length} comments
            </span>
          </div>

          {/* Checks Row */}
          <div className="flex items-center">
            <div className="w-[120px] flex items-center gap-2 text-praxd-text-muted">
              <CheckCircle2 className="w-3.5 h-3.5 text-praxd-green" />
              <span>Checks</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-praxd-green font-medium">Successful</span>
              {pr.checks && pr.checks.length > 0 && (
                <span className="text-praxd-text-muted text-[11px] tabular-nums font-mono">
                  ({pr.checks.filter((c) => c.conclusion === "success").length}/{pr.checks.length} passed)
                </span>
              )}
            </div>
          </div>

          {/* Status Row */}
          <div className="flex items-center">
            <div className="w-[120px] flex items-center gap-2 text-praxd-text-muted">
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
                <button
                  type="button"
                  onClick={handleCopyDesc}
                  className="p-1 rounded hover:bg-[#202020] text-praxd-text-muted hover:text-praxd-text transition-colors"
                  aria-label="Copy description"
                  title={copiedDesc ? "Copied description!" : "Copy description markdown"}
                >
                  {copiedDesc ? (
                    <Check className="w-3.5 h-3.5 text-praxd-green" />
                  ) : (
                    <Copy className="w-3.5 h-3.5" />
                  )}
                </button>
              )}
              {!isEditingBody && (
                <button
                  type="button"
                  onClick={() => {
                    setIsEditingBody(true);
                    setIsDescriptionExpanded(true);
                  }}
                  className="p-1 rounded hover:bg-[#202020] text-praxd-text-muted hover:text-praxd-text transition-colors"
                  aria-label="Edit description"
                  title="Edit description"
                >
                  <Pencil className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          {isDescriptionExpanded && (
            <div className="rounded-lg bg-[#161616] border border-praxd-border-soft p-4 text-[13px] leading-relaxed text-praxd-text-secondary">
              {isEditingBody ? (
                <div className="space-y-3">
                  <textarea
                    rows={6}
                    value={bodyInput}
                    onChange={(e) => setBodyInput(e.target.value)}
                    disabled={isSavingBody}
                    placeholder="Add a detailed description for this pull request..."
                    className="w-full p-3 rounded-lg bg-[#121212] border border-praxd-border text-[12.5px] text-white focus:outline-none focus:ring-1 focus:ring-praxd-blue resize-y font-sans leading-relaxed"
                  />
                  <div className="flex items-center justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setBodyInput(pr.body || "");
                        setIsEditingBody(false);
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
                      className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-[12px] font-medium bg-white text-black hover:bg-neutral-200 transition-colors font-semibold"
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
              ) : pr.body && pr.body.trim().length > 0 ? (
                <div className="select-text">
                  <MarkdownContent content={pr.body} />
                </div>
              ) : (
                <div className="py-4 text-center text-praxd-text-muted space-y-2">
                  <FileText className="w-5 h-5 mx-auto opacity-40" />
                  <p className="text-[12px]">No description provided for this pull request.</p>
                  <button
                    type="button"
                    onClick={() => setIsEditingBody(true)}
                    className="text-[12px] text-praxd-blue hover:underline"
                  >
                    + Add a description
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Checks Section */}
        <CheckRunList checks={pr.checks} />

        {/* Activity Timeline & Conversation Comment Section */}
        <ActivityTimeline pr={pr} />
      </div>
    </div>
  );
}
