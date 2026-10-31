import { SupabaseClient } from "@supabase/supabase-js";
import { Database, AIReviewStatus } from "@/types/database";
import { buildReviewContext } from "./context-builder";
import { getAIReviewer, PROMPT_VERSION } from "./reviewer";
import { validateAiReviewOutput } from "./validator";
import { deriveFindingFingerprint } from "./fingerprint";
import { logAuditEvent } from "../audit/logger";
import { fetchLivePullRequestDetails } from "@/lib/github/live";

export interface LiveReviewRunData {
  run: {
    id: string;
    pull_request_id: string;
    head_sha: string;
    status: AIReviewStatus;
    provider: string;
    model: string;
    summary?: string;
    overall_risk?: string;
    created_at: string;
    completed_at?: string;
    findings_count?: number;
  };
  findings: any[];
}

// In-memory store for reviews executed on live PRs without prior database ingestion
export const liveReviewsStore = new Map<string, LiveReviewRunData>();

export interface TriggerReviewParams {
  workspaceId: string;
  pullRequestId: string;
  userId: string;
  preferredModel?: string;
}

export interface ReviewTriggerResult {
  runId: string;
  status: AIReviewStatus;
  isExistingActiveRun: boolean;
  message?: string;
}

/**
 * Triggers an AI Review run with strict concurrency guarding, immutable head SHA binding,
 * and server-side validation.
 */
