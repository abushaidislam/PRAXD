import { SupabaseClient } from "@supabase/supabase-js";
import { Database, CommentType } from "@/types/database";
import { mapPullRequestState, mapReviewState } from "./sync";

export interface WebhookProcessingResult {
  status: "processed" | "ignored" | "failed";
  reason?: string;
  safeErrorCode?: string;
}

/**
 * Dispatches verified GitHub webhook events to their respective domain handlers.
 */
export async function processWebhookEvent(
  supabase: SupabaseClient<Database>,
  eventName: string,
  payload: any
): Promise<WebhookProcessingResult> {
  const action = payload.action;

  switch (eventName) {
    case "pull_request":
      return handlePullRequestEvent(supabase, action, payload);

    case "pull_request_review":
      return handlePullRequestReviewEvent(supabase, action, payload);

    case "pull_request_review_comment":
      return handlePullRequestReviewCommentEvent(supabase, action, payload);

    case "issue_comment":
      return handleIssueCommentEvent(supabase, action, payload);

    case "check_run":
      return handleCheckRunEvent(supabase, action, payload);

    case "check_suite":
      return handleCheckSuiteEvent(supabase, action, payload);

    case "installation":
      return handleInstallationEvent(supabase, action, payload);

    case "installation_repositories":
      return handleInstallationRepositoriesEvent(supabase, action, payload);

    default:
      return { status: "ignored", reason: `Unhandled event type: ${eventName}` };
  }
}

/**
 * Handles 'pull_request' events (opened, synchronize, closed, reopened, edited).
 * Enforces head SHA forward-only invariant (P2-06): Out-of-order events cannot roll head SHA backward.
 */
