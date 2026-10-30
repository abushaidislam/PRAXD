export interface ChangedFileContext {
  path: string;
  previousPath: string | null;
  status: string;
  additions: number;
  deletions: number;
  patch: string | null;
  excludedReason?: string;
}

export interface ReviewContext {
  reviewRunId: string;
  promptVersion: string;
  repository: {
    fullName: string;
    primaryLanguage: string | null;
  };
  pullRequest: {
    number: number;
    title: string;
    body: string | null;
    baseRef: string;
    baseSha: string;
    headRef: string;
    headSha: string;
    draft: boolean;
  };
  changedFiles: ChangedFileContext[];
  filesConsidered: number;
  omittedFilesCount: number;
  coverageNote: string;
}

const SECRET_PATTERNS = [
  /Bearer\s+[a-zA-Z0-9._~+/-]+=*/gi,
  /ghp_[a-zA-Z0-9]{36}/g,
  /gho_[a-zA-Z0-9]{36}/g,
  /glpat-[a-zA-Z0-9_-]{20}/g,
  /sk-[a-zA-Z0-9]{20,}/g,
  /-----BEGIN (?:RSA |EC )?PRIVATE KEY-----[\s\S]*?-----END (?:RSA |EC )?PRIVATE KEY-----/g,
  /(?:password|passwd|secret|api_key|apikey|access_token)\s*[:=]\s*['"][^'"]{8,}['"]/gi,
];

/**
 * Redacts potential secrets, credentials, and API keys from code and metadata before model transmission.
 */
export function redactSecrets(content: string | null | undefined): string {
  if (!content) return "";
  let sanitized = content;
  for (const pattern of SECRET_PATTERNS) {
    sanitized = sanitized.replace(pattern, "[REDACTED_SECRET]");
  }
  return sanitized;
}

/**
 * Builds bounded, secret-redacted, prompt-safe review context for an AI review run.
 */
export function buildReviewContext(params: {
  reviewRunId: string;
  promptVersion: string;
  repository: { fullName: string; primaryLanguage: string | null };
  pullRequest: {
    number: number;
    title: string;
    body: string | null;
    baseRef: string;
    baseSha: string;
    headRef: string;
    headSha: string;
    draft: boolean;
  };
  files: Array<{
    file_path: string;
    previous_file_path?: string | null;
    change_status: string;
    additions: number | null;
    deletions: number | null;
    patch_text: string | null;
    patch_available: boolean;
  }>;
  maxFiles?: number;
  maxPatchBytes?: number;
}): ReviewContext {
  const maxFiles = params.maxFiles || parseInt(process.env.AI_REVIEW_MAX_FILES || "40", 10);
  const maxPatchBytes = params.maxPatchBytes || parseInt(process.env.AI_REVIEW_MAX_PATCH_BYTES || "500000", 10);

  const changedFiles: ChangedFileContext[] = [];
  let filesConsidered = 0;
  let omittedFilesCount = 0;
  let currentPatchBytes = 0;

  for (const file of params.files) {
    // Check if we hit file count limit
    if (filesConsidered >= maxFiles) {
      omittedFilesCount++;
      changedFiles.push({
        path: file.file_path,
        previousPath: file.previous_file_path || null,
        status: file.change_status,
        additions: file.additions || 0,
        deletions: file.deletions || 0,
        patch: null,
        excludedReason: "EXCEEDED_MAX_FILES_BUDGET",
      });
      continue;
    }

    // Binary / no patch
    if (!file.patch_available || !file.patch_text) {
      changedFiles.push({
        path: file.file_path,
        previousPath: file.previous_file_path || null,
        status: file.change_status,
        additions: file.additions || 0,
        deletions: file.deletions || 0,
        patch: null,
        excludedReason: "DIFF_UNAVAILABLE_OR_BINARY",
      });
      filesConsidered++;
      continue;
    }

    // Check patch byte size
    const patchSize = Buffer.byteLength(file.patch_text, "utf8");
    if (currentPatchBytes + patchSize > maxPatchBytes) {
      omittedFilesCount++;
      changedFiles.push({
        path: file.file_path,
        previousPath: file.previous_file_path || null,
        status: file.change_status,
        additions: file.additions || 0,
        deletions: file.deletions || 0,
        patch: null,
        excludedReason: "EXCEEDED_PATCH_BYTE_BUDGET",
      });
      continue;
    }

    // Safe sanitized patch
    const sanitizedPatch = redactSecrets(file.patch_text);
    changedFiles.push({
      path: file.file_path,
      previousPath: file.previous_file_path || null,
      status: file.change_status,
      additions: file.additions || 0,
      deletions: file.deletions || 0,
      patch: sanitizedPatch,
    });

    filesConsidered++;
    currentPatchBytes += patchSize;
  }

  const coverageNote =
    omittedFilesCount > 0
      ? `Reviewed ${filesConsidered} of ${params.files.length} changed files (${omittedFilesCount} files omitted due to token/byte budget).`
      : `Reviewed all ${filesConsidered} changed files against head SHA ${params.pullRequest.headSha.slice(0, 7)}.`;

  return {
    reviewRunId: params.reviewRunId,
    promptVersion: params.promptVersion,
    repository: {
      fullName: params.repository.fullName,
      primaryLanguage: params.repository.primaryLanguage,
    },
    pullRequest: {
      number: params.pullRequest.number,
      title: redactSecrets(params.pullRequest.title),
      body: redactSecrets(params.pullRequest.body),
      baseRef: params.pullRequest.baseRef,
      baseSha: params.pullRequest.baseSha,
      headRef: params.pullRequest.headRef,
      headSha: params.pullRequest.headSha,
      draft: params.pullRequest.draft,
    },
    changedFiles,
    filesConsidered,
    omittedFilesCount,
    coverageNote,
  };
}
