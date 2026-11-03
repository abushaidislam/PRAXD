import { NextRequest } from "next/server";
import { getAuthenticatedContext } from "@/lib/supabase/auth";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { fetchLivePullRequestCommits } from "@/lib/github/live";
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

  // Handle live PR commits directly from GitHub API
  if (pullRequestId.startsWith("live__")) {
    const parts = pullRequestId.split("__");
    if (parts.length === 4) {
      const owner = parts[1];
      const repo = parts[2];
      const pullNumber = parseInt(parts[3], 10);
      if (!isNaN(pullNumber) && owner && repo) {
        const commits = await fetchLivePullRequestCommits(owner, repo, pullNumber);
        return apiSuccess({ commits });
      }
    }
  }

  const supabase = createServiceRoleClient();
  const { data: commits, error } = await supabase
    .from("pull_request_commits")
    .select("*")
    .eq("pull_request_id", pullRequestId)
    .eq("workspace_id", auth.workspaceId)
    .order("committed_at", { ascending: false });

  if (!error && commits && commits.length > 0) {
    const domainCommits = commits.map((c: any) => ({
      sha: c.sha,
      shortSha: (c.sha || "").slice(0, 7),
      message: c.message || "Commit",
      author: {
        login: c.author_login || "unknown",
        avatarUrl:
          c.author_avatar_url ||
          (c.author_login
            ? `https://github.com/${c.author_login}.png`
            : "https://github.com/ghost.png"),
        name: c.author_login || "unknown",
      },
      committedDate: c.committed_at || new Date().toISOString(),
    }));
    return apiSuccess({ commits: domainCommits });
  }

  // If no commits in DB yet, fetch live from GitHub
  const { data: dbPr } = await supabase
    .from("pull_requests")
    .select("number, repositories ( owner_login, name )")
    .eq("id", pullRequestId)
    .eq("workspace_id", auth.workspaceId)
    .single();

  const prData = dbPr as any;
  const repo = prData?.repositories;
  if (repo?.owner_login && repo?.name && prData?.number) {
    const liveCommits = await fetchLivePullRequestCommits(repo.owner_login, repo.name, prData.number);
    if (liveCommits.length > 0) {
      const commitRows = liveCommits.map((cm) => ({
        workspace_id: auth.workspaceId,
        pull_request_id: pullRequestId,
        sha: cm.sha,
        message: cm.message,
        author_login: cm.author.login,
        author_avatar_url: cm.author.avatarUrl,
        committed_at: cm.committedDate,
      }));

      supabase
        .from("pull_request_commits")
        .upsert(commitRows, { onConflict: "pull_request_id,sha" })
        .then();

      return apiSuccess({ commits: liveCommits });
    }
  }

  return apiSuccess({ commits: [] });
}
