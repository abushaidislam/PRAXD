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
import { InternalNotesPanel } from "./internal-notes-panel";
import { FindingRecord } from "@/types/ai-review";
import { computeRiskScore } from "@/lib/policy/risk-scoring";
import { RiskBadge } from "./risk-badge";
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

  // Synchronize when parent PR findings update
  React.useEffect(() => {
    if (pr.aiFindings && pr.aiFindings.length > 0) {
      const mapped: FindingRecord[] = pr.aiFindings.map((f) => ({
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
      setActiveFindings(mapped);
    }
  }, [pr.aiFindings]);

  const handleTriggerReview = async () => {
    setIsReviewRunning(true);
    try {
      const res = await fetch(`/api/pull-requests/${pr.id}/ai-review`, {
        method: "POST",
      });
      if (res.ok) {
        const json = await res.json();
        // Immediately fetch newly created review run findings
        const fetchRes = await fetch(`/api/pull-requests/${pr.id}/ai-review`);
        if (fetchRes.ok) {
          const fetchedJson = await fetchRes.json();
          if (fetchedJson.data && fetchedJson.data.findings && fetchedJson.data.findings.length > 0) {
            setActiveFindings(fetchedJson.data.findings);
            return;
          }
        }

        if (json.data && json.data.findings && json.data.findings.length > 0) {
          setActiveFindings(json.data.findings);
        }
      }
    } catch {
      // Keep existing findings on error
    } finally {
      setIsReviewRunning(false);
    }
  };

  const risk = React.useMemo(() => {
    return computeRiskScore({
      additions: pr.additions || 0,
      deletions: pr.deletions || 0,
      files: (pr.files || []).map((f) => ({
        path: f.filename,
        additions: f.additions,
        deletions: f.deletions,
      })),
      findings: activeFindings.map((f) => ({ severity: f.severity })),
    });
  }, [pr.additions, pr.deletions, pr.files, activeFindings]);

  return (
    <div className="h-full overflow-y-auto bg-praxd-bg select-text">
      <div className="max-w-4xl mx-auto px-6 py-6 space-y-6">
        {/* Title and PR Number Header */}
        <div className="space-y-1.5">
          <div className="flex items-start gap-2.5">
            {hasShield && (
              <ShieldAlert className="w-5 h-5 text-praxd-blue shrink-0 mt-0.5" />
            )}
            <h1 className="text-[17px] font-semibold text-praxd-text leading-snug">
              {pr.title}
            </h1>
          </div>
          <div className="flex items-center gap-2 text-[12px] text-praxd-text-muted">
            <span className="font-mono text-praxd-text-secondary">#{pr.number}</span>
            <span>·</span>
            <span>{pr.author.name || pr.author.login} wants to merge changes into</span>
            <span className="px-1.5 py-0.5 rounded bg-[#1e1e1e] font-mono text-praxd-text-secondary text-[11px] border border-praxd-border-soft">
              {pr.baseRef}
            </span>
            <span>from</span>
            <span className="px-1.5 py-0.5 rounded bg-[#1e1e1e] font-mono text-praxd-text-secondary text-[11px] border border-praxd-border-soft">
              {pr.headRef}
            </span>
          </div>
        </div>

        {/* Metadata Properties Grid */}
        <div className="rounded-lg bg-[#141414] border border-praxd-border-soft p-4 space-y-3 text-[12px]">
          {/* Author Row */}
          <div className="flex items-center">
            <div className="w-[120px] flex items-center gap-2 text-praxd-text-muted">
              <div className="w-4 h-4 rounded-full bg-neutral-700 flex items-center justify-center text-[10px] text-white">
                {pr.author.login[0]?.toUpperCase()}
              </div>
              <span>Author</span>
            </div>
            <div className="flex items-center gap-2 text-praxd-text">
              <span className="font-medium">{pr.author.login}</span>
              {pr.author.name && (
                <span className="text-praxd-text-muted">({pr.author.name})</span>
              )}
            </div>
          </div>

          {/* Branch Comparison Row */}
          <div className="flex items-center">
            <div className="w-[120px] flex items-center gap-2 text-praxd-text-muted">
              <GitBranch className="w-3.5 h-3.5" />
              <span>Branch</span>
            </div>
            <div className="flex items-center gap-1.5 text-praxd-text font-mono text-[11px]">
              <span className="text-praxd-text-secondary">{pr.headRef}</span>
              <span className="text-praxd-text-muted">&gt;</span>
              <span className="text-praxd-text-muted">{pr.baseRef}</span>
            </div>
          </div>

          {/* Reviewers Row */}
          <div className="flex items-center">
            <div className="w-[120px] flex items-center gap-2 text-praxd-text-muted">
              <Users className="w-3.5 h-3.5" />
              <span>Reviewers</span>
            </div>
            <div className="flex items-center gap-2 text-praxd-text">
              {pr.reviewers && pr.reviewers.length > 0 ? (
                pr.reviewers.map((r) => (
                  <div key={r.login} className="flex items-center gap-1.5 bg-[#1e1e1e] px-2 py-0.5 rounded border border-praxd-border-soft text-[11px]">
                    <div className="w-3.5 h-3.5 rounded-full bg-neutral-600 flex items-center justify-center text-[8px] text-white">
                      {r.login[0]?.toUpperCase()}
                    </div>
                    <span>{r.login}</span>
                    {r.state === "approved" && (
                      <span className="text-emerald-400 text-[10px]">✓</span>
                    )}
                  </div>
                ))
              ) : (
                <span className="text-praxd-text-muted italic">No reviewers requested</span>
              )}
            </div>
          </div>

          {/* Comments Row */}
          <div className="flex items-center">
            <div className="w-[120px] flex items-center gap-2 text-praxd-text-muted">
              <MessageSquare className="w-3.5 h-3.5" />
              <span>Comments</span>
            </div>
            <span className="text-praxd-text font-mono">{pr.comments?.length || 0}</span>
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

        {/* Phase 7: PR Blast Radius & Risk Assessment Card */}
        <div className="p-4 rounded-lg bg-[#181818] border border-praxd-border-soft space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-[13px] font-semibold text-zinc-100">PR Blast Radius & Risk Analysis</span>
              <RiskBadge risk={risk} />
            </div>
            <span className="font-mono text-xs text-zinc-400">Composite Score: {risk.score}/100</span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
            <div className="p-2.5 rounded bg-zinc-900 border border-zinc-800">
              <div className="text-[11px] text-zinc-400">Churn Volume</div>
              <div className="font-semibold text-zinc-200 mt-0.5">{risk.factors.churnScore}/25 pts</div>
              <div className="text-[10px] text-zinc-500 font-mono mt-0.5">+{pr.additions || 0} -{pr.deletions || 0}</div>
            </div>

            <div className="p-2.5 rounded bg-zinc-900 border border-zinc-800">
              <div className="text-[11px] text-zinc-400">Core Modules</div>
              <div className="font-semibold text-zinc-200 mt-0.5">{risk.factors.blastRadiusScore}/25 pts</div>
              <div className="text-[10px] text-zinc-500 mt-0.5">{risk.factors.criticalFilesTouched.length} sensitive path(s)</div>
            </div>

            <div className="p-2.5 rounded bg-zinc-900 border border-zinc-800">
              <div className="text-[11px] text-zinc-400">Dependencies</div>
              <div className="font-semibold text-zinc-200 mt-0.5">{risk.factors.dependencyScore}/15 pts</div>
              <div className="text-[10px] text-zinc-500 mt-0.5">{risk.factors.dependenciesTouched.length > 0 ? "Manifest modified" : "No deps changed"}</div>
            </div>

            <div className="p-2.5 rounded bg-zinc-900 border border-zinc-800">
              <div className="text-[11px] text-zinc-400">Test Coverage</div>
              <div className="font-semibold text-zinc-200 mt-0.5">{risk.factors.testCoverageScore === 0 ? "Passed (0 pts)" : "Untested (+15 pts)"}</div>
              <div className="text-[10px] text-zinc-500 mt-0.5">{risk.factors.hasTests ? "Tests touched" : "No test updates"}</div>
            </div>
          </div>
        </div>

        {/* AI Review Panel Section */}
        <AIReviewPanel
          prId={pr.id}
          headSha={pr.headSha}
          findings={activeFindings}
          onTriggerReview={handleTriggerReview}
          isRunning={isReviewRunning}
        />

        {/* Internal Team Discussion Section (Phase 6) */}
        <InternalNotesPanel pullRequestId={pr.id} />

        {/* Checks Section */}
        <CheckRunList checks={pr.checks} />

        {/* Activity Timeline Section */}
        <ActivityTimeline pr={pr} />
      </div>
    </div>
  );
}
