import React, { useState } from "react";
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
  ExternalLink,
} from "lucide-react";
import { PullRequest } from "@/types/pr";
import { CheckRunList } from "./check-run-list";
import { ActivityTimeline } from "./activity-timeline";
import { AIReviewPanel } from "./ai-review-panel";
import { FindingRecord } from "@/types/ai-review";
import { cn } from "@/lib/utils";

interface SummaryViewProps {
  pr: PullRequest;
}

export function SummaryView({ pr }: SummaryViewProps) {
  const [isDescriptionExpanded, setIsDescriptionExpanded] = useState(true);
  const [isReviewRunning, setIsReviewRunning] = useState(false);
  const hasShield = pr.title.toLowerCase().includes("sentinel");

  // Dynamic findings state
  const [activeFindings, setActiveFindings] = useState<FindingRecord[]>(() => {
    return (pr.aiFindings || []).map((f) => ({
      id: f.id,
      reviewRunId: "run-fixture",
      fingerprint: f.id,
      severity: f.severity === "warning" ? "medium" : f.severity === "suggestion" ? "low" : (f.severity as any),
      kind: "security",
      title: f.title,
      description: f.explanation,
      impact: "Unsanitized input can cause security exploits or unexpected behavior.",
      recommendation: f.suggestedFix || null,
      confidence: f.confidence,
      filePath: f.filePath,
      lineStart: f.line || null,
      lineEnd: f.line || null,
      evidenceExcerpt: null,
      verificationSteps: ["Verify that no dynamic string concatenation is used for style or DOM nodes."],
      recommendedPatch: null,
      status: "open",
      isValidated: true,
      createdAt: new Date().toISOString(),
    }));
  });

  // Re-fetch findings when PR changes or on mount
  React.useEffect(() => {
    let isCancelled = false;

    // Reset to PR's initial findings first
    const initialFindings: FindingRecord[] = (pr.aiFindings || []).map((f) => ({
      id: f.id,
      reviewRunId: "run-fixture",
      fingerprint: f.id,
      severity: f.severity === "warning" ? "medium" : f.severity === "suggestion" ? "low" : (f.severity as any),
      kind: "security",
      title: f.title,
      description: f.explanation,
      impact: "Unsanitized input can cause security exploits or unexpected behavior.",
      recommendation: f.suggestedFix || null,
      confidence: f.confidence,
      filePath: f.filePath,
      lineStart: f.line || null,
      lineEnd: f.line || null,
      evidenceExcerpt: null,
      verificationSteps: ["Verify that no dynamic string concatenation is used for style or DOM nodes."],
      recommendedPatch: null,
      status: "open",
      isValidated: true,
      createdAt: new Date().toISOString(),
    }));
    setActiveFindings(initialFindings);

    async function loadLatestFindings() {
      try {
        const res = await fetch(`/api/pull-requests/${pr.id}/ai-review`);
        if (res.ok) {
          const json = await res.json();
          if (!isCancelled && json.data && json.data.findings && json.data.findings.length > 0) {
            setActiveFindings(json.data.findings);
          }
        }
      } catch {
        // Fallback to initial
      }
    }

    loadLatestFindings();

    return () => {
      isCancelled = true;
    };
  }, [pr.id, pr.aiFindings]);

  const handleTriggerReview = async () => {
    setIsReviewRunning(true);
    try {
      const res = await fetch(`/api/pull-requests/${pr.id}/ai-review`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      if (res.ok) {
        // Fetch newly generated findings
        const reviewRes = await fetch(`/api/pull-requests/${pr.id}/ai-review`);
        if (reviewRes.ok) {
          const reviewJson = await reviewRes.json();
          if (reviewJson.data && reviewJson.data.findings) {
            setActiveFindings(reviewJson.data.findings);
          }
        }
      }
    } catch {
      // Offline/demo fallback
    } finally {
      setIsReviewRunning(false);
    }
  };

  return (
    <div className="h-full overflow-y-auto px-4 md:px-8 py-6 select-text">
      <div className="max-w-[780px] mx-auto space-y-6">
        {/* PR Title & Edit Header */}
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-2.5">
            {hasShield && (
              <ShieldAlert className="w-6 h-6 text-praxd-blue shrink-0 mt-0.5" />
            )}
            <h1 className="text-[22px] font-semibold text-praxd-text leading-snug">
              {pr.title}
            </h1>
          </div>
          <button
            type="button"
            className="p-1 rounded hover:bg-[#202020] text-praxd-text-muted hover:text-praxd-text transition-colors"
            aria-label="Edit title"
          >
            <Pencil className="w-4 h-4" />
          </button>
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
              <span className="font-mono text-praxd-text-secondary text-[11px] bg-[#1a1a1a] px-2 py-0.5 rounded border border-praxd-border-soft">
                {pr.headRef}
              </span>
              <span className="text-praxd-text-muted">&gt;</span>
              <span className="font-mono text-praxd-text-secondary text-[11px] bg-[#1a1a1a] px-2 py-0.5 rounded border border-praxd-border-soft">
                {pr.baseRef}
              </span>
              <div className="flex items-center gap-1 font-mono text-[11px] ml-1">
                <span className="text-praxd-green">+{pr.additions}</span>
                <span className="text-praxd-red">-{pr.deletions}</span>
              </div>
            </div>
          </div>

          {/* Reviewers Row */}
          <div className="flex items-center">
            <div className="w-[120px] flex items-center gap-2 text-praxd-text-muted">
              <Users className="w-3.5 h-3.5" />
              <span>Reviewers</span>
            </div>
            <button
              type="button"
              className="text-praxd-text-secondary hover:text-praxd-text hover:underline text-[12px] flex items-center gap-1"
            >
              <span>+ Request</span>
            </button>
          </div>

          {/* Comments Row */}
          <div className="flex items-center">
            <div className="w-[120px] flex items-center gap-2 text-praxd-text-muted">
              <MessageSquare className="w-3.5 h-3.5" />
              <span>Comments</span>
            </div>
            <span className="text-praxd-text-secondary">
              {pr.comments.length} comments
            </span>
          </div>

          {/* Checks Row */}
          <div className="flex items-center">
            <div className="w-[120px] flex items-center gap-2 text-praxd-text-muted">
              <CheckCircle2 className="w-3.5 h-3.5 text-praxd-green" />
              <span>Checks</span>
            </div>
            <span className="text-praxd-green font-medium">Successful</span>
          </div>

          {/* Status Row */}
          <div className="flex items-center">
            <div className="w-[120px] flex items-center gap-2 text-praxd-text-muted">
              <GitPullRequest className="w-3.5 h-3.5" />
              <span>Status</span>
            </div>
            <div className="flex items-center gap-1 text-praxd-text cursor-pointer hover:text-white">
              <span>Ready for review</span>
              <ChevronDown className="w-3.5 h-3.5 text-praxd-text-muted" />
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
            <button
              type="button"
              className="p-1 rounded hover:bg-[#202020] text-praxd-text-muted hover:text-praxd-text transition-colors"
              aria-label="Edit description"
            >
              <Pencil className="w-3.5 h-3.5" />
            </button>
          </div>

          {isDescriptionExpanded && (
            <div className="rounded-lg bg-[#161616] border border-praxd-border-soft p-4 text-[13px] leading-relaxed space-y-3.5 text-praxd-text-secondary">
              {/* Parse structured body notes like the screenshot */}
              <div className="space-y-2">
                <div className="flex items-baseline gap-2">
                  <span>🚨</span>
                  <span className="font-semibold text-praxd-text">Severity:</span>
                  <span className="text-praxd-amber font-medium">MEDIUM</span>
                </div>
                <div className="flex items-baseline gap-2">
                  <span>💡</span>
                  <span className="font-semibold text-praxd-text">Vulnerability:</span>
                  <span>
                    Raw <code className="bg-[#242424] px-1.5 py-0.5 rounded text-praxd-text font-mono text-[11.5px]">innerHTML</code> string assignment in content script UI banner construction ( <code className="text-praxd-text font-mono text-[11.5px]">extension/content.js</code> ).
                  </span>
                </div>
                <div className="flex items-baseline gap-2">
                  <span>🎯</span>
                  <span className="font-semibold text-praxd-text">Impact:</span>
                  <span>
                    Unsanitized DOM HTML manipulation can lead to DOM-based XSS vulnerability if template strings are modified or manipulated by third-party scripts.
                  </span>
                </div>
                <div className="flex items-baseline gap-2">
                  <span>🔨</span>
                  <span className="font-semibold text-praxd-text">Fix:</span>
                  <span>
                    Replaced <code className="bg-[#242424] px-1.5 py-0.5 rounded text-praxd-text font-mono text-[11.5px]">innerHTML</code> with safe DOM construction methods ( <code className="text-praxd-text font-mono text-[11.5px]">document.createElement</code>, <code className="text-praxd-text font-mono text-[11.5px]">textContent</code>, <code className="text-praxd-text font-mono text-[11.5px]">append</code> ).
                  </span>
                </div>
                <div className="flex items-baseline gap-2">
                  <span>✅</span>
                  <span className="font-semibold text-praxd-text">Verification:</span>
                  <span>
                    Ran <code className="bg-[#242424] px-1.5 py-0.5 rounded text-praxd-text font-mono text-[11.5px]">npm test</code> ( <code className="text-praxd-text font-mono text-[11.5px]">node scripts/validate.js</code> ) to verify syntax and manifest integrity with 0 errors.
                  </span>
                </div>
              </div>

              <div className="pt-2 border-t border-praxd-border-soft text-[11.5px] text-praxd-text-muted italic flex items-center gap-1.5 flex-wrap">
                <span>PR created automatically by Jules for task</span>
                <span className="inline-flex items-center gap-1 text-praxd-blue not-italic font-mono underline hover:text-white cursor-pointer">
                  <span>🌐 16400552792134975329</span>
                </span>
                <span>started by <strong className="not-italic text-praxd-text font-medium">@{pr.author.login}</strong></span>
              </div>
            </div>
          )}
        </div>

        {/* AI Review Panel Section */}
        <AIReviewPanel
          prId={pr.id}
          headSha={pr.headSha}
          findings={activeFindings}
          onTriggerReview={handleTriggerReview}
          isRunning={isReviewRunning}
        />

        {/* Checks Section */}
        <CheckRunList checks={pr.checks} />

        {/* Activity Timeline Section */}
        <ActivityTimeline pr={pr} />
      </div>
    </div>
  );
}
