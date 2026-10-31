import React, { useState } from "react";
import {
  Sparkles,
  AlertTriangle,
  AlertCircle,
  Info,
  CheckCircle,
  XCircle,
  Clock,
  ChevronDown,
  ChevronRight,
  Copy,
  Check,
  RefreshCw,
  Send,
  Wrench,
  GitCommit,
} from "lucide-react";
import { FindingRecord, OverallRisk, FindingSeverity } from "@/types/ai-review";
import { cn } from "@/lib/utils";
import { AutofixModal } from "./autofix-modal";

interface AIReviewPanelProps {
  prId: string;
  headSha: string;
  findings: FindingRecord[];
  onTriggerReview: () => Promise<void>;
  isRunning?: boolean;
}

export function AIReviewPanel({
  prId,
  headSha,
  findings,
  onTriggerReview,
  isRunning = false,
}: AIReviewPanelProps) {
  const [selectedSeverity, setSelectedSeverity] = useState<string>("all");
  const [expandedFindingId, setExpandedFindingId] = useState<string | null>(
    findings[0]?.id || null
  );
  const [localFindings, setLocalFindings] = useState<FindingRecord[]>(findings);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [publishingId, setPublishingId] = useState<string | null>(null);
  const [publishedIds, setPublishedIds] = useState<Set<string>>(new Set());
  const [confirmPublishId, setConfirmPublishId] = useState<string | null>(null);
  const [autofixFinding, setAutofixFinding] = useState<FindingRecord | null>(null);
  const [committedFindings, setCommittedFindings] = useState<
    Map<string, { sha: string; branch: string }>
  >(new Map());

  // Synchronize local findings when parent prop updates (e.g. newly completed AI review)
  React.useEffect(() => {
    setLocalFindings(findings);
    if (findings.length > 0) {
      setExpandedFindingId((prev) => (prev ? prev : findings[0].id));
    }
  }, [findings]);

  const filteredFindings = localFindings.filter((f) => {
    if (selectedSeverity === "all") return true;
    return f.severity === selectedSeverity;
  });

  const handleUpdateStatus = (findingId: string, newStatus: "accepted" | "dismissed") => {
    setLocalFindings((prev) =>
      prev.map((f) => (f.id === findingId ? { ...f, status: newStatus } : f))
    );
  };

  const handleAutofixSuccess = (findingId: string, commitSha: string, branch: string) => {
    setCommittedFindings((prev) => {
      const updated = new Map(prev);
      updated.set(findingId, { sha: commitSha, branch });
      return updated;
    });
    handleUpdateStatus(findingId, "accepted");
  };

  const handlePublishFinding = async (findingId: string) => {
    setPublishingId(findingId);
    try {
      const res = await fetch(`/api/ai-findings/${findingId}/publish`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirmed: true }),
      });
      if (res.ok) {
        setPublishedIds((prev) => new Set([...prev, findingId]));
        setConfirmPublishId(null);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setPublishingId(null);
    }
  };

  const handleCopyRecommendation = (findingId: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(findingId);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const getSeverityBadge = (sev: FindingSeverity) => {
    switch (sev) {
      case "critical":
        return "bg-praxd-red/20 text-praxd-red border-praxd-red/40";
      case "high":
        return "bg-orange-950/40 text-orange-400 border-orange-800/40";
      case "medium":
        return "bg-praxd-amber/20 text-praxd-amber border-praxd-amber/40";
      case "low":
        return "bg-blue-950/30 text-praxd-blue border-blue-800/30";
      default:
        return "bg-neutral-800 text-praxd-text-muted border-praxd-border-soft";
    }
  };

  const criticalCount = localFindings.filter((f) => f.severity === "critical").length;
  const highCount = localFindings.filter((f) => f.severity === "high").length;
  const mediumCount = localFindings.filter((f) => f.severity === "medium").length;
  const lowCount = localFindings.filter((f) => f.severity === "low").length;

  return (
    <div className="flex flex-col h-full bg-[#161616] border border-praxd-border-soft rounded-lg overflow-hidden">
      {/* Panel Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-praxd-border-soft bg-[#1c1c1c]">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-praxd-blue animate-pulse" />
          <h3 className="font-semibold text-xs tracking-wide text-praxd-text">
            PRAXD AI Security & Quality Review
          </h3>
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-praxd-blue/10 text-praxd-blue border border-praxd-blue/20">
            Advisory
          </span>
        </div>

        <button
          type="button"
          onClick={onTriggerReview}
          disabled={isRunning}
          className="flex items-center gap-1.5 px-3 py-1 bg-praxd-blue hover:bg-blue-600 disabled:opacity-50 text-white text-xs font-medium rounded transition-colors"
        >
          {isRunning ? (
            <>
              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              <span>Analyzing...</span>
            </>
          ) : (
            <>
              <Sparkles className="w-3.5 h-3.5" />
              <span>Run AI Review</span>
            </>
          )}
        </button>
      </div>

      {/* Severity Filter Tabs */}
      <div className="flex items-center gap-1 px-4 py-2 border-b border-praxd-border-soft bg-[#181818] overflow-x-auto text-xs">
        <button
          type="button"
          onClick={() => setSelectedSeverity("all")}
          className={cn(
            "px-2.5 py-1 rounded transition-colors text-[11px]",
            selectedSeverity === "all"
              ? "bg-[#252525] text-praxd-text font-medium"
              : "text-praxd-text-muted hover:text-praxd-text"
          )}
        >
          All ({localFindings.length})
        </button>
        {criticalCount > 0 && (
          <button
            type="button"
            onClick={() => setSelectedSeverity("critical")}
            className={cn(
              "flex items-center gap-1 px-2.5 py-1 rounded transition-colors text-[11px]",
              selectedSeverity === "critical"
                ? "bg-praxd-red/20 text-praxd-red font-medium border border-praxd-red/40"
                : "text-praxd-red hover:bg-praxd-red/10"
            )}
          >
            Critical ({criticalCount})
          </button>
        )}
        {highCount > 0 && (
          <button
            type="button"
            onClick={() => setSelectedSeverity("high")}
            className={cn(
              "flex items-center gap-1 px-2.5 py-1 rounded transition-colors text-[11px]",
              selectedSeverity === "high"
                ? "bg-orange-950/40 text-orange-400 font-medium border border-orange-800/40"
                : "text-orange-400 hover:bg-orange-950/20"
            )}
          >
            High ({highCount})
          </button>
        )}
        {mediumCount > 0 && (
          <button
            type="button"
            onClick={() => setSelectedSeverity("medium")}
            className={cn(
              "flex items-center gap-1 px-2.5 py-1 rounded transition-colors text-[11px]",
              selectedSeverity === "medium"
                ? "bg-praxd-amber/20 text-praxd-amber font-medium border border-praxd-amber/40"
                : "text-praxd-amber hover:bg-praxd-amber/10"
            )}
          >
            Medium ({mediumCount})
          </button>
        )}
        {lowCount > 0 && (
          <button
            type="button"
            onClick={() => setSelectedSeverity("low")}
            className={cn(
              "flex items-center gap-1 px-2.5 py-1 rounded transition-colors text-[11px]",
              selectedSeverity === "low"
                ? "bg-blue-950/30 text-praxd-blue font-medium border border-blue-800/30"
                : "text-praxd-blue hover:bg-blue-950/20"
            )}
          >
            Low ({lowCount})
          </button>
        )}
      </div>

      {/* Findings List */}
      {filteredFindings.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-praxd-text-muted">
          <CheckCircle className="w-8 h-8 text-praxd-green mb-2 opacity-80" />
          <p className="text-sm font-medium text-praxd-text">No findings in this category</p>
          <p className="text-xs mt-1">All verified patches pass automated security rules.</p>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          <div className="divide-y divide-praxd-border-soft border border-praxd-border-soft rounded-lg bg-[#141414] overflow-hidden">
            {filteredFindings.map((finding) => {
              const isExpanded = expandedFindingId === finding.id;
              const isCommitted = committedFindings.has(finding.id);

              return (
                <div key={finding.id} className="transition-colors hover:bg-[#181818]">
                  {/* Finding Row Header */}
                  <div
                    onClick={() =>
                      setExpandedFindingId(isExpanded ? null : finding.id)
                    }
                    className="flex items-center justify-between p-3 cursor-pointer select-none"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      {isExpanded ? (
                        <ChevronDown className="w-4 h-4 text-praxd-text-muted shrink-0" />
                      ) : (
                        <ChevronRight className="w-4 h-4 text-praxd-text-muted shrink-0" />
                      )}

                      <span
                        className={cn(
                          "px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border shrink-0",
                          getSeverityBadge(finding.severity)
                        )}
                      >
                        {finding.severity}
                      </span>

                      <span className="text-xs font-medium text-praxd-text truncate">
                        {finding.title}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      {isCommitted ? (
                        <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-emerald-950/40 text-emerald-400 border border-emerald-800/40 flex items-center gap-1">
                          <GitCommit className="w-3 h-3" />
                          Fixed
                        </span>
                      ) : finding.status === "accepted" ? (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-praxd-green/10 text-praxd-green border border-praxd-green/20">
                          Accepted
                        </span>
                      ) : finding.status === "dismissed" ? (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-neutral-800 text-praxd-text-muted">
                          Dismissed
                        </span>
                      ) : null}

                      {finding.filePath && (
                        <span className="text-[11px] font-mono text-praxd-text-muted bg-[#202020] px-2 py-0.5 rounded">
                          {finding.filePath.split("/").pop()}
                          {finding.lineStart ? `:${finding.lineStart}` : ""}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Finding Detailed Body */}
                  {isExpanded && (
                    <div className="px-4 pb-4 pt-1 space-y-3 bg-[#111111] border-t border-praxd-border-soft text-xs">
                      <p className="text-praxd-text-muted leading-relaxed">
                        {finding.description}
                      </p>

                      {/* Code Excerpt Snippet */}
                      {finding.evidenceExcerpt && (
                        <div className="space-y-1">
                          <span className="text-[10px] font-semibold text-praxd-text-muted uppercase tracking-wider">
                            Cited Code Excerpt
                          </span>
                          <pre className="p-2.5 rounded bg-[#0a0a0a] border border-praxd-border-soft font-mono text-[11px] text-praxd-text overflow-x-auto leading-normal">
                            <code>{finding.evidenceExcerpt}</code>
                          </pre>
                        </div>
                      )}

                      {/* AI Recommendation Details */}
                      {finding.recommendation && (
                        <div className="p-3 rounded bg-praxd-blue/5 border border-praxd-blue/20 space-y-1.5">
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] font-bold text-praxd-blue uppercase tracking-wider flex items-center gap-1">
                              <Sparkles className="w-3 h-3" />
                              Recommendation & Autofix
                            </span>
                            <button
                              type="button"
                              onClick={() =>
                                handleCopyRecommendation(finding.id, finding.recommendation!)
                              }
                              className="flex items-center gap-1 text-[10px] text-praxd-text-muted hover:text-praxd-text transition-colors"
                            >
                              {copiedId === finding.id ? (
                                <>
                                  <Check className="w-3 h-3 text-praxd-green" />
                                  <span>Copied</span>
                                </>
                              ) : (
                                <>
                                  <Copy className="w-3 h-3" />
                                  <span>Copy</span>
                                </>
                              )}
                            </button>
                          </div>
                          <p className="font-mono text-[11px] text-praxd-text">
                            {finding.recommendation}
                          </p>
                        </div>
                      )}

                      {/* User Actions: Apply Fix via Commit / Accept / Dismiss / Publish */}
                      <div className="flex items-center justify-between gap-2 pt-2 border-t border-praxd-border-soft flex-wrap">
                        <div className="flex items-center gap-2 flex-wrap">
                          {/* 1-Click Autonomous Autofix Button */}
                          {isCommitted ? (
                            <span className="flex items-center gap-1 text-[11px] text-emerald-400 font-medium bg-emerald-950/30 px-2.5 py-1 rounded border border-emerald-800/40">
                              <GitCommit className="w-3.5 h-3.5" />
                              <span>Committed ({committedFindings.get(finding.id)!.sha.slice(0, 7)})</span>
                            </span>
                          ) : (
                            <button
                              type="button"
                              onClick={() => setAutofixFinding(finding)}
                              className="flex items-center gap-1 px-2.5 py-1 rounded bg-praxd-blue/15 hover:bg-praxd-blue/25 text-[11px] text-praxd-blue font-medium border border-praxd-blue/30 transition-colors"
                            >
                              <Wrench className="w-3.5 h-3.5" />
                              <span>Apply Fix via Commit</span>
                            </button>
                          )}

                          {publishedIds.has(finding.id) ? (
                            <span className="flex items-center gap-1 text-[11px] text-praxd-green font-medium">
                              <Check className="w-3.5 h-3.5" />
                              <span>Published to GitHub</span>
                            </span>
                          ) : confirmPublishId === finding.id ? (
                            <div className="flex items-center gap-2 text-[11px]">
                              <span className="text-praxd-amber font-medium">Publish advisory comment?</span>
                              <button
                                type="button"
                                onClick={() => handlePublishFinding(finding.id)}
                                disabled={publishingId === finding.id}
                                className="px-2 py-0.5 rounded bg-praxd-blue hover:bg-blue-600 text-white font-medium disabled:opacity-50 transition-colors"
                              >
                                {publishingId === finding.id ? "Publishing..." : "Confirm"}
                              </button>
                              <button
                                type="button"
                                onClick={() => setConfirmPublishId(null)}
                                className="px-2 py-0.5 rounded bg-[#252525] text-praxd-text-muted hover:text-praxd-text transition-colors"
                              >
                                Cancel
                              </button>
                            </div>
                          ) : finding.status === "accepted" ? (
                            <button
                              type="button"
                              onClick={() => setConfirmPublishId(finding.id)}
                              className="flex items-center gap-1 px-2.5 py-1 rounded bg-neutral-800 hover:bg-neutral-700 text-[11px] text-neutral-300 font-medium border border-neutral-700 transition-colors"
                            >
                              <Send className="w-3.5 h-3.5" />
                              <span>Publish to GitHub</span>
                            </button>
                          ) : null}
                        </div>

                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => handleUpdateStatus(finding.id, "dismissed")}
                            className="flex items-center gap-1 px-2.5 py-1 rounded text-[11px] text-praxd-text-muted hover:text-praxd-text hover:bg-[#252525] transition-colors"
                          >
                            <XCircle className="w-3.5 h-3.5" />
                            <span>Dismiss</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleUpdateStatus(finding.id, "accepted")}
                            className="flex items-center gap-1 px-2.5 py-1 rounded bg-[#252525] hover:bg-[#303030] text-[11px] text-praxd-green font-medium transition-colors"
                          >
                            <CheckCircle className="w-3.5 h-3.5 text-praxd-green" />
                            <span>Mark Accepted</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 1-Click Autonomous Autofix Modal */}
      {autofixFinding && (
        <AutofixModal
          isOpen={Boolean(autofixFinding)}
          onClose={() => setAutofixFinding(null)}
          finding={autofixFinding}
          headBranch="main"
          onCommitSuccess={(sha, branch) =>
            handleAutofixSuccess(autofixFinding.id, sha, branch)
          }
        />
      )}
    </div>
  );
}
