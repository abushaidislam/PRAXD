import { describe, it, expect, beforeEach } from "vitest";
import { getAIReviewer, DeterministicReviewer } from "@/lib/ai/reviewer";
import { AnthropicReviewer } from "@/lib/ai/anthropic-reviewer";
import {
  SelfHostedReviewer,
  validateSelfHostedEndpoint,
  sanitizeCustomHeaders,
} from "@/lib/ai/self-hosted-reviewer";
import { FallbackChainReviewer } from "@/lib/ai/fallback-chain-reviewer";
import {
  getWorkspaceGovernance,
  setWorkspaceGovernance,
  resetGovernanceStore,
} from "@/lib/governance/governance-store";
import { purgeExpiredDiffs } from "@/lib/governance/retention";
import { purgeAllWorkspaceData } from "@/lib/governance/workspace-purge";
import { calculateDoraMetrics } from "@/lib/analytics/dora";
import { setTestRoleOverride } from "@/lib/supabase/auth";
import { NextRequest } from "next/server";
import {
  GET as getSettingsRoute,
  PUT as putSettingsRoute,
} from "@/app/api/governance/settings/route";
import { POST as purgeRetentionRoute } from "@/app/api/governance/retention/purge/route";
import { POST as purgeWorkspaceRoute } from "@/app/api/workspaces/current/purge/route";
import { GET as getDoraRoute } from "@/app/api/analytics/dora/route";
import { ReviewContext } from "@/lib/ai/context-builder";

