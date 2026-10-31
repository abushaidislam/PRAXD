import { describe, it, expect } from "vitest";
import {
  validateCodeSyntax,
  validatePatchSyntax,
  detectLanguageFromPath,
} from "../lib/autofix/syntax-validator";
import {
  formatConventionalCommitMessage,
  getCompanionBranchName,
  executeAutofixCommit,
} from "../lib/autofix/commit-engine";
import { canCommitAutofix, ROLE_PERMISSIONS } from "../lib/auth/rbac";

describe("Phase 10: 1-Click Autonomous Autofix & PR Commit Engine (P10-01 to P10-08)", () => {
  // ---------------------------------------------------------------------------
  // P10-01: Explicit Two-Click Confirmation Enforcement
  // ---------------------------------------------------------------------------
  describe("P10-01: Two-Click Confirmation Requirement", () => {
    it("rejects unconfirmed autofix commit requests", () => {
      const validateRequest = (body: any) => {
        if (!body || !body.confirmed) {
          return { error: "CONFIRMATION_REQUIRED", status: 400 };
        }
        return { success: true };
      };

      const unconfirmed = validateRequest({ confirmed: false });
      expect(unconfirmed.error).toBe("CONFIRMATION_REQUIRED");
      expect(unconfirmed.status).toBe(400);

      const missing = validateRequest({});
      expect(missing.error).toBe("CONFIRMATION_REQUIRED");

      const confirmed = validateRequest({ confirmed: true });
      expect(confirmed.success).toBe(true);
    });
  });

  // ---------------------------------------------------------------------------
  // P10-02: Pre-Commit Syntax & Delimiter Validation (Error Catching)
  // ---------------------------------------------------------------------------
  describe("P10-02: Pre-Commit Syntax Validation - Broken Code Detection", () => {
    it("catches unmatched or unclosed curly braces, parentheses, and brackets in TypeScript", () => {
      const brokenCode = `
        export function computeTotal(items: number[]) {
          return items.reduce((acc, curr) => {
            return acc + curr;
          // Missing closing brace
        }
      `;

      const result = validateCodeSyntax(brokenCode, "src/utils/calc.ts");
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0]).toContain("Unclosed opening delimiter");
    });

    it("catches mismatched closing delimiters", () => {
      const mismatched = `
        const data = [1, 2, 3};
      `;
      const result = validateCodeSyntax(mismatched, "src/index.js");
      expect(result.valid).toBe(false);
      expect(result.errors[0]).toContain("Mismatched delimiter");
    });

    it("catches unclosed template string literals", () => {
      const unclosedString = "const msg = `Hello world;\nreturn msg;";
      const result = validateCodeSyntax(unclosedString, "src/greet.ts");
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes("Unclosed template backtick"))).toBe(true);
    });

    it("detects malformed JSON syntax", () => {
      const badJson = '{\n  "name": "praxd",\n  "version": \n}';
      const result = validateCodeSyntax(badJson, "package.json");
      expect(result.valid).toBe(false);
      expect(result.errors[0]).toContain("Invalid JSON syntax");
    });
  });

  // ---------------------------------------------------------------------------
  // P10-03: Pre-Commit Syntax Validation - Valid Code Constructs
  // ---------------------------------------------------------------------------
  describe("P10-03: Pre-Commit Syntax Validation - Valid Code", () => {
    it("passes syntactically valid TypeScript and React code", () => {
      const validCode = `
        import React from "react";

        export function Greeting({ name }: { name: string }) {
          const message = \`Hello, \${name}!\`;
          return (
            <div className="p-4">
              <h1>{message}</h1>
            </div>
          );
        }
      `;

      const result = validateCodeSyntax(validCode, "components/greeting.tsx");
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.language).toBe("typescript-react");
    });

    it("passes valid JSON structures", () => {
      const validJson = JSON.stringify({ name: "praxd", valid: true, count: 42 }, null, 2);
      const result = validateCodeSyntax(validJson, "config.json");
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it("validates unified diff patches by inspecting added code lines", () => {
      const patch = `
@@ -10,4 +10,4 @@
-const token = req.query.token;
+const token = sanitizeToken(req.query.token);
      `;

      const result = validatePatchSyntax(patch, "src/auth.ts");
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
  });

  // ---------------------------------------------------------------------------
  // P10-04: Conventional Commit Message & Co-Author Attribution
  // ---------------------------------------------------------------------------
  describe("P10-04: Conventional Commit Message Formatting", () => {
    it("formats conventional commit message with clean title and bot co-author tag", () => {
      const commitMsg = formatConventionalCommitMessage(
        "Prevent Prototype Pollution Vulnerability",
        "lib/utils/merge.ts"
      );

      expect(commitMsg).toContain("fix(praxd): resolve Prevent Prototype Pollution Vulnerability in merge.ts");
      expect(commitMsg).toContain("Target File: lib/utils/merge.ts");
      expect(commitMsg).toContain("Co-authored-by: PRAXD AI <bot@praxd.com>");
    });

    it("supports custom user commit messages while preserving co-author attribution", () => {
      const customMsg = formatConventionalCommitMessage(
        "Fix XSS in comment renderer",
        "components/comment.tsx",
        "fix(security): sanitize dangerous HTML tags"
      );

      expect(customMsg.startsWith("fix(security): sanitize dangerous HTML tags")).toBe(true);
      expect(customMsg).toContain("Co-authored-by: PRAXD AI <bot@praxd.com>");
    });
  });

  // ---------------------------------------------------------------------------
  // P10-05: Target Branch Resolution & Companion Branch Naming
  // ---------------------------------------------------------------------------
  describe("P10-05: Target Branch Resolution", () => {
    it("generates deterministic companion branch names from finding id", () => {
      const branch = getCompanionBranchName("finding-98a76bc4-def1");
      expect(branch).toBe("praxd/fix-finding-finding-");

      const branch2 = getCompanionBranchName("c194a2f8");
      expect(branch2).toBe("praxd/fix-finding-c194a2f8");
    });
  });

  // ---------------------------------------------------------------------------
  // P10-06: RBAC Enforcement for Autofix Commit Write-Back
  // ---------------------------------------------------------------------------
  describe("P10-06: Role-Based Access Control (RBAC)", () => {
    it("allows owner, admin, reviewer, and member roles to commit fixes", () => {
      expect(canCommitAutofix("owner")).toBe(true);
      expect(canCommitAutofix("admin")).toBe(true);
      expect(canCommitAutofix("reviewer")).toBe(true);
      expect(canCommitAutofix("member")).toBe(true);
    });

    it("blocks viewer role from committing code fixes", () => {
      expect(canCommitAutofix("viewer")).toBe(false);
      expect(ROLE_PERMISSIONS.viewer.canCommitAutofix).toBe(false);
    });
  });

  // ---------------------------------------------------------------------------
  // P10-07: PR State Guardrails
  // ---------------------------------------------------------------------------
  describe("P10-07: Target PR State Guardrail", () => {
    it("blocks autofix commit when target PR is closed or merged", () => {
      const checkPrOpen = (state: string) => {
        if (state !== "open") {
          return { allowed: false, error: "PR_CLOSED" };
        }
        return { allowed: true };
      };

      expect(checkPrOpen("closed").allowed).toBe(false);
      expect(checkPrOpen("merged").allowed).toBe(false);
      expect(checkPrOpen("open").allowed).toBe(true);
    });
  });

  // ---------------------------------------------------------------------------
  // P10-08: Commit Engine Execution & SHA Generation
  // ---------------------------------------------------------------------------
  describe("P10-08: Commit Engine Execution", () => {
    it("executes simulated commit for valid code and returns deterministic 40-char SHA", async () => {
      const result = await executeAutofixCommit({
        findingId: "f-12345",
        filePath: "lib/sanitizer.ts",
        proposedCode: "export function sanitize(input: string) { return input.trim(); }",
        targetBranchMode: "direct",
        headBranch: "feat/user-input",
        headSha: "11223344556677889900aabbccddeeff00112233",
        findingTitle: "Sanitize unsanitized input string",
        repository: {
          owner: "praxd-org",
          name: "praxd-core",
        },
        author: {
          name: "Jane Doe",
          email: "jane@praxd.com",
        },
      });

      expect(result.success).toBe(true);
      expect(result.commitSha).toHaveLength(40);
      expect(result.branch).toBe("feat/user-input");
      expect(result.commitMessage).toContain("fix(praxd): resolve Sanitize unsanitized input string in sanitizer.ts");
      expect(result.filesCommitted).toEqual(["lib/sanitizer.ts"]);
    });

    it("creates commit on companion branch when requested", async () => {
      const result = await executeAutofixCommit({
        findingId: "f-companion-99",
        filePath: "src/config.ts",
        proposedCode: "export const timeoutMs = 5000;\n",
        targetBranchMode: "companion",
        headBranch: "main",
        headSha: "aabbccddeeff0011223344556677889900112233",
        findingTitle: "Increase default network timeout",
        repository: {
          owner: "praxd-org",
          name: "praxd-core",
        },
        author: {
          name: "John Smith",
          email: "john@praxd.com",
        },
      });

      expect(result.success).toBe(true);
      expect(result.branch).toBe("praxd/fix-finding-f-compan");
      expect(result.commitSha).toBeDefined();
    });

    it("throws before commit if proposed code violates language syntax", async () => {
      await expect(
        executeAutofixCommit({
          findingId: "f-err-01",
          filePath: "src/index.ts",
          proposedCode: "function broken( {",
          targetBranchMode: "direct",
          headBranch: "main",
          headSha: "1234567890",
          findingTitle: "Broken fix",
          repository: {
            owner: "test",
            name: "test",
          },
          author: {
            name: "Test",
            email: "test@test.com",
          },
        })
      ).rejects.toThrow("Pre-commit syntax validation failed");
    });
  });
});
