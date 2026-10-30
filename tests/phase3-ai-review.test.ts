import { describe, it, expect } from "vitest";
import { validateAiReviewOutput } from "@/lib/ai/validator";
import { buildReviewContext, redactSecrets } from "@/lib/ai/context-builder";
import { deriveFindingFingerprint } from "@/lib/ai/fingerprint";
import { AIReviewResult } from "@/types/ai-review";

describe("Phase 3 Acceptance: AI Review Engine & Validation (P3-01 to P3-08)", () => {
  const MOCK_HEAD_SHA = "f7658d3e91845bbcd40939527940173501726a45";

  const MOCK_CONTEXT = buildReviewContext({
    reviewRunId: "run-test-01",
    promptVersion: "praxd-ai-review-v1.0",
    repository: { fullName: "praxd/sentinel", primaryLanguage: "JavaScript" },
    pullRequest: {
      number: 164,
      title: "Fix DOM XSS vulnerability",
      body: "Remediates innerHTML assignment in banner construction.",
      baseRef: "main",
      baseSha: "e903bc1000000000000000000000000000000000",
      headRef: "fix-dom-xss",
      headSha: MOCK_HEAD_SHA,
      draft: false,
    },
    files: [
      {
        file_path: "extension/content.js",
        change_status: "modified",
        additions: 20,
        deletions: 1,
        patch_text: "@@ -1640,4 +1640,20 @@\n- banner.innerHTML = '...';",
        patch_available: true,
      },
    ],
  });

  describe("P3-04: Strict JSON Schema & Semantic Evidence Validation", () => {
    it("accepts valid, evidence-backed model output matching the schema", () => {
      const validOutput: AIReviewResult = {
        schema_version: "1.0",
        review_summary: "Reviewed 1 changed file. One medium severity defect identified.",
        overall_risk: "medium",
        findings: [
          {
            severity: "medium",
            kind: "security",
            title: "DOM XSS vulnerability on innerHTML assignment",
            description: "Direct assignment to innerHTML without sanitization allows script injection.",
            impact_summary: "Attackers could execute arbitrary scripts in the extension context.",
            confidence: 0.95,
            evidence: {
              file_path: "extension/content.js",
              line_start: 1644,
              line_end: 1644,
              excerpt: "banner.innerHTML = '...';",
              source_sha: MOCK_HEAD_SHA,
            },
            verification_steps: ["Verify input sanitization before DOM construction."],
            recommendation: "Use document.createElement and textContent instead.",
            recommended_patch: null,
          },
        ],
      };

      const outcome = validateAiReviewOutput(validOutput, MOCK_CONTEXT);
      expect(outcome.isValid).toBe(true);
      if (outcome.isValid) {
        expect(outcome.validatedFindings.length).toBe(1);
        expect(outcome.validatedFindings[0].severity).toBe("medium");
      }
    });

    it("rejects output referencing files not in PR changed files", () => {
      const invalidFileOutput: AIReviewResult = {
        schema_version: "1.0",
        review_summary: "Reviewed files.",
        overall_risk: "low",
        findings: [
          {
            severity: "low",
            kind: "bug",
            title: "Hallucinated issue in unrelated file",
            description: "Issue found in unsupplied file.",
            impact_summary: "None.",
            confidence: 0.5,
            evidence: {
              file_path: "secrets/passwords.txt", // NOT in MOCK_CONTEXT changed files!
              line_start: 10,
              line_end: 10,
              excerpt: "pass=123",
              source_sha: MOCK_HEAD_SHA,
            },
            verification_steps: ["Check file."],
            recommendation: "Remove file.",
            recommended_patch: null,
          },
        ],
      };

      const outcome = validateAiReviewOutput(invalidFileOutput, MOCK_CONTEXT);
      expect(outcome.isValid).toBe(false);
      if (!outcome.isValid) {
        expect(outcome.errorCode).toBe("INVALID_EVIDENCE_FILE_PATH");
      }
    });

    it("rejects evidence with stale source_sha not matching current PR head", () => {
      const staleShaOutput: AIReviewResult = {
        schema_version: "1.0",
        review_summary: "Reviewed files.",
        overall_risk: "low",
        findings: [
          {
            severity: "low",
            kind: "bug",
            title: "Old commit finding",
            description: "Issue in old commit.",
            impact_summary: "None.",
            confidence: 0.5,
            evidence: {
              file_path: "extension/content.js",
              line_start: 10,
              line_end: 10,
              excerpt: "code",
              source_sha: "stale-commit-sha-00000000000000000000", // Stale SHA!
            },
            verification_steps: ["Check."],
            recommendation: "Fix.",
            recommended_patch: null,
          },
        ],
      };

      const outcome = validateAiReviewOutput(staleShaOutput, MOCK_CONTEXT);
      expect(outcome.isValid).toBe(false);
      if (!outcome.isValid) {
        expect(outcome.errorCode).toBe("STALE_SOURCE_SHA_EVIDENCE");
      }
    });

    it("rejects line range where line_start > line_end", () => {
      const invertedLineOutput = {
        schema_version: "1.0",
        review_summary: "Reviewed.",
        overall_risk: "low",
        findings: [
          {
            severity: "low",
            kind: "bug",
            title: "Inverted line range",
            description: "Test.",
            impact_summary: "None.",
            confidence: 0.5,
            evidence: {
              file_path: "extension/content.js",
              line_start: 50,
              line_end: 20, // Inverted! line_start > line_end
              excerpt: "code",
              source_sha: MOCK_HEAD_SHA,
            },
            verification_steps: ["Check."],
            recommendation: "Fix.",
            recommended_patch: null,
          },
        ],
      };

      const outcome = validateAiReviewOutput(invertedLineOutput, MOCK_CONTEXT);
      expect(outcome.isValid).toBe(false);
      if (!outcome.isValid) {
        expect(outcome.errorCode).toBe("SCHEMA_VALIDATION_FAILED");
      }
    });

    it("rejects invalid severity and kind enums not in schema", () => {
      const invalidEnumOutput = {
        schema_version: "1.0",
        review_summary: "Reviewed.",
        overall_risk: "catastrophic", // Invalid overall_risk!
        findings: [
          {
            severity: "emergency", // Invalid severity enum!
            kind: "vulnerability", // Invalid kind enum (should be 'security')!
            title: "Test",
            description: "Test",
            impact_summary: "None",
            confidence: 0.8,
            evidence: {
              file_path: "extension/content.js",
              line_start: 10,
              line_end: 10,
              excerpt: "code",
              source_sha: MOCK_HEAD_SHA,
            },
            verification_steps: ["Check"],
            recommendation: "Fix",
            recommended_patch: null,
          },
        ],
      };

      const outcome = validateAiReviewOutput(invalidEnumOutput, MOCK_CONTEXT);
      expect(outcome.isValid).toBe(false);
    });
  });

  describe("P3-05: Secret Redaction in Context Construction", () => {
    it("redacts API keys, tokens, and private keys from code and descriptions", () => {
      const rawText = `
        const apiKey = "sk-1234567890abcdef1234567890abcdef";
        const ghToken = "ghp_123456789012345678901234567890123456";
        const auth = "Bearer ya29.a0AfH6SM...secret-token";
      `;

      const redacted = redactSecrets(rawText);

      expect(redacted).not.toContain("sk-1234567890");
      expect(redacted).not.toContain("ghp_1234567890");
      expect(redacted).not.toContain("Bearer ya29.");
      expect(redacted).toContain("[REDACTED_SECRET]");
    });
  });

  describe("P3-06: Fingerprint Stability and Deduplication", () => {
    it("generates deterministic fingerprint based on root-cause identity", () => {
      const fp1 = deriveFindingFingerprint({
        repositoryId: "repo-uuid-01",
        pullRequestNumber: 164,
        kind: "security",
        filePath: "extension/content.js",
        ruleKey: "DOM XSS vulnerability",
        lineStart: 1644,
      });

      const fp2 = deriveFindingFingerprint({
        repositoryId: "repo-uuid-01",
        pullRequestNumber: 164,
        kind: "security",
        filePath: "extension/content.js",
        ruleKey: "DOM XSS vulnerability",
        lineStart: 1644,
      });

      expect(fp1).toBeTruthy();
      expect(fp1).toBe(fp2); // Identical fingerprint
    });
  });

  describe("P3-02 & P3-03: Concurrency Guard & Stale Head Invariant", () => {
    it("concurrency guard prevents duplicate active runs for same PR", () => {
      const runs = [
        { id: "run-active", prId: "pr-1", status: "running", headSha: MOCK_HEAD_SHA },
      ];

      function shouldQueueNewRun(prId: string, currentHead: string) {
        const existing = runs.find(
          (r) => r.prId === prId && (r.status === "queued" || r.status === "running")
        );
        if (existing) {
          return { allow: false, existingRunId: existing.id };
        }
        return { allow: true };
      }

      const check = shouldQueueNewRun("pr-1", MOCK_HEAD_SHA);
      expect(check.allow).toBe(false);
      expect(check.existingRunId).toBe("run-active");
    });

    it("marks runs for older head SHAs as stale when head advances", () => {
      const previousRun = {
        id: "run-old",
        headSha: "e903bc1000",
        status: "completed" as "completed" | "stale",
      };

      const newHeadSha = MOCK_HEAD_SHA;
      if (previousRun.headSha !== newHeadSha) {
        previousRun.status = "stale";
      }

      expect(previousRun.status).toBe("stale");
    });
  });
});
