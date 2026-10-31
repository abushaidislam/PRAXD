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
} from "lucide-react";
import { FindingRecord, OverallRisk, FindingSeverity } from "@/types/ai-review";
import { cn } from "@/lib/utils";

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

  return (
    <div className="rounded-xl bg-[#161616] border border-praxd-border-soft overflow-hidden space-y-3 p-4 select-text">
      {/* Header Bar */}
      <div className="flex items-center justify-between border-b border-praxd-border-soft pb-3">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-praxd-blue/15 text-praxd-blue border border-praxd-blue/30">
            <Sparkles className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-[13px] font-semibold text-praxd-text flex items-center gap-2">
              <span>PRAXD AI Code Review</span>
              <span className="text-[10px] font-mono text-praxd-text-muted px-1.5 py-0.2 rounded bg-[#202020] border border-praxd-border-soft">
                {headSha.slice(0, 7)}
              </span>
            </h3>
            <p className="text-[11px] text-praxd-text-muted">
              Advisory security, performance and correctness analysis.
            </p>
          </div>
        </div>

        {/* Trigger / Rerun Button */}
        <button
          type="button"
          onClick={onTriggerReview}
          disabled={isRunning}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#242424] hover:bg-[#2c2c2c] disabled:opacity-50 text-[12px] font-medium text-praxd-text border border-praxd-border-soft transition-colors shadow-sm"
        >
          <RefreshCw className={cn("w-3.5 h-3.5", isRunning && "animate-spin text-praxd-blue")} />
          <span>{isRunning ? "Reviewing..." : findings.length > 0 ? "Rerun AI Review" : "Run AI Review"}</span>
        </button>
      </div>

      {/* Running State Indicator */}
      {isRunning && (
        <div className="p-4 rounded-lg bg-[#141414] border border-praxd-border-soft flex items-center gap-3">
          <Clock className="w-5 h-5 text-praxd-blue animate-pulse shrink-0" />
          <div className="text-[12px] space-y-0.5">
            <p className="font-medium text-praxd-text">Analyzing changed files and commit diffs...</p>
            <p className="text-[11px] text-praxd-text-muted">
              Verifying evidence anchors against current head SHA {headSha.slice(0, 7)}.
            </p>
          </div>
        </div>
      )}

      {/* Findings Filters & Count */}
      {!isRunning && localFindings.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1 text-[11px]">
              {(["all", "critical", "medium", "low"] as const).map((sev) => (
                <button
                  key={sev}
                  type="button"
                  onClick={() => setSelectedSeverity(sev)}
                  className={cn(
                    "px-2.5 py-1 rounded capitalize transition-colors font-medium",
                    selectedSeverity === sev
                      ? "bg-[#282828] text-white"
                      : "text-praxd-text-muted hover:text-praxd-text"
                  )}
                >
                  {sev}
                </button>
              ))}
            </div>

            <span className="text-[11px] text-praxd-text-muted font-mono">
              {filteredFindings.length} {filteredFindings.length === 1 ? "finding" : "findings"}
            </span>
          </div>

          {/* Findings List */}
          <div className="space-y-2">
            {filteredFindings.map((finding) => {
              const isExpanded = expandedFindingId === finding.id;
              return (
                <div
                  key={finding.id}
                  className="rounded-lg bg-[#1a1a1a] border border-praxd-border-soft overflow-hidden transition-colors"
                >
                  {/* Finding Title Row */}
                  <button
                    type="button"
                    onClick={() => setExpandedFindingId(isExpanded ? null : finding.id)}
                    className="w-full text-left p-3 flex items-start justify-between gap-3 hover:bg-[#202020] transition-colors"
                  >
                    <div className="flex items-start gap-2.5 min-w-0">
                      <span
                        className={cn(
                          "px-1.5 py-0.5 rounded text-[10px] font-mono font-bold uppercase border shrink-0 mt-0.5",
                          getSeverityBadge(finding.severity)
                        )}
                      >
                        {finding.severity}
                      </span>
                      <div className="min-w-0">
                        <p className="text-[12.5px] font-medium text-praxd-text truncate">
                          {finding.title}
                        </p>
                        <p className="text-[11px] text-praxd-text-muted font-mono mt-0.5">
                          {finding.filePath} {finding.lineStart && `:${finding.lineStart}`}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      {finding.status !== "open" && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#252525] text-praxd-text-muted capitalize">
                          {finding.status}
                        </span>
                      )}
                      {isExpanded ? (
                        <ChevronDown className="w-4 h-4 text-praxd-text-muted" />
                      ) : (
                        <ChevronRight className="w-4 h-4 text-praxd-text-muted" />
                      )}
                    </div>
                  </button>

                  {/* Expanded Finding Detail */}
                  {isExpanded && (
                    <div className="p-3.5 pt-0 border-t border-praxd-border-soft mt-2 space-y-3 text-[12px] text-praxd-text-secondary leading-relaxed">
                      <div>
                        <strong className="text-praxd-text block mb-1">Description:</strong>
                        <p>{finding.description}</p>
                      </div>

                      {finding.impact && (
                        <div>
                          <strong className="text-praxd-text block mb-1">Impact:</strong>
                          <p>{finding.impact}</p>
                        </div>
                      )}

                      {finding.recommendation && (
                        <div className="p-2.5 rounded-lg bg-[#141414] border border-praxd-border-soft space-y-1.5">
                          <div className="flex items-center justify-between text-praxd-green text-[11px] font-medium">
                            <span>Recommended Fix:</span>
                            <button
                              type="button"
                              onClick={() => handleCopyRecommendation(finding.id, finding.recommendation!)}
                              className="flex items-center gap-1 hover:text-white transition-colors"
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

                      {/* User Actions: Accept / Dismiss / Publish (Advisory only) */}
                      <div className="flex items-center justify-between gap-2 pt-2 border-t border-praxd-border-soft">
                        <div className="flex items-center gap-2">
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
                              className="flex items-center gap-1 px-2.5 py-1 rounded bg-praxd-blue/15 hover:bg-praxd-blue/25 text-[11px] text-praxd-blue font-medium border border-praxd-blue/30 transition-colors"
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
    </div>
  );
}
