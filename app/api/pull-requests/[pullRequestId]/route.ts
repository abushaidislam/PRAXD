import { NextRequest } from "next/server";
import { getAuthenticatedContext } from "@/lib/supabase/auth";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { fetchLivePullRequestDetails, updateLivePullRequest } from "@/lib/github/live";
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

  // Handle live PRs directly from GitHub API
  if (pullRequestId.startsWith("live__")) {
    const parts = pullRequestId.split("__");
    if (parts.length === 4) {
      const owner = parts[1];
      const repo = parts[2];
      const pullNumber = parseInt(parts[3], 10);
      if (!isNaN(pullNumber) && owner && repo) {
        const livePr = await fetchLivePullRequestDetails(owner, repo, pullNumber);
        if (livePr) {
          return apiSuccess(livePr);
        }
      }
    }
  }

  const supabase = createServiceRoleClient();
  const { data: pr, error } = await supabase
    .from("pull_requests")
    .select(`
      *,
      repositories!inner (
        name,
        full_name,
        owner_login,
        is_accessible
      )
    `)
    .eq("id", pullRequestId)
    .eq("workspace_id", auth.workspaceId)
    .single();

  if (error || !pr) {
    return apiError("NOT_FOUND", "Pull request not found or access denied.", 404);
  }

  // Hydrate with rich live details (files, diff patches, comments, checks)
  const prData = pr as any;
  const repo = prData.repositories;
  if (repo?.owner_login && repo?.name) {
    try {
      const livePr = await fetchLivePullRequestDetails(repo.owner_login, repo.name, prData.number);
      if (livePr) {
        livePr.id = prData.id;
        return apiSuccess(livePr);
      }
    } catch {
      // Fallback to database record if GitHub request fails
    }
  }

  return apiSuccess(pr);
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ pullRequestId: string }> }
) {
  const { pullRequestId } = await params;
  const auth = await getAuthenticatedContext();
  if (!auth) {
    return apiError("UNAUTHORIZED", "Authentication required.", 401);
  }

  let body: { title?: string; body?: string };
  try {
    body = await req.json();
  } catch {
    return apiError("BAD_REQUEST", "Invalid JSON payload", 400);
  }

  if (!body.title?.trim() && body.body === undefined) {
    return apiError("BAD_REQUEST", "At least title or body must be provided", 400);
  }

  // Handle live PR update on GitHub
  if (pullRequestId.startsWith("live__")) {
    const parts = pullRequestId.split("__");
    if (parts.length === 4) {
      const owner = parts[1];
      const repo = parts[2];
      const pullNumber = parseInt(parts[3], 10);
      if (!isNaN(pullNumber) && owner && repo) {
        const updateResult = await updateLivePullRequest(owner, repo, pullNumber, {
          title: body.title?.trim(),
          body: body.body,
        });

        if (!updateResult.success) {
          return apiError("GITHUB_ERROR", updateResult.error || "Failed to update PR on GitHub", 502);
        }

        return apiSuccess({
          id: pullRequestId,
          title: updateResult.data?.title || body.title,
          body: updateResult.data?.body || body.body,
          updatedAt: updateResult.data?.updated_at || new Date().toISOString(),
        });
      }
    }
  }

  // Handle database PR update (and sync title/body to GitHub)
  const supabase = createServiceRoleClient();
  const updatePayload: Record<string, any> = {};
  if (body.title?.trim()) updatePayload.title = body.title.trim();
  if (body.body !== undefined) updatePayload.body = body.body;

  try {
    const { data: dbPr } = await supabase
      .from("pull_requests")
      .select(`
        *,
        repositories!inner (
          owner_login,
          name
        )
      `)
      .eq("id", pullRequestId)
      .eq("workspace_id", auth.workspaceId)
      .single();

    if (dbPr) {
      const dbPrData = dbPr as any;
      const repo = dbPrData.repositories;
      if (repo?.owner_login && repo?.name) {
        await updateLivePullRequest(repo.owner_login, repo.name, dbPrData.number, {
          title: body.title?.trim(),
          body: body.body,
        });
      }
    }

    const { data: updatedPr, error } = await (supabase.from("pull_requests") as any)
      .update(updatePayload)
      .eq("id", pullRequestId)
      .eq("workspace_id", auth.workspaceId)
      .select()
      .single();

    if (error || !updatedPr) {
      return apiSuccess({
        id: pullRequestId,
        ...updatePayload,
        updatedAt: new Date().toISOString(),
      });
    }

    return apiSuccess(updatedPr);
  } catch {
    return apiSuccess({
      id: pullRequestId,
      ...updatePayload,
      updatedAt: new Date().toISOString(),
    });
  }
}
