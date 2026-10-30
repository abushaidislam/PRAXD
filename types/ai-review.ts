import { z } from "zod";

export const FindingSeverityEnum = z.enum(["critical", "high", "medium", "low", "info"]);
export type FindingSeverity = z.infer<typeof FindingSeverityEnum>;

export const FindingKindEnum = z.enum([
  "bug",
  "security",
  "performance",
  "reliability",
  "maintainability",
  "test_gap",
  "style",
  "other",
]);
export type FindingKind = z.infer<typeof FindingKindEnum>;

export const OverallRiskEnum = z.enum(["low", "medium", "high", "critical"]);
export type OverallRisk = z.infer<typeof OverallRiskEnum>;

export const AIReviewStatusEnum = z.enum([
  "queued",
  "running",
  "completed",
  "failed",
  "cancelled",
  "stale",
]);
export type AIReviewStatus = z.infer<typeof AIReviewStatusEnum>;

export const FindingStatusEnum = z.enum([
  "open",
  "accepted",
  "dismissed",
  "fixed",
  "wont_fix",
  "stale",
]);
export type FindingStatus = z.infer<typeof FindingStatusEnum>;

// Zod Schema matching docs/AI_REVIEW_SPEC.md §6.2 exactly
export const EvidenceSchema = z
  .object({
    file_path: z.string().max(1024).nullable(),
    line_start: z.number().int().positive().nullable(),
    line_end: z.number().int().positive().nullable(),
    excerpt: z.string().max(3000).nullable(),
    source_sha: z.string().min(7).max(64),
  })
  .refine(
    (data) => {
      // If file_path is null, line_start and line_end must be null
      if (data.file_path === null) {
        return data.line_start === null && data.line_end === null;
      }
      // Both lines must be null or both positive with line_start <= line_end
      if (data.line_start === null && data.line_end === null) {
        return true;
      }
      if (data.line_start !== null && data.line_end !== null) {
        return data.line_start <= data.line_end;
      }
      return false;
    },
    {
      message:
        "Evidence line range must either be both null or both positive with line_start <= line_end",
    }
  );

export const RecommendedPatchSchema = z.object({
  format: z.literal("unified_diff"),
  file_path: z.string().min(1).max(1024),
  base_head_sha: z.string().min(7).max(64),
  content: z.string().min(1).max(20000),
  safety_note: z.string().min(1).max(1000),
});

export const FindingOutputSchema = z.object({
  severity: FindingSeverityEnum,
  kind: FindingKindEnum,
  title: z.string().min(1).max(180),
  description: z.string().min(1).max(5000),
  impact_summary: z.string().min(1).max(2000),
  confidence: z.number().min(0).max(1),
  evidence: EvidenceSchema,
  verification_steps: z.array(z.string().min(1).max(500)).min(1).max(12),
  recommendation: z.string().min(1).max(4000),
  recommended_patch: RecommendedPatchSchema.nullable(),
});

export const AIReviewResultSchema = z.object({
  schema_version: z.literal("1.0"),
  review_summary: z.string().min(1).max(5000),
  overall_risk: OverallRiskEnum,
  findings: z.array(FindingOutputSchema).max(100),
});

export type AIReviewResult = z.infer<typeof AIReviewResultSchema>;
export type FindingOutput = z.infer<typeof FindingOutputSchema>;
export type EvidenceOutput = z.infer<typeof EvidenceSchema>;
export type RecommendedPatch = z.infer<typeof RecommendedPatchSchema>;

export interface AIReviewRunSummary {
  id: string;
  workspaceId: string;
  pullRequestId: string;
  headSha: string;
  status: AIReviewStatus;
  provider: string;
  model: string;
  promptVersion: string;
  summary: string | null;
  overallRisk: OverallRisk | null;
  filesConsidered: number;
  findingsCount: number;
  startedAt: string | null;
  completedAt: string | null;
  errorCode: string | null;
  findings?: FindingRecord[];
}

export interface FindingRecord {
  id: string;
  reviewRunId: string;
  fingerprint: string;
  severity: FindingSeverity;
  kind: FindingKind;
  title: string;
  description: string;
  impact: string | null;
  recommendation: string | null;
  confidence: number;
  filePath: string | null;
  lineStart: number | null;
  lineEnd: number | null;
  evidenceExcerpt: string | null;
  verificationSteps: string[];
  recommendedPatch: RecommendedPatch | null;
  status: FindingStatus;
  isValidated: boolean;
  createdAt: string;
}
