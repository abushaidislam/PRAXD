import React, { useState } from "react";
import {
  X,
  Wrench,
  GitCommit,
  GitBranch,
  CheckCircle,
  AlertTriangle,
  Loader2,
  FileCode,
  ShieldCheck,
} from "lucide-react";
import { FindingRecord } from "@/types/ai-review";
import { validateCodeSyntax } from "@/lib/autofix/syntax-validator";
import { formatConventionalCommitMessage, getCompanionBranchName } from "@/lib/autofix/commit-engine";

interface AutofixModalProps {
  isOpen: boolean;
  onClose: () => void;
  finding: FindingRecord;
  headBranch?: string;
  onCommitSuccess: (commitSha: string, branch: string) => void;
}

export function AutofixModal({
  isOpen,
  onClose,
  finding,
  headBranch = "main",
  onCommitSuccess,
}: AutofixModalProps) {
  const [targetBranchMode, setTargetBranchMode] = useState<"direct" | "companion">("direct");
  const [isConfirmed, setIsConfirmed] = useState(false);
  const [isCommitting, setIsCommitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  const filePath = finding.filePath || "src/index.ts";
  const proposedCode =
    finding.recommendedPatch?.content ||
    finding.recommendation ||
    "// Resolved: " + finding.title;

  const syntaxValidation = validateCodeSyntax(proposedCode, filePath);
  const companionBranch = getCompanionBranchName(finding.id);
  const targetBranch = targetBranchMode === "direct" ? headBranch : companionBranch;
  const commitMessage = formatConventionalCommitMessage(finding.title, filePath);

  const handleCommit = async () => {
    if (!isConfirmed) return;
    setIsCommitting(true);
    setErrorMessage(null);

    try {
      const res = await fetch(`/api/ai-findings/${finding.id}/autofix`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          confirmed: true,
          targetBranchMode,
          proposedCode,
          filePath,
          title: finding.title,
        }),
      });

      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error?.message || json.message || "Failed to commit autofix.");
      }

      onCommitSuccess(json.data.commitSha, json.data.branch);
      onClose();
    } catch (err: any) {
      setErrorMessage(err.message || "An unexpected error occurred during commit.");
    } finally {
      setIsCommitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="bg-[#141414] border border-[#262626] rounded-xl shadow-2xl w-full max-w-2xl overflow-hidden text-sm flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-[#262626] bg-[#181818]">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 rounded-md bg-praxd-blue/15 text-praxd-blue border border-praxd-blue/30">
              <Wrench className="w-4 h-4" />
            </div>
            <div>
              <h2 className="font-semibold text-white text-[13px] tracking-tight">
                1-Click Autonomous Autofix & Git Commit
              </h2>
              <p className="text-[11px] text-neutral-400">
                Explicit two-click human review and pre-commit syntax validation
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded text-neutral-400 hover:text-white hover:bg-[#252525] transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 overflow-y-auto space-y-4">
          {/* Finding summary pill */}
          <div className="bg-[#191919] border border-[#262626] rounded-lg p-3">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-praxd-blue">
                Target Finding
              </span>
              <span className="font-mono text-[11px] text-neutral-400 flex items-center gap-1">
                <FileCode className="w-3.5 h-3.5 text-neutral-500" />
                {filePath}
              </span>
            </div>
            <p className="text-white font-medium text-[12px]">{finding.title}</p>
          </div>

          {/* Syntax Validation Status */}
          <div
            className={`p-3 rounded-lg border flex items-start gap-2.5 ${
              syntaxValidation.valid
                ? "bg-emerald-950/20 border-emerald-800/40 text-emerald-300"
                : "bg-red-950/20 border-red-800/40 text-red-300"
            }`}
          >
            {syntaxValidation.valid ? (
              <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
            ) : (
              <AlertTriangle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
            )}
            <div className="text-[11px]">
              <div className="font-semibold">
                {syntaxValidation.valid
                  ? `Pre-Commit Syntax Validated (${syntaxValidation.language})`
                  : "Syntax Validation Warning"}
              </div>
              <div className="text-neutral-400 mt-0.5">
                {syntaxValidation.valid
                  ? "Delimiters, brackets, and language invariants verified. Safe to commit."
                  : syntaxValidation.errors.join("; ")}
              </div>
            </div>
          </div>

          {/* Code Replacement Preview */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-medium text-neutral-300">
              Proposed Code Transformation
            </label>
            <div className="bg-[#0e0e0e] border border-[#262626] rounded-lg p-3 font-mono text-[11px] max-h-48 overflow-y-auto text-emerald-400 leading-relaxed whitespace-pre">
              {proposedCode}
            </div>
          </div>

          {/* Branch Target Selection */}
          <div className="space-y-2">
            <label className="text-[11px] font-medium text-neutral-300">
              Commit Destination Branch
            </label>
            <div className="grid grid-cols-2 gap-3">
              <label
                className={`flex items-start gap-2.5 p-3 rounded-lg border cursor-pointer transition-all ${
                  targetBranchMode === "direct"
                    ? "bg-praxd-blue/10 border-praxd-blue text-white"
                    : "bg-[#191919] border-[#262626] text-neutral-400 hover:border-neutral-700"
                }`}
              >
                <input
                  type="radio"
                  name="branchMode"
                  checked={targetBranchMode === "direct"}
                  onChange={() => setTargetBranchMode("direct")}
                  className="mt-0.5 text-praxd-blue"
                />
                <div>
                  <div className="font-medium text-[12px] flex items-center gap-1.5">
                    <GitBranch className="w-3.5 h-3.5" />
                    Direct to PR Branch
                  </div>
                  <div className="text-[10px] text-neutral-400 mt-0.5">
                    Commit to <code className="text-neutral-300">{headBranch}</code>
                  </div>
                </div>
              </label>

              <label
                className={`flex items-start gap-2.5 p-3 rounded-lg border cursor-pointer transition-all ${
                  targetBranchMode === "companion"
                    ? "bg-praxd-blue/10 border-praxd-blue text-white"
                    : "bg-[#191919] border-[#262626] text-neutral-400 hover:border-neutral-700"
                }`}
              >
                <input
                  type="radio"
                  name="branchMode"
                  checked={targetBranchMode === "companion"}
                  onChange={() => setTargetBranchMode("companion")}
                  className="mt-0.5 text-praxd-blue"
                />
                <div>
                  <div className="font-medium text-[12px] flex items-center gap-1.5">
                    <GitBranch className="w-3.5 h-3.5" />
                    Companion Branch
                  </div>
                  <div className="text-[10px] text-neutral-400 mt-0.5 truncate max-w-[180px]">
                    Creates <code className="text-neutral-300">{companionBranch}</code>
                  </div>
                </div>
              </label>
            </div>
          </div>

          {/* Commit Message & Co-Author Attribution */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-medium text-neutral-300">
              Commit Message & Attribution Preview
            </label>
            <div className="bg-[#101010] border border-[#262626] rounded-lg p-2.5 font-mono text-[10px] text-neutral-400 leading-normal whitespace-pre">
              {commitMessage}
            </div>
          </div>

          {/* Two-Click Safety Confirmation Checkbox */}
          <div className="pt-2">
            <label className="flex items-center gap-2.5 text-[12px] text-neutral-200 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={isConfirmed}
                onChange={(e) => setIsConfirmed(e.target.checked)}
                className="w-4 h-4 rounded bg-[#1e1e1e] border-[#333] text-praxd-blue focus:ring-0"
              />
              <span>
                I have inspected this transformation and authorize write-back to{" "}
                <code className="text-praxd-blue">{targetBranch}</code>.
              </span>
            </label>
          </div>

          {errorMessage && (
            <div className="p-2.5 rounded-lg bg-red-950/30 border border-red-800/50 text-red-400 text-[11px]">
              {errorMessage}
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-between px-5 py-3 border-t border-[#262626] bg-[#181818]">
          <div className="text-[11px] text-neutral-500 flex items-center gap-1">
            <GitCommit className="w-3.5 h-3.5" />
            <span>Target: {targetBranch}</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isCommitting}
              className="px-3 py-1.5 rounded-md text-[12px] text-neutral-400 hover:text-white hover:bg-[#252525] transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleCommit}
              disabled={!isConfirmed || isCommitting || !syntaxValidation.valid}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-md text-[12px] font-medium bg-praxd-blue hover:bg-blue-600 disabled:opacity-40 disabled:hover:bg-praxd-blue text-white transition-colors"
            >
              {isCommitting ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Committing...</span>
                </>
              ) : (
                <>
                  <Wrench className="w-3.5 h-3.5" />
                  <span>Confirm & Commit Fix</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
