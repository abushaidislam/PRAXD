import { NextRequest } from "next/server";
import { getAuthenticatedContext } from "@/lib/supabase/auth";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { apiSuccess, apiError } from "@/lib/api-response";
import { logAuditEvent } from "@/lib/audit/logger";
import { getInstallationAccessToken } from "@/lib/github/app-auth";
import { githubFetch } from "@/lib/github/client";

/**
 * Opt-in publication of an advisory AI finding to GitHub.
 *
 * Rules:
 * - Requires explicit confirmation (`confirmed: true`).
 * - Strictly advisory: never called automatically.
 * - Requires workspace membership.
 * - Failure does not erase or corrupt the local finding.
 * - Records an immutable audit log entry.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ findingId: string }> }
) {
  const { findingId } = await params;
  const auth = await getAuthenticatedContext();
  if (!auth) {
    return apiError("UNAUTHORIZED", "Authentication required.", 401);
  }

  let body: any = {};
  try {
    body = await req.json();
  } catch {
    return apiError("INVALID_JSON", "Request body must be valid JSON.", 400);
  }

  if (!body.confirmed) {
    return apiError(
      "CONFIRMATION_REQUIRED",
      "Explicit confirmation ('confirmed: true') is required before publishing a comment to GitHub.",
      400
    );
  }

  const supabase = createServiceRoleClient();

  // Fetch finding with its review run and pull request
  const { data: rawFinding, error: findingError } = await supabase
    .from("ai_findings")
    .select(`
      id,
      title,
      description,
      recommendation,
      severity,
      kind,
      file_path,
      line_start,
      line_end,
      status,
      review_runs:review_run_id (
        id,
        head_sha,
        pull_requests:pull_request_id (
          id,
          number,
          state,
          repository_id,
          repositories:repository_id (
            id,
            owner,
            name,
            installation_id,
            github_installations:installation_id (
              id,
              installation_id,
              status
            )
          )
        )
      )
    `)
    .eq("id", findingId)
    .eq("workspace_id", auth.workspaceId)
    .single();

  if (findingError || !rawFinding) {
    return apiError("NOT_FOUND", "Finding not found or access denied.", 404);
  }

  const finding = rawFinding as any;
  const run = finding.review_runs;
  const pr = run?.pull_requests;
  const repo = pr?.repositories;
  const installation = repo?.github_installations;

  if (!pr || !repo) {
    return apiError("PR_NOT_FOUND", "Associated pull request not found.", 404);
  }

  // PR must be open
  if (pr.state !== "open") {
    return apiError(
      "PR_CLOSED",
      `Cannot publish comment to a ${pr.state} pull request.`,
      400
    );
  }

  // Format the advisory comment body
  const commentMarkdown = [
    `### 🤖 PRAXD AI Review Finding: ${finding.title}`,
    `**Severity:** \`${(finding.severity || "").toUpperCase()}\` | **Category:** \`${finding.kind}\``,
    "",
    finding.description,
    "",
    "**Recommendation:**",
    finding.recommendation,
    "",
    `_Published by user via PRAXD_`,
  ].join("\n");

  let publishedCommentId: number | string = `mock-${Date.now()}`;
  let publishMode: "live" | "simulated" = "simulated";

  // If live installation exists and private key is configured, publish via GitHub API
  if (
    installation?.installation_id &&
    process.env.GITHUB_APP_PRIVATE_KEY_BASE64 &&
    process.env.GITHUB_APP_ID
  ) {
    try {
      const token = await getInstallationAccessToken(installation.installation_id);
      const res = await githubFetch<{ id: number }>(
        `https://api.github.com/repos/${repo.owner}/${repo.name}/issues/${pr.number}/comments`,
        token,
        {
          method: "POST",
          body: JSON.stringify({ body: commentMarkdown }),
        }
      );

      publishedCommentId = res.data.id;
      publishMode = "live";
    } catch (err: any) {
      console.error("[PublishFinding] GitHub API publication error:", err.message);
      return apiError(
        "GITHUB_PUBLISH_FAILED",
        `Failed to publish comment to GitHub: ${err.message}`,
        502
      );
    }
  }

  // Record audit log event
  await logAuditEvent(supabase, {
    workspaceId: auth.workspaceId,
    actorUserId: auth.userId,
    action: "ai_finding.published_to_github",
    resourceType: "ai_finding",
    resourceId: finding.id,
    metadata: {
      findingTitle: finding.title,
      pullRequestNumber: pr.number,
      repository: `${repo.owner}/${repo.name}`,
      publishedCommentId,
      publishMode,
    },
  });

  return apiSuccess({
    published: true,
    publishedCommentId,
    mode: publishMode,
    message:
      publishMode === "live"
        ? "Comment successfully published to GitHub."
        : "Simulated comment publication succeeded (fixture/dry-run mode).",
  });
}
