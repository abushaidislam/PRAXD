export type PRState = "open" | "closed" | "merged";
export type ReviewDecision = "approved" | "changes_requested" | "review_required" | "pending";

export interface PRAuthor {
  login: string;
  avatarUrl: string;
  name?: string;
}

export interface CheckRun {
  id: string;
  name: string;
  status: "queued" | "in_progress" | "completed";
  conclusion?: "success" | "failure" | "neutral" | "cancelled" | "skipped" | "timed_out" | "action_required";
  startedAt?: string;
  completedAt?: string;
  detailsUrl?: string;
}

export interface PRComment {
  id: string;
  author: PRAuthor;
  body: string;
  createdAt: string;
  commentType: "issue" | "review";
  path?: string;
  line?: number;
  side?: "LEFT" | "RIGHT";
  resolved?: boolean;
}

export interface PRCommit {
  sha: string;
  shortSha: string;
  message: string;
  author: PRAuthor;
  committedDate: string;
}

export interface DiffLine {
  type: "context" | "addition" | "deletion" | "hunk-header";
  oldLineNumber?: number;
  newLineNumber?: number;
  content: string;
}

export interface ChangedFile {
  filename: string;
  status: "added" | "modified" | "deleted" | "renamed";
  additions: number;
  deletions: number;
  changes: number;
  patch?: string;
  lines?: DiffLine[];
  unmodifiedLinesBefore?: number;
  unmodifiedLinesAfter?: number;
}

export interface AIFinding {
  id: string;
  severity: "critical" | "warning" | "suggestion" | "info";
  title: string;
  filePath: string;
  line?: number;
  confidence: number;
  explanation: string;
  suggestedFix?: string;
}

export interface PullRequest {
  id: string;
  number: number;
  title: string;
  body: string;
  state: PRState;
  isDraft: boolean;
  author: PRAuthor;
  repoOwner: string;
  repoName: string;
  headRef: string;
  baseRef: string;
  headSha: string;
  baseSha: string;
  additions: number;
  deletions: number;
  changedFilesCount: number;
  createdAt: string;
  updatedAt: string;
  relativeTime: string;
  category: "authored" | "reviewing" | "all";
  reviewDecision?: ReviewDecision;
  reviewers: Array<{
    login: string;
    avatarUrl?: string;
    state?: "approved" | "changes_requested" | "pending";
  }>;
  checks: CheckRun[];
  checksStatus: "success" | "failure" | "pending";
  comments: PRComment[];
  commits: PRCommit[];
  files: ChangedFile[];
  aiFindings?: AIFinding[];
}