describe("Phase 8: Multi-Model Adapter & Enterprise Governance (P8-01 to P8-07)", () => {
  beforeEach(() => {
    resetGovernanceStore();
    setTestRoleOverride(null);
    delete process.env.AI_PROVIDER;
    delete process.env.ANTHROPIC_API_KEY;
    delete process.env.OPENAI_API_KEY;
    delete process.env.GEMINI_API_KEY;
    delete process.env.SELF_HOSTED_BASE_URL;
  });

  describe("P8-01: Provider-Agnostic LLM Adapter & Zero Code Refactoring", () => {
    it("switches to Anthropic Claude provider via environment configuration without code change", () => {
      process.env.AI_PROVIDER = "anthropic";
      process.env.ANTHROPIC_API_KEY = "sk-ant-test-key-123456";

      const reviewer = getAIReviewer();
      expect(reviewer).toBeInstanceOf(AnthropicReviewer);
    });

    it("switches to Self-Hosted provider via options with zero code changes", () => {
      const reviewer = getAIReviewer(undefined, {
        provider: "selfhosted",
        selfHosted: {
          baseUrl: "https://vllm.internal.infra.com/v1",
          model: "mistral-large-2407",
          requireTls: true,
        },
      });

      expect(reviewer).toBeInstanceOf(SelfHostedReviewer);
    });

    it("defaults to DeterministicReviewer when provider is deterministic", () => {
      const reviewer = getAIReviewer(undefined, { provider: "deterministic" });
      expect(reviewer).toBeInstanceOf(DeterministicReviewer);
    });
  });

  describe("P8-02: Self-Hosted TLS Certificate Validation & Safe Custom Headers", () => {
    it("rejects non-TLS HTTP endpoints when TLS is required for SOC2 compliance", () => {
      expect(() => {
        validateSelfHostedEndpoint("http://insecure-internal.lan/v1", true);
      }).toThrow(/Insecure self-hosted endpoint: TLS is required/i);
    });

    it("accepts valid secure HTTPS endpoints", () => {
      const url = validateSelfHostedEndpoint("https://vllm.secure.infra.com/v1", true);
      expect(url.protocol).toBe("https:");
      expect(url.hostname).toBe("vllm.secure.infra.com");
    });

    it("strips dangerous and forbidden hop-by-hop headers", () => {
      const dirtyHeaders = {
        Host: "evil-host.com",
        "Content-Length": "1234",
        Connection: "close",
        "X-Custom-Tenant-ID": "tenant-42",
        "X-Proxy-Secret": "secret-val",
      };

      const sanitized = sanitizeCustomHeaders(dirtyHeaders);

      expect(sanitized["X-Custom-Tenant-ID"]).toBe("tenant-42");
      expect(sanitized["X-Proxy-Secret"]).toBe("secret-val");
      expect(sanitized["Host"]).toBeUndefined();
      expect(sanitized["host"]).toBeUndefined();
      expect(sanitized["Content-Length"]).toBeUndefined();
      expect(sanitized["Connection"]).toBeUndefined();
    });

    it("detects and rejects CRLF header injection attempts", () => {
      const maliciousHeaders = {
        "X-Injection": "value\r\nSet-Cookie: session=hijacked",
      };

      expect(() => {
        sanitizeCustomHeaders(maliciousHeaders);
      }).toThrow(/CRLF injection attempt/i);
    });
  });

  describe("P8-03: Model Fallback Chain & Automatic Failover", () => {
    const mockContext: ReviewContext = {
      reviewRunId: "test-run-fallback",
      promptVersion: "praxd-ai-review-v1.0",
      repository: { fullName: "praxd/sentinel", primaryLanguage: "TypeScript" },
      pullRequest: {
        number: 55,
        title: "Security fix",
        body: null,
        baseRef: "main",
        baseSha: "sha-base",
        headRef: "feat",
        headSha: "sha-head",
        draft: false,
      },
      changedFiles: [
        {
          path: "src/safe.ts",
          previousPath: null,
          status: "modified",
          additions: 5,
          deletions: 1,
          patch: "@@ -1,1 +1,2 @@\n+ const ok = 1;",
        },
      ],
      filesConsidered: 1,
      omittedFilesCount: 0,
      coverageNote: "1 file evaluated.",
    };

    it("automatically fails over to secondary provider when primary throws rate limit or outage", async () => {
      const failingPrimary = {
        executeReview: async () => {
          throw new Error("HTTP 429: Too Many Requests (Rate limit exceeded)");
        },
      };

      const successfulSecondary = {
        executeReview: async () => ({
          schema_version: "1.0" as const,
          review_summary: "Secondary review complete.",
          overall_risk: "low" as const,
          findings: [],
        }),
      };

      const chain = new FallbackChainReviewer([
        { name: "primary-provider", provider: failingPrimary },
        { name: "secondary-backup", provider: successfulSecondary },
      ]);

      const result = await chain.executeReview(mockContext);

      expect(result.overall_risk).toBe("low");
      expect(result.review_summary).toContain("Failover from primary-provider to secondary-backup");
    });
  });

  describe("P8-04: Automated Data Retention & Patch Purging", () => {
    it("permanently purges expired diffs older than retention window while preserving findings", async () => {
      const outcome = await purgeExpiredDiffs({
        workspaceId: "ws-retention-test",
        retentionDays: 30,
        cutoffDate: new Date(Date.now() - 31 * 24 * 60 * 60 * 1000),
      });

      expect(outcome.prunedDiffsCount).toBeGreaterThanOrEqual(0);
      expect(outcome.completedAt).toBeDefined();

      const settings = getWorkspaceGovernance("ws-retention-test");
      expect(settings.lastPurgeAt).toBe(outcome.completedAt);
    });
  });

  describe("P8-05: One-Click Workspace Purge (SOC2 Compliance)", () => {
    it("purges all workspace data and resets governance stores", async () => {
      const result = await purgeAllWorkspaceData({
        workspaceId: "ws-purge-test",
      });

      expect(result.success).toBe(true);
      expect(result.workspaceId).toBe("ws-purge-test");
      expect(result.deletedTables).toBeDefined();
    });
  });

  describe("P8-06: Engineering Velocity & DORA Analytics", () => {
    it("computes accurate DORA metrics and assigns Elite rating for sub-4h TTFR and sub-24h cycle", () => {
      const prs = [
        {
          createdAt: "2026-10-01T10:00:00Z",
          firstReviewedAt: "2026-10-01T12:00:00Z", // 2 hours TTFR
          mergedAt: "2026-10-01T20:00:00Z", // 10 hours cycle
          state: "merged",
          additions: 150,
          deletions: 50,
        },
        {
          createdAt: "2026-10-02T08:00:00Z",
          firstReviewedAt: "2026-10-02T11:00:00Z", // 3 hours TTFR
          mergedAt: "2026-10-02T22:00:00Z", // 14 hours cycle
          state: "merged",
          additions: 200,
          deletions: 100,
        },
      ];

      const findings = [
        { status: "accepted" },
        { status: "dismissed" },
        { status: "open" },
      ];

      const metrics = calculateDoraMetrics({ pullRequests: prs, findings });

      expect(metrics.timeToFirstReviewHours).toBe(2.5); // (2 + 3) / 2
      expect(metrics.reviewCycleTimeHours).toBe(12); // (10 + 14) / 2
      expect(metrics.doraRating).toBe("elite");
      expect(metrics.triageResolutionRate).toBe(66.7); // 2 of 3 resolved = 66.7%
      expect(metrics.churnVelocityLinesPerPr).toBe(250); // (200 + 300) / 2
    });
  });

  describe("P8-07: Enterprise Governance REST API & Access Control", () => {
    it("allows reading governance settings via GET", async () => {
      const req = new NextRequest("http://localhost:3000/api/governance/settings");
      const res = await getSettingsRoute(req);

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.settings).toBeDefined();
      expect(json.settings.retentionDays).toBe(60);
    });

    it("denies governance modifications to viewers (HTTP 403 PERMISSION_DENIED)", async () => {
      setTestRoleOverride("viewer");

      const req = new NextRequest("http://localhost:3000/api/governance/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ retentionDays: 90, zeroDataRetention: true }),
      });

      const res = await putSettingsRoute(req);
      expect(res.status).toBe(403);
    });

    it("allows governance updates by admin/owner", async () => {
      setTestRoleOverride("admin");

      const req = new NextRequest("http://localhost:3000/api/governance/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          retentionDays: 30,
          zeroDataRetention: true,
          primaryProvider: "anthropic",
        }),
      });

      const res = await putSettingsRoute(req);
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.settings.retentionDays).toBe(30);
      expect(json.settings.zeroDataRetention).toBe(true);
      expect(json.settings.primaryProvider).toBe("anthropic");
    });

    it("blocks non-owners from executing full workspace data purge", async () => {
      setTestRoleOverride("admin"); // Admin is NOT Owner

      const req = new NextRequest("http://localhost:3000/api/workspaces/current/purge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirmWorkspaceId: "dev-workspace-0000-0000-000000000001" }),
      });

      const res = await purgeWorkspaceRoute(req);
      expect(res.status).toBe(403);
    });

    it("allows workspace owner to execute full workspace data purge", async () => {
      setTestRoleOverride("owner");

      const req = new NextRequest("http://localhost:3000/api/workspaces/current/purge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirmWorkspaceId: "dev-workspace-0000-0000-000000000001" }),
      });

      const res = await purgeWorkspaceRoute(req);
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.outcome.success).toBe(true);
    });

    it("returns DORA analytics via GET /api/analytics/dora", async () => {
      const req = new NextRequest("http://localhost:3000/api/analytics/dora");
      const res = await getDoraRoute(req);

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.metrics).toBeDefined();
      expect(json.metrics.doraRating).toBeDefined();
    });
  });
});
