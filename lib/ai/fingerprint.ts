import crypto from "crypto";
import { FindingKind } from "@/types/ai-review";

interface FingerprintParams {
  repositoryId: string;
  pullRequestNumber: number;
  kind: FindingKind;
  filePath: string | null;
  ruleKey: string;
  lineStart?: number | null;
}

/**
 * Normalizes a repository file path for stable fingerprint calculation across platforms.
 */
export function normalizeRepoPath(filePath: string | null | undefined): string {
  if (!filePath) return "__pr_wide__";
  return filePath.replace(/\\/g, "/").replace(/^\/+/, "").toLowerCase().trim();
}

/**
 * Generates a stable deterministic SHA-256 fingerprint for an AI review finding.
 * Preserves issue identity across commits and prevents duplicates within a review run.
 */
export function deriveFindingFingerprint(params: FingerprintParams): string {
  const normalized = {
    repo: params.repositoryId,
    pr: params.pullRequestNumber,
    kind: params.kind,
    file: normalizeRepoPath(params.filePath),
    rule: params.ruleKey.toLowerCase().trim(),
    line: params.lineStart || 0,
  };

  return crypto
    .createHash("sha256")
    .update(JSON.stringify(normalized))
    .digest("hex");
}
