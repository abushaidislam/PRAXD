import { SupabaseClient } from "@supabase/supabase-js";
import { Database, PullRequestState, CommentType, PullRequestReviewState } from "@/types/database";
import { githubFetch, githubFetchAllPages } from "./client";
import { getInstallationAccessToken } from "./app-auth";

/**
 * Maps GitHub PR state to PRAXD canonical enum state
 * Requirement P1-05:
 * merged_at != null -> 'merged'; otherwise state == 'closed' -> 'closed'; otherwise 'open'
 */
export function mapPullRequestState(githubPr: {
  state: string;
  merged_at?: string | null;
}): PullRequestState {
  if (githubPr.merged_at != null) {
    return "merged";
  }
  if (githubPr.state.toLowerCase() === "closed") {
    return "closed";
  }
  return "open";
}

/**
 * Maps GitHub review state to canonical enum
 */
export function mapReviewState(state: string): PullRequestReviewState {
  switch (state.toUpperCase()) {
    case "APPROVED":
      return "approved";
    case "CHANGES_REQUESTED":
      return "changes_requested";
    case "COMMENTED":
      return "commented";
    case "DISMISSED":
      return "dismissed";
    case "PENDING":
      return "pending";
    default:
      return "unknown";
  }
}

/**
 * Synchronizes repositories accessible to an installation.
 * Uses (installation_id, github_repo_id) natural idempotency key.
 */
export async function syncInstallationRepositories(
  supabase: SupabaseClient<Database>,
  installationIdUuid: string,
  githubInstallationId: number,
  workspaceId: string
): Promise<{ added: number; updated: number }> {
  const token = await getInstallationAccessToken(githubInstallationId);

  // List repositories accessible to the app installation
  const { data } = await githubFetch<{
    total_count: number;
    repositories: Array<{
      id: number;
      name: string;
      full_name: string;
      owner: { login: string };
      description: string | null;
      html_url: string;
      private: boolean;
      language: string | null;
      default_branch: string;
      archived: boolean;
      disabled: boolean;
      created_at: string;
      updated_at: string;
      pushed_at: string;
    }>;
  }>("/installation/repositories?per_page=100", token);

  let added = 0;
  let updated = 0;

  for (const repo of data.repositories) {
    const { data: existing } = await supabase
      .from("repositories")
      .select("id")
      .eq("installation_id", installationIdUuid)
      .eq("github_repo_id", repo.id)
      .maybeSingle();

    const repoPayload = {
      workspace_id: workspaceId,
      installation_id: installationIdUuid,
      github_repo_id: repo.id,
      owner_login: repo.owner.login,
      name: repo.name,
      full_name: repo.full_name,
      description: repo.description,
      html_url: repo.html_url,
      visibility: repo.private ? "private" : "public",
      primary_language: repo.language,
      default_branch: repo.default_branch,
      is_archived: repo.archived,
      is_disabled: repo.disabled,
      is_accessible: true,
      github_created_at: repo.created_at,
      github_updated_at: repo.updated_at,
      github_pushed_at: repo.pushed_at,
      synced_at: new Date().toISOString(),
    };

    if (existing) {
      await supabase
        .from("repositories")
        .update(repoPayload)
        .eq("id", existing.id);
      updated++;
    } else {
      await supabase.from("repositories").insert(repoPayload);
      added++;
    }
  }

  // Update installation last_synced_at
  await supabase
    .from("github_installations")
    .update({
      last_synced_at: new Date().toISOString(),
      status: "active",
      last_sync_error: null,
    })
    .eq("id", installationIdUuid);

  return { added, updated };
}

/**
 * Synchronizes pull requests for a given repository.
 * Upserts using (repository_id, number) and respects canonical state mapping.
 */
