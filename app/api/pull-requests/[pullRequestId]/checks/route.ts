import { NextRequest } from "next/server";
import { getAuthenticatedContext } from "@/lib/supabase/auth";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { fetchLivePullRequestChecks } from "@/lib/github/live";
import { apiSuccess, apiError } from "@/lib/api-response";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ pullRequestId: string }> }
) {
  const { pullRequestId } = await params;
  const auth = await getAuthenticatedContext();
  if (!auth) {
    return apiError("UNAUTHORIZED", "Authentication required.", 401);
  }

  // Handle live PR check runs directly from GitHub API
  if (pullRequestId.startsWith("live__")) {
    const parts = pullRequestId.split("__");
    if (parts.length === 4) {
      const owner = parts[1];
      const repo = parts[2];
      const checks = await fetchLivePullRequestChecks(owner, repo, "head");
      return apiSuccess({ checks });
    }
  }

  const supabase = createServiceRoleClient();

  const { data: pr, error: prError } = await supabase
    .from("pull_requests")
    .select(`
      id,
      head_sha,
      repository_id,
      number,
      repositories (
        owner_login,
        name
      )
    `)
    .eq("id", pullRequestId)
    .eq("workspace_id", auth.workspaceId)
    .single();

  if (prError || !pr) {
    return apiError("NOT_FOUND", "Pull request not found.", 404);
  }

  const { data: checks, error } = await supabase
    .from("check_runs")
    .select("*")
    .eq("pull_request_id", pullRequestId)
    .eq("workspace_id", auth.workspaceId)
    .order("started_at", { ascending: false });

  if (!error && checks && checks.length > 0) {
    const domainChecks = checks.map((c: any) => ({
      id: c.id,
      name: c.name,
      status: c.status || "completed",
      conclusion: c.conclusion || undefined,
      startedAt: c.started_at || undefined,
      completedAt: c.completed_at || undefined,
      detailsUrl: c.details_url || undefined,
    }));
    return apiSuccess({ checks: domainChecks });
  }

  // If no check runs in DB yet, fetch live from GitHub
  const prData = pr as any;
  const repo = prData?.repositories;
  if (repo?.owner_login && repo?.name && prData?.head_sha) {
    const liveChecks = await fetchLivePullRequestChecks(repo.owner_login, repo.name, prData.head_sha);
    if (liveChecks.length > 0) {
      const checkRows = liveChecks.map((ch) => ({
        workspace_id: auth.workspaceId,
        repository_id: prData.repository_id,
        pull_request_id: pullRequestId,
        github_check_id: parseInt(ch.id, 10) || null,
        name: ch.name,
        head_sha: prData.head_sha,
        status: ch.status,
        conclusion: ch.conclusion || null,
        details_url: ch.detailsUrl || null,
        started_at: ch.startedAt || null,
        completed_at: ch.completedAt || null,
        source: "check_run",
      }));

      supabase.from("check_runs").insert(checkRows).then();
      return apiSuccess({ checks: liveChecks });
    }
  }

  return apiSuccess({ checks: [] });
}