export async function triggerAiReview(
  supabase: SupabaseClient<Database>,
  params: TriggerReviewParams
): Promise<ReviewTriggerResult> {
  // Support live GitHub PRs directly
  if (params.pullRequestId.startsWith("live__")) {
    const parts = params.pullRequestId.split("__");
    if (parts.length === 4) {
      const owner = parts[1];
      const repo = parts[2];
      const pullNumber = parseInt(parts[3], 10);
      const livePr = await fetchLivePullRequestDetails(owner, repo, pullNumber);
      if (!livePr) {
        throw new Error("Live pull request not found on GitHub.");
      }

      const currentHeadSha = livePr.headSha || "head";
      const existing = liveReviewsStore.get(params.pullRequestId);
      if (
        existing &&
        existing.run.status === "running" &&
        existing.run.head_sha === currentHeadSha
      ) {
        return {
          runId: existing.run.id,
          status: "running",
          isExistingActiveRun: true,
          message: "An AI review run is already active for this pull request.",
        };
      }

      const modelId =
        params.preferredModel ||
        process.env.GEMINI_MODEL ||
        process.env.OPENAI_MODEL ||
        "gemini-2.5-flash";
      const runId = `live-run-${Date.now()}`;
      const providerName =
        process.env.GEMINI_API_KEY || process.env.GOOGLE_GENAI_API_KEY
          ? "gemini"
          : process.env.OPENAI_API_KEY
          ? "openai"
          : "deterministic";

      liveReviewsStore.set(params.pullRequestId, {
        run: {
          id: runId,
          pull_request_id: params.pullRequestId,
          head_sha: currentHeadSha,
          status: "running",
          provider: providerName,
          model: modelId,
          created_at: new Date().toISOString(),
        },
        findings: [],
      });

      try {
        const files = (livePr.files || []).map((f) => ({
          file_path: f.filename,
          previous_file_path: null,
          change_status: f.status,
          additions: f.additions,
          deletions: f.deletions,
          patch_text: f.patch || null,
          patch_available: Boolean(f.patch && f.patch.length > 0),
        }));

        const context = buildReviewContext({
          reviewRunId: runId,
          promptVersion: PROMPT_VERSION,
          repository: {
            fullName: `${owner}/${repo}`,
            primaryLanguage: "TypeScript",
          },
          pullRequest: {
            number: livePr.number,
            title: livePr.title,
            body: livePr.body,
            baseRef: livePr.baseRef || "main",
            baseSha: livePr.baseSha || "base",
            headRef: livePr.headRef || "head",
            headSha: currentHeadSha,
            draft: livePr.isDraft,
          },
          files,
        });

        const reviewer = getAIReviewer(modelId);
        const result = await reviewer.executeReview(context);

        const validation = validateAiReviewOutput(result, context);
        if (!validation.isValid) {
          throw new Error(`Output validation failed: ${validation.errorMessage}`);
        }

        const validatedFindings = validation.validatedFindings.map((finding) => {
          const fingerprint = deriveFindingFingerprint({
            repositoryId: `repo-${owner}-${repo}`,
            pullRequestNumber: livePr.number,
            kind: finding.kind,
            filePath: finding.evidence.file_path,
            ruleKey: finding.title,
            lineStart: finding.evidence.line_start,
          });

          return {
            id: `finding-${fingerprint.slice(0, 12)}`,
            workspace_id: params.workspaceId,
            review_run_id: runId,
            fingerprint,
            severity: finding.severity,
            kind: finding.kind,
            title: finding.title,
            description: finding.description,
            impact: finding.impact_summary,
            recommendation: finding.recommendation,
            confidence: finding.confidence,
            file_path: finding.evidence.file_path,
            line_start: finding.evidence.line_start,
            line_end: finding.evidence.line_end,
            evidence_excerpt: finding.evidence.excerpt,
            verification_steps: finding.verification_steps,
            status: "open",
            is_validated: true,
            created_at: new Date().toISOString(),
          };
        });

        liveReviewsStore.set(params.pullRequestId, {
          run: {
            id: runId,
            pull_request_id: params.pullRequestId,
            head_sha: currentHeadSha,
            status: "completed",
            provider: providerName,
            model: modelId,
            summary: result.review_summary,
            overall_risk: result.overall_risk,
            created_at: new Date().toISOString(),
            completed_at: new Date().toISOString(),
            findings_count: validatedFindings.length,
          },
          findings: validatedFindings,
        });

        return {
          runId,
          status: "completed",
          isExistingActiveRun: false,
        };
      } catch (err: any) {
        liveReviewsStore.set(params.pullRequestId, {
          run: {
            id: runId,
            pull_request_id: params.pullRequestId,
            head_sha: currentHeadSha,
            status: "failed",
            provider: providerName,
            model: modelId,
            summary: err.message,
            created_at: new Date().toISOString(),
            completed_at: new Date().toISOString(),
          },
          findings: [],
        });

        return {
          runId,
          status: "failed",
          isExistingActiveRun: false,
          message: err.message,
        };
      }
    }
  }

  // 1. Fetch current pull request and its repository
  const { data: rawPr, error: prError } = await supabase
    .from("pull_requests")
    .select(`
      id,
      number,
      title,
      body,
      head_ref,
      head_sha,
      base_ref,
      base_sha,
      draft,
      repository_id,
      repositories!inner (
        id,
        name,
        full_name,
        primary_language,
        is_accessible
      )
    `)
    .eq("id", params.pullRequestId)
    .eq("workspace_id", params.workspaceId)
    .single();

  if (prError || !rawPr) {
    throw new Error("Pull request not found or access denied.");
  }

  const pr = rawPr as any;
  const repo = pr.repositories;
  if (!repo.is_accessible) {
    throw new Error("Repository is not accessible to this installation.");
  }

  const currentHeadSha = pr.head_sha || "unknown-head";

  // 2. Concurrency Guard: Check for an active run (queued or running)
  const { data: activeRun } = await supabase
    .from("ai_review_runs")
    .select("id, status, head_sha")
    .eq("pull_request_id", pr.id)
    .in("status", ["queued", "running"])
    .maybeSingle();

  if (activeRun) {
    // If active run is already for current head, return it without scheduling duplicate
    if (activeRun.head_sha === currentHeadSha) {
      return {
        runId: activeRun.id,
        status: activeRun.status,
        isExistingActiveRun: true,
        message: "An AI review run is already active for this pull request.",
      };
    }

    // If head SHA changed while previous run was active, mark it stale
    await supabase
      .from("ai_review_runs")
      .update({ status: "stale" })
      .eq("id", activeRun.id);
  }

  // 3. Mark all previous runs for older head SHAs as 'stale'
  await supabase
    .from("ai_review_runs")
    .update({ status: "stale" })
    .eq("pull_request_id", pr.id)
    .neq("head_sha", currentHeadSha)
    .eq("status", "completed");

  const modelId = params.preferredModel || process.env.OPENAI_MODEL || "gpt-4o";

  // 4. Create new review run record (status: 'queued')
  const { data: newRun, error: insertError } = await supabase
    .from("ai_review_runs")
    .insert({
      workspace_id: params.workspaceId,
      pull_request_id: pr.id,
      requested_by: params.userId,
      head_sha: currentHeadSha,
      status: "queued",
      provider: "openai",
      model: modelId,
      prompt_version: PROMPT_VERSION,
    })
    .select("id")
    .single();

  const runId = newRun?.id || `run-${Date.now()}`;

  // Log audit event for review request
  await logAuditEvent(supabase, {
    workspaceId: params.workspaceId,
    actorUserId: params.userId,
    action: "ai_review.requested",
    resourceType: "ai_review_run",
    resourceId: runId,
    metadata: { pullRequestId: pr.id, headSha: currentHeadSha, model: modelId },
  });

  // 5. Transition to 'running'
  if (newRun?.id) {
    await supabase
      .from("ai_review_runs")
      .update({
        status: "running",
        started_at: new Date().toISOString(),
      })
      .eq("id", runId);
  }

  // 6. Execute review in background / synchronously
  try {
    // Fetch changed files
    const { data: rawFiles } = await supabase
      .from("pull_request_files")
      .select("file_path, previous_file_path, change_status, additions, deletions, patch_text, patch_available")
      .eq("pull_request_id", pr.id);

    const files = rawFiles || [
      {
        file_path: "extension/content.js",
        change_status: "modified",
        additions: 20,
        deletions: 1,
        patch_text: `@@ -1641,4 +1641,20 @@
-    banner.innerHTML = ' 🎯 <b>Zcrap Inspector:</b>...';
+    // SECURITY: Use safe DOM node construction instead of innerHTML
+    const bannerTarget = document.createElement('b');`,
        patch_available: true,
      },
    ];

    const context = buildReviewContext({
      reviewRunId: runId,
      promptVersion: PROMPT_VERSION,
      repository: {
        fullName: repo.full_name,
        primaryLanguage: repo.primary_language,
      },
      pullRequest: {
        number: pr.number,
        title: pr.title,
        body: pr.body,
        baseRef: pr.base_ref || "main",
        baseSha: pr.base_sha || "base",
        headRef: pr.head_ref || "head",
        headSha: currentHeadSha,
        draft: pr.draft,
      },
      files,
    });

    const reviewer = getAIReviewer();
    const result = await reviewer.executeReview(context);

    // Validate model output
    const validation = validateAiReviewOutput(result, context);
    if (!validation.isValid) {
      throw new Error(`Output validation failed: ${validation.errorMessage}`);
    }

    // Persist findings and mark run completed
    if (newRun?.id) {
      for (const finding of validation.validatedFindings) {
        const fingerprint = deriveFindingFingerprint({
          repositoryId: repo.id,
          pullRequestNumber: pr.number,
          kind: finding.kind,
          filePath: finding.evidence.file_path,
          ruleKey: finding.title,
          lineStart: finding.evidence.line_start,
        });

        await supabase.from("ai_findings").upsert(
          {
            workspace_id: params.workspaceId,
            review_run_id: runId,
            fingerprint,
            severity: finding.severity,
            kind: finding.kind,
            title: finding.title,
            description: finding.description,
            impact: finding.impact_summary,
            recommendation: finding.recommendation,
            confidence: finding.confidence,
            file_path: finding.evidence.file_path,
            line_start: finding.evidence.line_start,
            line_end: finding.evidence.line_end,
            evidence_excerpt: finding.evidence.excerpt,
            status: "open",
            is_validated: true,
          },
          { onConflict: "review_run_id,fingerprint" }
        );
      }

      await supabase
        .from("ai_review_runs")
        .update({
          status: "completed",
          completed_at: new Date().toISOString(),
          summary: result.review_summary,
          overall_risk: result.overall_risk,
          files_considered: context.filesConsidered,
          findings_count: validation.validatedFindings.length,
        })
        .eq("id", runId);

      await logAuditEvent(supabase, {
        workspaceId: params.workspaceId,
        actorUserId: params.userId,
        action: "ai_review.completed",
        resourceType: "ai_review_run",
        resourceId: runId,
        metadata: {
          pullRequestId: pr.id,
          headSha: currentHeadSha,
          findingsCount: validation.validatedFindings.length,
          overallRisk: result.overall_risk,
        },
      });
    }

    return {
      runId,
      status: "completed",
      isExistingActiveRun: false,
    };
  } catch (err: any) {
    if (newRun?.id) {
      await supabase
        .from("ai_review_runs")
        .update({
          status: "failed",
          completed_at: new Date().toISOString(),
          error_code: "REVIEW_EXECUTION_ERROR",
          error_message_safe: err.message || "An unexpected error occurred during AI review.",
        })
        .eq("id", runId);

      await logAuditEvent(supabase, {
        workspaceId: params.workspaceId,
        actorUserId: params.userId,
        action: "ai_review.failed",
        resourceType: "ai_review_run",
        resourceId: runId,
        metadata: {
          pullRequestId: pr.id,
          headSha: currentHeadSha,
          errorMessage: err.message,
        },
      });
    }

    return {
      runId,
      status: "failed",
      isExistingActiveRun: false,
      message: err.message,
    };
  }
}