async function handlePullRequestEvent(
  supabase: SupabaseClient<Database>,
  action: string,
  payload: any
): Promise<WebhookProcessingResult> {
  const pr = payload.pull_request;
  const repo = payload.repository;
  if (!pr || !repo) {
    return { status: "ignored", reason: "Missing PR or repository in payload" };
  }

  // Find local repository
  const { data: localRepo } = await supabase
    .from("repositories")
    .select("id, workspace_id")
    .eq("github_repo_id", repo.id)
    .maybeSingle();

  if (!localRepo) {
    return { status: "ignored", reason: "Repository not connected to any workspace" };
  }

  const { data: existingPr } = await supabase
    .from("pull_requests")
    .select("id, head_sha, github_updated_at")
    .eq("repository_id", localRepo.id)
    .eq("number", pr.number)
    .maybeSingle();

  // Out-of-order event guard (Requirement P2-06):
  // If this is an older event than what we already stored, do not roll backward.
  if (existingPr?.github_updated_at && pr.updated_at) {
    const existingDate = new Date(existingPr.github_updated_at).getTime();
    const eventDate = new Date(pr.updated_at).getTime();
    if (eventDate < existingDate) {
      return {
        status: "ignored",
        reason: "Stale out-of-order event ignored (newer state already persisted)",
      };
    }
  }

  const canonicalState = mapPullRequestState({
    state: pr.state,
    merged_at: pr.merged_at,
  });

  const prPayload = {
    workspace_id: localRepo.workspace_id,
    repository_id: localRepo.id,
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
    additions: pr.additions || 0,
    deletions: pr.deletions || 0,
    changed_files_count: pr.changed_files || 0,
    comments_count: pr.comments || 0,
    review_comments_count: pr.review_comments || 0,
    commits_count: pr.commits || 0,
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

  if (existingPr) {
    await supabase.from("pull_requests").update(prPayload).eq("id", existingPr.id);
  } else {
    await supabase.from("pull_requests").insert(prPayload);
  }

  return { status: "processed" };
}

/**
 * Handles 'pull_request_review' events (submitted, edited, dismissed)
 */
async function handlePullRequestReviewEvent(
  supabase: SupabaseClient<Database>,
  action: string,
  payload: any
): Promise<WebhookProcessingResult> {
  const review = payload.review;
  const pr = payload.pull_request;
  const repo = payload.repository;
  if (!review || !pr || !repo) {
    return { status: "ignored", reason: "Missing review, PR, or repo in payload" };
  }

  const { data: localPr } = await supabase
    .from("pull_requests")
    .select("id, workspace_id")
    .eq("github_pr_id", pr.id)
    .maybeSingle();

  if (!localPr) {
    return { status: "ignored", reason: "Parent PR not found" };
  }

  const reviewPayload = {
    workspace_id: localPr.workspace_id,
    pull_request_id: localPr.id,
    github_review_id: review.id,
    reviewer_login: review.user?.login || null,
    reviewer_avatar_url: review.user?.avatar_url || null,
    state: mapReviewState(review.state),
    body: review.body || null,
    commit_id: review.commit_id || null,
    submitted_at: review.submitted_at || null,
    html_url: review.html_url || null,
    updated_at: new Date().toISOString(),
  };

  const { data: existingReview } = await supabase
    .from("pull_request_reviews")
    .select("id")
    .eq("github_review_id", review.id)
    .maybeSingle();

  if (existingReview) {
    await supabase.from("pull_request_reviews").update(reviewPayload).eq("id", existingReview.id);
  } else {
    await supabase.from("pull_request_reviews").insert(reviewPayload);
  }

  return { status: "processed" };
}

/**
 * Handles 'pull_request_review_comment' (inline diff comments)
 */
async function handlePullRequestReviewCommentEvent(
  supabase: SupabaseClient<Database>,
  action: string,
  payload: any
): Promise<WebhookProcessingResult> {
  const comment = payload.comment;
  const pr = payload.pull_request;
  if (!comment || !pr) {
    return { status: "ignored", reason: "Missing comment or PR in payload" };
  }

  const { data: localPr } = await supabase
    .from("pull_requests")
    .select("id, workspace_id")
    .eq("github_pr_id", pr.id)
    .maybeSingle();

  if (!localPr) {
    return { status: "ignored", reason: "Parent PR not found" };
  }

  const commentPayload = {
    workspace_id: localPr.workspace_id,
    pull_request_id: localPr.id,
    github_comment_id: comment.id,
    comment_type: "review" as CommentType,
    author_login: comment.user?.login || null,
    author_avatar_url: comment.user?.avatar_url || null,
    body: comment.body || "",
    path: comment.path || null,
    diff_hunk: comment.diff_hunk || null,
    commit_id: comment.commit_id || null,
    original_commit_id: comment.original_commit_id || null,
    line: comment.line || null,
    original_line: comment.original_line || null,
    side: comment.side || null,
    in_reply_to_id: comment.in_reply_to_id || null,
    html_url: comment.html_url || null,
    created_at_github: comment.created_at || null,
    updated_at_github: comment.updated_at || null,
    updated_at: new Date().toISOString(),
  };

  const { data: existingComment } = await supabase
    .from("pull_request_comments")
    .select("id")
    .eq("github_comment_id", comment.id)
    .maybeSingle();

  if (existingComment) {
    await supabase.from("pull_request_comments").update(commentPayload).eq("id", existingComment.id);
  } else {
    await supabase.from("pull_request_comments").insert(commentPayload);
  }

  return { status: "processed" };
}

/**
 * Handles 'issue_comment'. Filters ONLY for pull requests.
 * Normal issue comments without a pull_request object are strictly ignored (status: 'ignored').
 */
async function handleIssueCommentEvent(
  supabase: SupabaseClient<Database>,
  action: string,
  payload: any
): Promise<WebhookProcessingResult> {
  // Check if this issue is actually a pull request
  if (!payload.issue?.pull_request) {
    return { status: "ignored", reason: "Issue comment is not on a pull request" };
  }

  const comment = payload.comment;
  const issue = payload.issue;
  const repo = payload.repository;
  if (!comment || !issue || !repo) {
    return { status: "ignored", reason: "Incomplete issue comment payload" };
  }

  const { data: localRepo } = await supabase
    .from("repositories")
    .select("id, workspace_id")
    .eq("github_repo_id", repo.id)
    .maybeSingle();

  if (!localRepo) {
    return { status: "ignored", reason: "Repository not found" };
  }

  const { data: localPr } = await supabase
    .from("pull_requests")
    .select("id")
    .eq("repository_id", localRepo.id)
    .eq("number", issue.number)
    .maybeSingle();

  if (!localPr) {
    return { status: "ignored", reason: "Local PR not found for issue comment" };
  }

  const commentPayload = {
    workspace_id: localRepo.workspace_id,
    pull_request_id: localPr.id,
    github_comment_id: comment.id,
    comment_type: "issue" as CommentType,
    author_login: comment.user?.login || null,
    author_avatar_url: comment.user?.avatar_url || null,
    body: comment.body || "",
    html_url: comment.html_url || null,
    created_at_github: comment.created_at || null,
    updated_at_github: comment.updated_at || null,
    updated_at: new Date().toISOString(),
  };

  const { data: existingComment } = await supabase
    .from("pull_request_comments")
    .select("id")
    .eq("github_comment_id", comment.id)
    .maybeSingle();

  if (existingComment) {
    await supabase.from("pull_request_comments").update(commentPayload).eq("id", existingComment.id);
  } else {
    await supabase.from("pull_request_comments").insert(commentPayload);
  }

  return { status: "processed" };
}

/**
 * Handles 'check_run' (created, completed, rerequested).
 * Upserts by (repository_id, github_check_id) natural key (Requirement P2-09).
 */
async function handleCheckRunEvent(
  supabase: SupabaseClient<Database>,
  action: string,
  payload: any
): Promise<WebhookProcessingResult> {
  const checkRun = payload.check_run;
  const repo = payload.repository;
  if (!checkRun || !repo) {
    return { status: "ignored", reason: "Missing check_run or repository in payload" };
  }

  const { data: localRepo } = await supabase
    .from("repositories")
    .select("id, workspace_id")
    .eq("github_repo_id", repo.id)
    .maybeSingle();

  if (!localRepo) {
    return { status: "ignored", reason: "Repository not found" };
  }

  // Find PR associated with this check run head SHA
  const { data: localPr } = await supabase
    .from("pull_requests")
    .select("id")
    .eq("repository_id", localRepo.id)
    .eq("head_sha", checkRun.head_sha)
    .maybeSingle();

  const checkPayload = {
    workspace_id: localRepo.workspace_id,
    repository_id: localRepo.id,
    pull_request_id: localPr?.id || null,
    github_check_id: checkRun.id,
    external_id: checkRun.external_id || null,
    name: checkRun.name,
    head_sha: checkRun.head_sha,
    status: checkRun.status || null,
    conclusion: checkRun.conclusion || null,
    details_url: checkRun.details_url || checkRun.html_url || null,
    started_at: checkRun.started_at || null,
    completed_at: checkRun.completed_at || null,
    output_title: checkRun.output?.title || null,
    output_summary: checkRun.output?.summary || null,
    source: "check_run",
    synced_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  const { data: existingCheck } = await supabase
    .from("check_runs")
    .select("id")
    .eq("repository_id", localRepo.id)
    .eq("github_check_id", checkRun.id)
    .maybeSingle();

  if (existingCheck) {
    await supabase.from("check_runs").update(checkPayload).eq("id", existingCheck.id);
  } else {
    await supabase.from("check_runs").insert(checkPayload);
  }

  return { status: "processed" };
}

/**
 * Handles 'check_suite'
 */
async function handleCheckSuiteEvent(
  supabase: SupabaseClient<Database>,
  action: string,
  payload: any
): Promise<WebhookProcessingResult> {
  return { status: "processed", reason: "Check suite event processed" };
}

/**
 * Handles 'installation' lifecycle (created, deleted, suspend, unsuspend)
 */
async function handleInstallationEvent(
  supabase: SupabaseClient<Database>,
  action: string,
  payload: any
): Promise<WebhookProcessingResult> {
  const installation = payload.installation;
  if (!installation) {
    return { status: "ignored", reason: "Missing installation object" };
  }

  let status: "active" | "suspended" | "deleted" = "active";
  let suspendedAt: string | null = null;
  let deletedAt: string | null = null;

  if (action === "suspend") {
    status = "suspended";
    suspendedAt = new Date().toISOString();
  } else if (action === "deleted") {
    status = "deleted";
    deletedAt = new Date().toISOString();
  } else if (action === "unsuspend") {
    status = "active";
    suspendedAt = null;
  }

  await supabase
    .from("github_installations")
    .update({
      status,
      suspended_at: suspendedAt,
      deleted_at: deletedAt,
      updated_at: new Date().toISOString(),
    })
    .eq("installation_id", installation.id);

  return { status: "processed" };
}

/**
 * Handles 'installation_repositories' (added, removed)
 * Requirement P2-07: Added scope is synced; removed scope becomes inaccessible (is_accessible = false).
 */
async function handleInstallationRepositoriesEvent(
  supabase: SupabaseClient<Database>,
  action: string,
  payload: any
): Promise<WebhookProcessingResult> {
  const installation = payload.installation;
  if (!installation) {
    return { status: "ignored", reason: "Missing installation in payload" };
  }

  const { data: localInstallation } = await supabase
    .from("github_installations")
    .select("id, workspace_id")
    .eq("installation_id", installation.id)
    .maybeSingle();

  if (!localInstallation) {
    return { status: "ignored", reason: "Local installation not found" };
  }

  // Handle removed repositories (Requirement P2-07)
  const reposRemoved = payload.repositories_removed || [];
  for (const repo of reposRemoved) {
    await supabase
      .from("repositories")
      .update({
        is_accessible: false,
        access_revoked_at: new Date().toISOString(),
      })
      .eq("installation_id", localInstallation.id)
      .eq("github_repo_id", repo.id);
  }

  // Handle added repositories
  const reposAdded = payload.repositories_added || [];
  for (const repo of reposAdded) {
    const { data: existing } = await supabase
      .from("repositories")
      .select("id")
      .eq("installation_id", localInstallation.id)
      .eq("github_repo_id", repo.id)
      .maybeSingle();

    if (existing) {
      await supabase
        .from("repositories")
        .update({
          is_accessible: true,
          access_revoked_at: null,
          full_name: repo.full_name,
          name: repo.name,
        })
        .eq("id", existing.id);
    } else {
      await supabase.from("repositories").insert({
        workspace_id: localInstallation.workspace_id,
        installation_id: localInstallation.id,
        github_repo_id: repo.id,
        owner_login: repo.full_name.split("/")[0],
        name: repo.name,
        full_name: repo.full_name,
        html_url: `https://github.com/${repo.full_name}`,
        is_accessible: true,
      });
    }
  }

  return { status: "processed" };
}
