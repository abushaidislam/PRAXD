import { NextRequest } from "next/server";
import { getAuthenticatedContext } from "@/lib/supabase/auth";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { fetchLivePullRequests } from "@/lib/github/live";
import { apiPaginated, apiError } from "@/lib/api-response";
import { PullRequest } from "@/types/pr";

function mapDbPrToDomain(pr: any): PullRequest {
  const diffMs = Date.now() - new Date(pr.github_updated_at || pr.updated_at).getTime();
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const relativeTime = diffHours < 24 ? `${Math.max(1, diffHours)}h` : `${Math.floor(diffHours / 24)}d`;

  return {
    id: pr.id,
    number: pr.number,
    title: pr.title,
    body: pr.body || "",
    state: pr.state,
    isDraft: Boolean(pr.is_draft),
    author: {
      login: pr.author_login || "unknown",
      avatarUrl: pr.author_avatar_url || "",
      name: pr.author_login || "unknown",
    },
    repoOwner: pr.repositories?.owner_login || "repo",
    repoName: pr.repositories?.name || "repo",
    headRef: pr.head_ref || "head",
    baseRef: pr.base_ref || "main",
    headSha: pr.head_sha || "head",
    baseSha: pr.base_sha || "base",
    additions: pr.additions || 0,
    deletions: pr.deletions || 0,
    changedFilesCount: pr.changed_files_count || 1,
    createdAt: pr.github_created_at || pr.created_at,
    updatedAt: pr.github_updated_at || pr.updated_at,
    relativeTime,
    category: pr.author_login === "abushaidislam" ? "authored" : "all",
    reviewDecision: pr.state === "open" ? "review_required" : undefined,
    reviewers: [],
    checksStatus: "success",
    checks: [],
    comments: [],
    commits: [],
    files: [],
  };
}

export async function GET(req: NextRequest) {
  const auth = await getAuthenticatedContext();
  if (!auth) {
    return apiError("UNAUTHORIZED", "Authentication required.", 401);
  }

  const { searchParams } = new URL(req.url);
  const view = searchParams.get("view") || "all";
  const state = searchParams.get("state") || "open";
  const q = searchParams.get("q");
  const limit = Math.min(parseInt(searchParams.get("limit") || "50", 10), 100);

  const supabase = createServiceRoleClient();
  let query = supabase
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
    .eq("workspace_id", auth.workspaceId)
    .eq("repositories.is_accessible", true)
    .order("github_updated_at", { ascending: false })
    .limit(limit);

  if (state !== "all") {
    query = query.eq("state", state as "open" | "closed" | "merged");
  }

  if (view === "authored") {
    query = query.eq("author_login", "abushaidislam");
  }

  if (q) {
    query = query.or(`title.ilike.%${q}%,number.eq.${parseInt(q, 10) || 0}`);
  }

  const { data, error } = await query;
  if (!error && data && data.length > 0) {
    const formattedPrs = data.map(mapDbPrToDomain);
    return apiPaginated(formattedPrs, { nextCursor: null, hasNextPage: false });
  }

  // Graceful fallback: If Supabase table is not yet migrated, fetch real live PRs directly from GitHub API
  const livePrs = await fetchLivePullRequests({ state, view, q: q || undefined, limit });
  return apiPaginated(livePrs, { nextCursor: null, hasNextPage: false });
}