export async function syncRepositoryPullRequests(
  supabase: SupabaseClient<Database>,
  repository: {
    id: string;
    workspace_id: string;
    installation_id: string;
    github_installation_id: number;
    owner_login: string;
    name: string;
  }
): Promise<{ syncedCount: number }> {
  const token = await getInstallationAccessToken(repository.github_installation_id);

  // Fetch all open and recently updated PRs
  const rawPrs = await githubFetchAllPages<any>(
    `/repos/${repository.owner_login}/${repository.name}/pulls?state=all&per_page=100&sort=updated&direction=desc`,
    token,
    500
  );

  let syncedCount = 0;

  for (const pr of rawPrs) {
    const canonicalState = mapPullRequestState({
      state: pr.state,
      merged_at: pr.merged_at,
    });

    const prPayload = {
      workspace_id: repository.workspace_id,
      repository_id: repository.id,
      github_pr_id: pr.id,
      number: pr.number,
      title: pr.title,
      body: pr.body || null,
      state: canonicalState,
      draft: !!pr.draft,
      author_login: pr.user?.login || null,
      author_avatar_url: pr.user?.avatar_url || null,
      head_ref: pr.head?.ref || null,
      head_sha: pr.head?.sha || null,
      base_ref: pr.base?.ref || null,
      base_sha: pr.base?.sha || null,
      html_url: pr.html_url,
      github_created_at: pr.created_at,
      github_updated_at: pr.updated_at,
      github_closed_at: pr.closed_at || null,
      merged_at: pr.merged_at || null,
      github_author_association: pr.author_association || null,
      requested_reviewers: pr.requested_reviewers || [],
      labels: pr.labels || [],
      synced_at: new Date().toISOString(),
    };

    const { data: existingPr } = await supabase
      .from("pull_requests")
      .select("id")
      .eq("repository_id", repository.id)
      .eq("number", pr.number)
      .maybeSingle();

    if (existingPr) {
      await supabase
        .from("pull_requests")
        .update(prPayload)
        .eq("id", existingPr.id);
    } else {
      await supabase.from("pull_requests").insert(prPayload);
    }

    syncedCount++;
  }

  return { syncedCount };
}

/**
 * Synchronizes detailed metadata for a single pull request:
 * - Changed files (patch hunks, binary file honesty)
 * - Commits
 * - Reviews
 * - Comments (segregating issue comments vs review diff comments)
 * - Checks (strictly matched against current head_sha)
 */
