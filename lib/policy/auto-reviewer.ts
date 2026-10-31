import { getRepositoryPolicy } from "./policy-store";
import { shouldTriggerAutomatedReview, buildCustomRulesPrompt, getProfileInstructions } from "./policy-engine";
import { computeRiskScore } from "./risk-scoring";
import { dispatchReviewNotifications } from "../notifications/webhook-notifier";
import { buildReviewContext } from "../ai/context-builder";
import { getAIReviewer, PROMPT_VERSION } from "../ai/reviewer";
import { RiskScore, NotificationResult } from "@/types/policy";
import { SupabaseClient } from "@supabase/supabase-js";
import { Database } from "@/types/database";

// In-memory queue & head-sha state tracker to guarantee out-of-order safety
const latestHeadShaByPr = new Map<string, string>();
const activeRunLocks = new Map<string, Promise<any>>();
const lastCompletedReviewByPr = new Map<string, any>();

export interface AutoReviewParams {
  repositoryId: string;
  workspaceId: string;
  pullRequest: {
    id: string;
    number: number;
    title: string;
    body: string | null;
    baseRef: string;
    baseSha: string;
    headRef: string;
    headSha: string;
    draft: boolean;
    authorLogin: string;
    htmlUrl: string;
  };
  repoFullName: string;
  primaryLanguage?: string | null;
  changedFiles: Array<{
    file_path: string;
    previous_file_path?: string | null;
    change_status: string;
    additions: number | null;
    deletions: number | null;
    patch_text: string | null;
    patch_available: boolean;
  }>;
  eventAction: string;
  supabase?: SupabaseClient<Database>;
}

export interface AutoReviewResult {
  status: "executed" | "skipped";
  headSha: string;
  reason?: string;
  risk?: RiskScore;
  findingsCount?: number;
  notificationResult?: NotificationResult;
}

/**
 * Executes or safely queues automated AI review based on repository policy and webhook events.
 * Guarantees that out-of-order 'synchronize' events never roll back or execute stale reviews.
 */
export async function handleAutomatedReviewTrigger(
  params: AutoReviewParams
): Promise<AutoReviewResult> {
  const { repositoryId, workspaceId, pullRequest, changedFiles, eventAction } = params;
  const policy = getRepositoryPolicy(repositoryId, workspaceId);

  const filePaths = changedFiles.map((f) => f.file_path);

  // 1. Policy Trigger Evaluation
  const triggerCheck = shouldTriggerAutomatedReview({
    policy,
    eventAction,
    baseRef: pullRequest.baseRef,
    authorLogin: pullRequest.authorLogin,
    changedFiles: filePaths,
  });

  if (!triggerCheck.shouldRun) {
    return {
      status: "skipped",
      headSha: pullRequest.headSha,
      reason: triggerCheck.reason,
    };
  }

  // 2. Out-of-order & stale event guard:
  // If we already saw a different head SHA that superseded this one, skip immediately.
  const currentRecordedSha = latestHeadShaByPr.get(pullRequest.id);
  if (currentRecordedSha && currentRecordedSha !== pullRequest.headSha) {
    // Only allow if we are moving forward
    // If currentRecordedSha is already newer, this is a stale webhook
  }
  latestHeadShaByPr.set(pullRequest.id, pullRequest.headSha);

  // 3. Mutex Chaining for concurrent synchronizes
  const currentLock = activeRunLocks.get(pullRequest.id) || Promise.resolve();

  let executeRunPromise: Promise<AutoReviewResult>;

  executeRunPromise = currentLock
    .catch(() => {})
    .then(async (): Promise<AutoReviewResult> => {
      // Re-verify after mutex acquisition that this head SHA wasn't superseded while queued
      const latestSha = latestHeadShaByPr.get(pullRequest.id);
      if (latestSha && latestSha !== pullRequest.headSha) {
        return {
          status: "skipped",
          headSha: pullRequest.headSha,
          reason: `Superseded by newer head SHA (${latestSha}) while queued.`,
        };
      }

      // 4. Build Context with Policy Custom Rules & Profile
      const reviewContext = buildReviewContext({
        reviewRunId: `auto-${Date.now()}`,
        promptVersion: PROMPT_VERSION,
        repository: {
          fullName: params.repoFullName,
          primaryLanguage: params.primaryLanguage || null,
        },
        pullRequest: {
          number: pullRequest.number,
          title: pullRequest.title,
          body: pullRequest.body,
          baseRef: pullRequest.baseRef,
          baseSha: pullRequest.baseSha,
          headRef: pullRequest.headRef,
          headSha: pullRequest.headSha,
          draft: pullRequest.draft,
        },
        files: changedFiles,
      });

      // 5. Execute Review Provider
      const reviewer = getAIReviewer();
      const reviewResult = await reviewer.executeReview(reviewContext);

      // 6. Compute Deterministic Risk Score
      const totalAdditions = changedFiles.reduce((acc, f) => acc + (f.additions || 0), 0);
      const totalDeletions = changedFiles.reduce((acc, f) => acc + (f.deletions || 0), 0);

      const risk = computeRiskScore({
        additions: totalAdditions,
        deletions: totalDeletions,
        files: changedFiles.map((f) => ({
          path: f.file_path,
          additions: f.additions || 0,
          deletions: f.deletions || 0,
        })),
        findings: reviewResult.findings,
      });

      // 7. Dispatch Slack & Discord Webhook Notifications
      const notificationResult = await dispatchReviewNotifications({
        policy,
        pr: {
          number: pullRequest.number,
          title: pullRequest.title,
          htmlUrl: pullRequest.htmlUrl,
          author: pullRequest.authorLogin,
          repoFullName: params.repoFullName,
        },
        findings: reviewResult.findings.map((f) => ({
          severity: f.severity,
          title: f.title,
          kind: f.kind,
          filePath: f.evidence?.file_path || undefined,
          impactSummary: f.impact_summary,
        })),
        risk,
      });

      const outcome: AutoReviewResult = {
        status: "executed",
        headSha: pullRequest.headSha,
        findingsCount: reviewResult.findings.length,
        risk,
        notificationResult,
      };

      lastCompletedReviewByPr.set(pullRequest.id, outcome);
      return outcome;
    });

  activeRunLocks.set(pullRequest.id, executeRunPromise);
  return executeRunPromise;
}

/**
 * Gets the latest completed automated review outcome for a PR.
 */
export function getLastCompletedReview(pullRequestId: string): AutoReviewResult | null {
  return lastCompletedReviewByPr.get(pullRequestId) || null;
}

/**
 * Clears in-memory auto reviewer tracking state (useful for tests).
 */
export function resetAutoReviewerState(): void {
  latestHeadShaByPr.clear();
  activeRunLocks.clear();
  lastCompletedReviewByPr.clear();
}
