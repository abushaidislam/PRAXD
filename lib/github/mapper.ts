import { PullRequest } from "@/types/pr";

/**
 * Maps a raw database pull request row or partial PR object into a
 * strictly typed and null-safe PullRequest domain entity.
 */
export function mapDbPrToDomain(pr: any): PullRequest {
  const diffMs = Date.now() - new Date(pr.github_updated_at || pr.updated_at || Date.now()).getTime();
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const relativeTime = diffHours < 24 ? `${Math.max(1, diffHours)}h` : `${Math.floor(diffHours / 24)}d`;

  const repo = pr.repositories || {};
  const authorLogin = pr.author_login || pr.author?.login || repo.owner_login || "unknown";
  const avatarUrl =
    pr.author_avatar_url ||
    pr.author?.avatarUrl ||
    (authorLogin !== "unknown" ? `https://github.com/${authorLogin}.png` : "https://github.com/ghost.png");

  const checks = Array.isArray(pr.checks) ? pr.checks : [];
  let checksStatus: "success" | "failure" | "pending" | undefined = pr.checksStatus || pr.checks_status;
  if (!checksStatus && checks.length > 0) {
    const hasFailure = checks.some(
      (c: any) => c.conclusion === "failure" || c.conclusion === "timed_out" || c.conclusion === "cancelled"
    );
    const hasPending = checks.some((c: any) => c.status === "in_progress" || c.status === "queued");
    checksStatus = hasFailure ? "failure" : hasPending ? "pending" : "success";
  }

  return {
    id: pr.id,
    number: pr.number,
    title: pr.title || `PR #${pr.number}`,
    body: pr.body || "",
    state: pr.state || "open",
    isDraft: Boolean(pr.draft || pr.is_draft),
    author: {
      login: authorLogin,
      avatarUrl: avatarUrl,
      name: authorLogin,
    },
    repoOwner: repo.owner_login || pr.repoOwner || "repo",
    repoName: repo.name || pr.repoName || "repo",
    headRef: pr.head_ref || pr.headRef || "head",
    baseRef: pr.base_ref || pr.baseRef || "main",
    headSha: pr.head_sha || pr.headSha || "head",
    baseSha: pr.base_sha || pr.baseSha || "base",
    additions: pr.additions || 0,
    deletions: pr.deletions || 0,
    changedFilesCount: pr.changed_files_count ?? (Array.isArray(pr.files) ? pr.files.length : 1),
    createdAt: pr.github_created_at || pr.created_at || new Date().toISOString(),
    updatedAt: pr.github_updated_at || pr.updated_at || new Date().toISOString(),
    relativeTime,
    category: authorLogin === "abushaidislam" ? "authored" : "all",
    reviewDecision: pr.state === "open" ? "review_required" : undefined,
    reviewers: Array.isArray(pr.requested_reviewers)
      ? pr.requested_reviewers.map((r: any) => ({
          login: typeof r === "string" ? r : r.login,
          avatarUrl: r.avatar_url || (typeof r === "string" ? `https://github.com/${r}.png` : undefined),
        }))
      : [],
    checksStatus: checksStatus || "success",
    checks,
    commentsCount:
      (pr.comments_count || 0) + (pr.review_comments_count || 0) ||
      (Array.isArray(pr.comments) ? pr.comments.length : 0),
    comments: Array.isArray(pr.comments) ? pr.comments : [],
    commits: Array.isArray(pr.commits) ? pr.commits : [],
    files: Array.isArray(pr.files) ? pr.files : [],
  };
}
