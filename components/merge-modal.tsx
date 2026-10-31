"use client";

import React, { useState } from "react";
import { GitMerge, GitCommit, GitPullRequest, X, AlertCircle, CheckCircle2, Loader2 } from "lucide-react";
import { PullRequest } from "@/types/pr";

interface MergeModalProps {
  pr: PullRequest;
  isOpen: boolean;
  onClose: () => void;
  onMergeSuccess: () => void;
}

export type MergeMethod = "merge" | "squash" | "rebase";

export function MergeModal({ pr, isOpen, onClose, onMergeSuccess }: MergeModalProps) {
  const [mergeMethod, setMergeMethod] = useState<MergeMethod>("merge");
  const [commitTitle, setCommitTitle] = useState(
    `Merge pull request #${pr.number} from ${pr.headRef}`
  );
  const [commitMessage, setCommitMessage] = useState(pr.title || "");
  const [isMerging, setIsMerging] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  React.useEffect(() => {
    if (!isOpen) return;
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !isMerging) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [isOpen, isMerging, onClose]);

  if (!isOpen) return null;

  const handleMethodChange = (method: MergeMethod) => {
    setMergeMethod(method);
    if (method === "squash") {
      setCommitTitle(`${pr.title} (#${pr.number})`);
      setCommitMessage(pr.body || "");
    } else if (method === "rebase") {
      setCommitTitle("");
      setCommitMessage("");
    } else {
      setCommitTitle(`Merge pull request #${pr.number} from ${pr.headRef}`);
      setCommitMessage(pr.title || "");
    }
  };

  const handleConfirmMerge = async () => {
    setIsMerging(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const res = await fetch(`/api/pull-requests/${pr.id}/merge`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mergeMethod,
          commitTitle: commitTitle.trim() || undefined,
          commitMessage: commitMessage.trim() || undefined,
        }),
      });

      const json = await res.json();

      if (!res.ok || json.error) {
        setErrorMessage(json.error?.message || json.message || "Failed to merge pull request");
        setIsMerging(false);
        return;
      }

      setSuccessMessage(json.data?.message || "Pull request merged successfully!");
      setTimeout(() => {
        setIsMerging(false);
        onMergeSuccess();
        onClose();
      }, 900);
    } catch (err: any) {
      setErrorMessage(err.message || "Network error occurred during merge");
      setIsMerging(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm select-none animate-in fade-in duration-150"
      role="dialog"
      aria-modal="true"
      aria-labelledby="merge-modal-title"
    >
      <div className="relative w-full max-w-[520px] rounded-xl bg-[#181818] border border-praxd-border-soft p-5 shadow-2xl text-praxd-text space-y-4 animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-praxd-border-soft">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-[#242424] text-praxd-green">
              <GitMerge className="w-4 h-4" />
            </div>
            <div>
              <h2 id="merge-modal-title" className="text-[14px] font-semibold text-white">
                Merge Pull Request #{pr.number}
              </h2>
              <p className="text-[11.5px] text-praxd-text-muted">
                Merging <code className="text-praxd-text font-mono text-[11px]">{pr.headRef}</code> into{" "}
                <code className="text-praxd-text font-mono text-[11px]">{pr.baseRef}</code>
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isMerging}
            className="p-1.5 rounded-lg hover:bg-[#252525] text-praxd-text-muted hover:text-praxd-text transition-colors disabled:opacity-50"
            aria-label="Close dialog"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Merge Strategy Options */}
        <div className="space-y-2">
          <label className="text-[12px] font-medium text-praxd-text-secondary">
            Select merge strategy:
          </label>
          <div className="grid grid-cols-1 gap-2">
            {/* Merge Commit */}
            <label
              className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-all ${
                mergeMethod === "merge"
                  ? "bg-[#222222] border-praxd-border text-white shadow-sm"
                  : "bg-[#141414] border-praxd-border-soft text-praxd-text-muted hover:border-praxd-border/60"
              }`}
            >
              <input
                type="radio"
                name="merge-method"
                value="merge"
                checked={mergeMethod === "merge"}
                onChange={() => handleMethodChange("merge")}
                className="mt-0.5"
              />
              <div className="space-y-0.5">
                <span className="text-[12.5px] font-medium text-praxd-text flex items-center gap-1.5">
                  <GitMerge className="w-3.5 h-3.5 text-praxd-green" />
                  Create a merge commit
                </span>
                <p className="text-[11px] text-praxd-text-muted leading-relaxed">
                  All commits from this branch will be added to the base branch via a merge commit.
                </p>
              </div>
            </label>

            {/* Squash and Merge */}
            <label
              className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-all ${
                mergeMethod === "squash"
                  ? "bg-[#222222] border-praxd-border text-white shadow-sm"
                  : "bg-[#141414] border-praxd-border-soft text-praxd-text-muted hover:border-praxd-border/60"
              }`}
            >
              <input
                type="radio"
                name="merge-method"
                value="squash"
                checked={mergeMethod === "squash"}
                onChange={() => handleMethodChange("squash")}
                className="mt-0.5"
              />
              <div className="space-y-0.5">
                <span className="text-[12.5px] font-medium text-praxd-text flex items-center gap-1.5">
                  <GitCommit className="w-3.5 h-3.5 text-praxd-blue" />
                  Squash and merge
                </span>
                <p className="text-[11px] text-praxd-text-muted leading-relaxed">
                  The commits from this branch will be combined into one single commit in the base branch.
                </p>
              </div>
            </label>

            {/* Rebase and Merge */}
            <label
              className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-all ${
                mergeMethod === "rebase"
                  ? "bg-[#222222] border-praxd-border text-white shadow-sm"
                  : "bg-[#141414] border-praxd-border-soft text-praxd-text-muted hover:border-praxd-border/60"
              }`}
            >
              <input
                type="radio"
                name="merge-method"
                value="rebase"
                checked={mergeMethod === "rebase"}
                onChange={() => handleMethodChange("rebase")}
                className="mt-0.5"
              />
              <div className="space-y-0.5">
                <span className="text-[12.5px] font-medium text-praxd-text flex items-center gap-1.5">
                  <GitPullRequest className="w-3.5 h-3.5 text-praxd-purple" />
                  Rebase and merge
                </span>
                <p className="text-[11px] text-praxd-text-muted leading-relaxed">
                  The commits will be rebased and added to the base branch individually without a merge commit.
                </p>
              </div>
            </label>
          </div>
        </div>

        {/* Commit Details (for merge & squash) */}
        {mergeMethod !== "rebase" && (
          <div className="space-y-2 pt-1">
            <div>
              <label className="text-[11.5px] font-medium text-praxd-text-muted block mb-1">
                Commit Title
              </label>
              <input
                type="text"
                value={commitTitle}
                onChange={(e) => setCommitTitle(e.target.value)}
                className="w-full px-3 py-1.5 rounded-lg bg-[#141414] border border-praxd-border-soft text-[12.5px] text-white focus:outline-none focus:border-praxd-border"
              />
            </div>
            <div>
              <label className="text-[11.5px] font-medium text-praxd-text-muted block mb-1">
                Commit Message (Optional)
              </label>
              <textarea
                rows={2}
                value={commitMessage}
                onChange={(e) => setCommitMessage(e.target.value)}
                className="w-full px-3 py-1.5 rounded-lg bg-[#141414] border border-praxd-border-soft text-[12px] text-praxd-text focus:outline-none focus:border-praxd-border resize-none"
              />
            </div>
          </div>
        )}

        {/* Error Alert */}
        {errorMessage && (
          <div className="flex items-start gap-2 p-2.5 rounded-lg bg-red-950/40 border border-red-800/60 text-red-300 text-[12px]">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Success Alert */}
        {successMessage && (
          <div className="flex items-center gap-2 p-2.5 rounded-lg bg-green-950/40 border border-green-800/60 text-green-300 text-[12px]">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{successMessage}</span>
          </div>
        )}

        {/* Footer Actions */}
        <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-praxd-border-soft">
          <button
            type="button"
            onClick={onClose}
            disabled={isMerging}
            className="px-3.5 py-1.5 rounded-lg text-[12px] font-medium bg-[#222222] hover:bg-[#2c2c2c] text-praxd-text transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleConfirmMerge}
            disabled={isMerging}
            className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-[12px] font-medium bg-praxd-green hover:bg-emerald-600 text-black font-semibold transition-all disabled:opacity-50 shadow-sm"
          >
            {isMerging ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Merging...</span>
              </>
            ) : (
              <>
                <GitMerge className="w-3.5 h-3.5" />
                <span>Confirm {mergeMethod === "squash" ? "Squash & Merge" : mergeMethod === "rebase" ? "Rebase & Merge" : "Merge"}</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
