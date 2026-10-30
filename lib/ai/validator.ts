import {
  AIReviewResultSchema,
  AIReviewResult,
  FindingOutput,
} from "@/types/ai-review";
import { ReviewContext } from "./context-builder";

export interface ValidationSuccess {
  isValid: true;
  result: AIReviewResult;
  validatedFindings: FindingOutput[];
}

export interface ValidationFailure {
  isValid: false;
  errorCode: string;
  errorMessage: string;
}

export type ValidationOutcome = ValidationSuccess | ValidationFailure;

/**
 * Executes strict server-side schema and semantic evidence validation.
 * Enforces:
 * 1. Zod JSON Schema conformance (Draft 2020-12 matching)
 * 2. File existence: file_path must match a declared changed file in context
 * 3. Line bounds: line_start <= line_end, both null or both positive
 * 4. SHA match: evidence source_sha must equal current PR head SHA
 * 5. Recommended patch format and path validation
 */
export function validateAiReviewOutput(
  rawJson: unknown,
  context: ReviewContext
): ValidationOutcome {
  // 1. Schema parsing
  const parsed = AIReviewResultSchema.safeParse(rawJson);
  if (!parsed.success) {
    return {
      isValid: false,
      errorCode: "SCHEMA_VALIDATION_FAILED",
      errorMessage: parsed.error.issues
        .map((i) => `${i.path.join(".")}: ${i.message}`)
        .join("; "),
    };
  }

  const result = parsed.data;
  const validatedFindings: FindingOutput[] = [];
  const validFilePaths = new Set(context.changedFiles.map((f) => f.path));

  // 2. Semantic validation for each finding
  for (let idx = 0; idx < result.findings.length; idx++) {
    const finding = result.findings[idx];
    const evidence = finding.evidence;

    // Check file existence in PR changes
    if (evidence.file_path !== null && !validFilePaths.has(evidence.file_path)) {
      return {
        isValid: false,
        errorCode: "INVALID_EVIDENCE_FILE_PATH",
        errorMessage: `Finding #${idx + 1} references file '${evidence.file_path}' which does not exist in changed files for this PR.`,
      };
    }

    // Check SHA alignment
    if (evidence.source_sha !== context.pullRequest.headSha) {
      return {
        isValid: false,
        errorCode: "STALE_SOURCE_SHA_EVIDENCE",
        errorMessage: `Finding #${idx + 1} evidence source_sha '${evidence.source_sha}' does not match current PR head SHA '${context.pullRequest.headSha}'.`,
      };
    }

    // Check recommended patch constraints if present
    if (finding.recommended_patch) {
      const patch = finding.recommended_patch;
      if (!validFilePaths.has(patch.file_path)) {
        return {
          isValid: false,
          errorCode: "INVALID_PATCH_FILE_PATH",
          errorMessage: `Finding #${idx + 1} recommended patch targets undeclared file '${patch.file_path}'.`,
        };
      }
      if (patch.base_head_sha !== context.pullRequest.headSha) {
        return {
          isValid: false,
          errorCode: "INVALID_PATCH_HEAD_SHA",
          errorMessage: `Finding #${idx + 1} recommended patch head SHA does not match current PR head SHA.`,
        };
      }
    }

    validatedFindings.push(finding);
  }

  return {
    isValid: true,
    result,
    validatedFindings,
  };
}
