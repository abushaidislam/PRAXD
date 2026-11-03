import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedContext } from "@/lib/supabase/auth";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { fetchLivePullRequestDetails, updateLivePullRequest } from "@/lib/github/live";
import { mapDbPrToDomain } from "@/lib/github/mapper";
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
          return NextResponse.json({
            data: livePr,
            ...livePr,
          });
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

        // Persist enriched metadata and sync comments, checks, and commits to Supabase in background
        syncPrDetailsToSupabase(supabase, auth.workspaceId, prData, livePr).catch((err) =>
          console.error("Background sync error:", err)
        );

        return NextResponse.json({
          data: livePr,
          ...livePr,
        });
      }
    } catch {
      // Fallback to database record if GitHub request fails
    }
  }

  // Always return clean domain-mapped PR, never raw database row!
  const domainPr = mapDbPrToDomain(pr);
  return NextResponse.json({
    data: domainPr,
    ...domainPr,
  });
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

    return apiSuccess(mapDbPrToDomain(updatedPr));
  } catch {
    return apiSuccess({
      id: pullRequestId,
      ...updatePayload,
      updatedAt: new Date().toISOString(),
    });
  }
}

/**
 * Synchronizes live PR details (metadata, comments, checks, commits) to Supabase tables.
 */
async function syncPrDetailsToSupabase(
  supabase: any,
  workspaceId: string,
  prRecord: any,
  livePr: any
) {
  try {
    // 1. Update pull_requests row with latest metadata
    await supabase
      .from("pull_requests")
      .update({
        head_ref: livePr.headRef,
        base_ref: livePr.baseRef,
        head_sha: livePr.headSha,
        base_sha: livePr.baseSha,
        additions: livePr.additions,
        deletions: livePr.deletions,
        changed_files_count: livePr.changedFilesCount,
        comments_count: livePr.commentsCount,
      })
      .eq("id", prRecord.id);

    // 2. Sync comments to pull_request_comments table
    if (Array.isArray(livePr.comments) && livePr.comments.length > 0) {
      const commentRows = livePr.comments.map((c: any) => {
        const ghCommentId = parseInt(c.id, 10);
        return {
          workspace_id: workspaceId,
          pull_request_id: prRecord.id,
          github_comment_id: isNaN(ghCommentId) ? Math.floor(Date.now() / 1000) : ghCommentId,
          comment_type: c.commentType === "review" ? "review" : "issue",
          author_login: c.author?.login || "unknown",
          author_avatar_url: c.author?.avatarUrl || null,
          body: c.body || "",
          path: c.path || null,
          line: c.line ?? null,
          side: c.side || null,
          created_at_github: c.createdAt || new Date().toISOString(),
          updated_at_github: c.createdAt || new Date().toISOString(),
        };
      });

      await supabase
        .from("pull_request_comments")
        .upsert(commentRows, { onConflict: "github_comment_id" });
    }

    // 3. Sync checks to check_runs table
    if (Array.isArray(livePr.checks) && livePr.checks.length > 0) {
      // First delete stale check runs for this pull_request_id to keep fresh
      await supabase
        .from("check_runs")
        .delete()
        .eq("pull_request_id", prRecord.id);

      const checkRows = livePr.checks.map((ch: any) => {
        const ghCheckId = parseInt(ch.id, 10);
        return {
          workspace_id: workspaceId,
          repository_id: prRecord.repository_id || prRecord.repositories?.id,
          pull_request_id: prRecord.id,
          github_check_id: isNaN(ghCheckId) ? null : ghCheckId,
          name: ch.name || "CI Check",
          head_sha: livePr.headSha,
          status: ch.status || "completed",
          conclusion: ch.conclusion || null,
          details_url: ch.detailsUrl || null,
          started_at: ch.startedAt || null,
          completed_at: ch.completedAt || null,
          source: "check_run",
        };
      });

      await supabase.from("check_runs").insert(checkRows);
    }

    // 4. Sync commits to pull_request_commits table
    if (Array.isArray(livePr.commits) && livePr.commits.length > 0) {
      const commitRows = livePr.commits.map((cm: any) => ({
        workspace_id: workspaceId,
        pull_request_id: prRecord.id,
        sha: cm.sha,
        message: cm.message || "Commit",
        author_login: cm.author?.login || null,
        author_avatar_url: cm.author?.avatarUrl || null,
        committed_at: cm.committedDate || new Date().toISOString(),
      }));

      await supabase
        .from("pull_request_commits")
        .upsert(commitRows, { onConflict: "pull_request_id,sha" });
    }
  } catch (err) {
    console.error("Failed to sync PR details to Supabase:", err);
  }
}