export async function syncPullRequestDetails(
  supabase: SupabaseClient<Database>,
  pr: {
    id: string;
    workspace_id: string;
    number: number;
    head_sha: string;
    repository_id: string;
    repo_owner: string;
    repo_name: string;
    github_installation_id: number;
  }
): Promise<void> {
  const token = await getInstallationAccessToken(pr.github_installation_id);
  const repoPath = `${pr.repo_owner}/${pr.repo_name}`;

  // 1. Files
  const rawFiles = await githubFetchAllPages<any>(
    `/repos/${repoPath}/pulls/${pr.number}/files?per_page=100`,
    token,
    3000
  );

  for (const file of rawFiles) {
    const patchAvailable = typeof file.patch === "string" && file.patch.length > 0;
    const filePayload = {
      workspace_id: pr.workspace_id,
      pull_request_id: pr.id,
      github_file_id: file.sha || null,
      file_path: file.filename,
      previous_file_path: file.previous_filename || null,
      change_status: file.status,
      additions: file.additions || 0,
      deletions: file.deletions || 0,
      changes: file.changes || 0,
      patch_text: patchAvailable ? file.patch : null,
      patch_available: patchAvailable,
      blob_url: file.blob_url || null,
      raw_url: file.raw_url || null,
      contents_url: file.contents_url || null,
      patch_cached_at: patchAvailable ? new Date().toISOString() : null,
      updated_at: new Date().toISOString(),
    };

    const { data: existingFile } = await supabase
      .from("pull_request_files")
      .select("id")
      .eq("pull_request_id", pr.id)
      .eq("file_path", file.filename)
      .maybeSingle();

    if (existingFile) {
      await supabase.from("pull_request_files").update(filePayload).eq("id", existingFile.id);
    } else {
      await supabase.from("pull_request_files").insert(filePayload);
    }
  }

  // 2. Commits
  const rawCommits = await githubFetchAllPages<any>(
    `/repos/${repoPath}/pulls/${pr.number}/commits?per_page=100`,
    token,
    250
  );

  for (const c of rawCommits) {
    const commitPayload = {
      workspace_id: pr.workspace_id,
      pull_request_id: pr.id,
      sha: c.sha,
      message: c.commit?.message || null,
      author_login: c.author?.login || c.commit?.author?.name || null,
      author_avatar_url: c.author?.avatar_url || null,
      committed_at: c.commit?.author?.date || null,
      html_url: c.html_url || null,
    };

    const { data: existingCommit } = await supabase
      .from("pull_request_commits")
      .select("id")
      .eq("pull_request_id", pr.id)
      .eq("sha", c.sha)
      .maybeSingle();

    if (!existingCommit) {
      await supabase.from("pull_request_commits").insert(commitPayload);
    }
  }

  // 3. Reviews (Store review summaries, state, and bodies)
  const rawReviews = await githubFetchAllPages<any>(
    `/repos/${repoPath}/pulls/${pr.number}/reviews?per_page=100`,
    token,
    100
  );

  for (const rev of rawReviews) {
    const reviewPayload = {
      workspace_id: pr.workspace_id,
      pull_request_id: pr.id,
      github_review_id: rev.id,
      reviewer_login: rev.user?.login || null,
      reviewer_avatar_url: rev.user?.avatar_url || null,
      state: mapReviewState(rev.state),
      body: rev.body || null,
      commit_id: rev.commit_id || null,
      submitted_at: rev.submitted_at || null,
      html_url: rev.html_url || null,
      updated_at: new Date().toISOString(),
    };

    const { data: existingReview } = await supabase
      .from("pull_request_reviews")
      .select("id")
      .eq("github_review_id", rev.id)
      .maybeSingle();

    if (existingReview) {
      await supabase.from("pull_request_reviews").update(reviewPayload).eq("id", existingReview.id);
    } else {
      await supabase.from("pull_request_reviews").insert(reviewPayload);
    }
  }

  // 4. Issue comments (General PR Conversation comments)
  const rawIssueComments = await githubFetchAllPages<any>(
    `/repos/${repoPath}/issues/${pr.number}/comments?per_page=100`,
    token,
    500
  );

  for (const comm of rawIssueComments) {
    const commentPayload = {
      workspace_id: pr.workspace_id,
      pull_request_id: pr.id,
      github_comment_id: comm.id,
      comment_type: "issue" as CommentType,
      author_login: comm.user?.login || null,
      author_avatar_url: comm.user?.avatar_url || null,
      body: comm.body || "",
      html_url: comm.html_url || null,
      created_at_github: comm.created_at || null,
      updated_at_github: comm.updated_at || null,
      updated_at: new Date().toISOString(),
    };

    const { data: existingComm } = await supabase
      .from("pull_request_comments")
      .select("id")
      .eq("github_comment_id", comm.id)
      .maybeSingle();

    if (existingComm) {
      await supabase.from("pull_request_comments").update(commentPayload).eq("id", existingComm.id);
    } else {
      await supabase.from("pull_request_comments").insert(commentPayload);
    }
  }

  // 5. Review comments (Diff line comments)
  const rawReviewComments = await githubFetchAllPages<any>(
    `/repos/${repoPath}/pulls/${pr.number}/comments?per_page=100`,
    token,
    500
  );

  for (const rcomm of rawReviewComments) {
    const reviewCommPayload = {
      workspace_id: pr.workspace_id,
      pull_request_id: pr.id,
      github_comment_id: rcomm.id,
      comment_type: "review" as CommentType,
      author_login: rcomm.user?.login || null,
      author_avatar_url: rcomm.user?.avatar_url || null,
      body: rcomm.body || "",
      path: rcomm.path || null,
      diff_hunk: rcomm.diff_hunk || null,
      commit_id: rcomm.commit_id || null,
      original_commit_id: rcomm.original_commit_id || null,
      line: rcomm.line || null,
      original_line: rcomm.original_line || null,
      start_line: rcomm.start_line || null,
      side: rcomm.side || null,
      start_side: rcomm.start_side || null,
      in_reply_to_id: rcomm.in_reply_to_id || null,
      html_url: rcomm.html_url || null,
      created_at_github: rcomm.created_at || null,
      updated_at_github: rcomm.updated_at || null,
      updated_at: new Date().toISOString(),
    };

    const { data: existingRComm } = await supabase
      .from("pull_request_comments")
      .select("id")
      .eq("github_comment_id", rcomm.id)
      .maybeSingle();

    if (existingRComm) {
      await supabase.from("pull_request_comments").update(reviewCommPayload).eq("id", existingRComm.id);
    } else {
      await supabase.from("pull_request_comments").insert(reviewCommPayload);
    }
  }

  // 6. Check runs (Filtered to PR's current head_sha per P1-09)
  const rawCheckRuns = await githubFetchAllPages<any>(
    `/repos/${repoPath}/commits/${pr.head_sha}/check-runs?per_page=100`,
    token,
    100
  );

  for (const cr of rawCheckRuns) {
    // Strict requirement P1-09: Old checks must not be presented as checks for new head
    if (cr.head_sha && cr.head_sha !== pr.head_sha) {
      continue;
    }

    const checkPayload = {
      workspace_id: pr.workspace_id,
      repository_id: pr.repository_id,
      pull_request_id: pr.id,
      github_check_id: cr.id,
      external_id: cr.external_id || null,
      name: cr.name,
      head_sha: pr.head_sha,
      status: cr.status || null,
      conclusion: cr.conclusion || null,
      details_url: cr.details_url || cr.html_url || null,
      started_at: cr.started_at || null,
      completed_at: cr.completed_at || null,
      output_title: cr.output?.title || null,
      output_summary: cr.output?.summary || null,
      source: "check_run",
      synced_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const { data: existingCheck } = await supabase
      .from("check_runs")
      .select("id")
      .eq("repository_id", pr.repository_id)
      .eq("github_check_id", cr.id)
      .maybeSingle();

    if (existingCheck) {
      await supabase.from("check_runs").update(checkPayload).eq("id", existingCheck.id);
    } else {
      await supabase.from("check_runs").insert(checkPayload);
    }
  }
}
