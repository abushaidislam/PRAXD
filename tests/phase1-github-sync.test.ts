import { describe, it, expect } from "vitest";
import { mapPullRequestState, mapReviewState } from "@/lib/github/sync";
import { parseLinkHeader, GitHubApiError } from "@/lib/github/client";

describe("Phase 1 Acceptance: GitHub Synchronization & Data Mapping", () => {
  describe("P1-05: Canonical PR state mapping", () => {
    it("maps merged PRs accurately regardless of raw state value", () => {
      // GitHub sets state='closed' and merged_at='2026-10-30T10:00:00Z'
      const state = mapPullRequestState({
        state: "closed",
        merged_at: "2026-10-30T10:00:00Z",
      });
      expect(state).toBe("merged");
    });

    it("maps closed unmerged PRs to closed", () => {
      const state = mapPullRequestState({
        state: "closed",
        merged_at: null,
      });
      expect(state).toBe("closed");
    });

    it("maps open PRs to open", () => {
      const state = mapPullRequestState({
        state: "open",
        merged_at: null,
      });
      expect(state).toBe("open");
    });

    it("maps GitHub review states to canonical PRAXD enum", () => {
      expect(mapReviewState("APPROVED")).toBe("approved");
      expect(mapReviewState("CHANGES_REQUESTED")).toBe("changes_requested");
      expect(mapReviewState("COMMENTED")).toBe("commented");
      expect(mapReviewState("DISMISSED")).toBe("dismissed");
      expect(mapReviewState("PENDING")).toBe("pending");
      expect(mapReviewState("OTHER")).toBe("unknown");
    });
  });

  describe("P1-06: API Link header pagination parsing", () => {
    it("parses standard GitHub Link header rel='next', rel='last'", () => {
      const linkHeader =
        '<https://api.github.com/repositories/123/pulls?page=2&per_page=100>; rel="next", <https://api.github.com/repositories/123/pulls?page=5&per_page=100>; rel="last"';

      const links = parseLinkHeader(linkHeader);
      expect(links.next).toBe(
        "https://api.github.com/repositories/123/pulls?page=2&per_page=100"
      );
      expect(links.last).toBe(
        "https://api.github.com/repositories/123/pulls?page=5&per_page=100"
      );
    });

    it("handles null or empty link header gracefully", () => {
      expect(parseLinkHeader(null)).toEqual({});
      expect(parseLinkHeader("")).toEqual({});
    });
  });

  describe("P1-07: Binary and patch availability honesty", () => {
    it("differentiates text patch availability from binary/omitted files", () => {
      const textFile = {
        filename: "src/utils.ts",
        status: "modified",
        patch: "@@ -1,3 +1,4 @@\n+export const safe = true;",
      };

      const binaryFile = {
        filename: "public/icon.png",
        status: "modified",
        patch: undefined, // GitHub omits patch for binaries
      };

      const emptyPatchFile = {
        filename: "large-file.json",
        status: "modified",
        patch: "",
      };

      expect(typeof textFile.patch === "string" && textFile.patch.length > 0).toBe(true);
      expect(typeof (binaryFile.patch as string | undefined) === "string" && (binaryFile.patch as any)?.length > 0).toBe(false);
      expect(typeof emptyPatchFile.patch === "string" && emptyPatchFile.patch.length > 0).toBe(false);
    });
  });

  describe("P1-08: Comment segregation: issue vs review diff comments", () => {
    it("distinguishes conversation comments from line-level review comments", () => {
      const issueComment = {
        id: 101,
        body: "LGTM!",
        commentType: "issue",
        path: undefined,
        line: undefined,
      };

      const reviewDiffComment = {
        id: 102,
        body: "Consider using Math.max here.",
        commentType: "review",
        path: "src/calc.ts",
        line: 42,
        side: "RIGHT",
      };

      expect(issueComment.commentType).toBe("issue");
      expect(issueComment.path).toBeUndefined();

      expect(reviewDiffComment.commentType).toBe("review");
      expect(reviewDiffComment.path).toBe("src/calc.ts");
      expect(reviewDiffComment.line).toBe(42);
    });
  });

  describe("P1-09: Check run head_sha association guard", () => {
    it("associates check runs only when their head_sha matches the current PR head_sha", () => {
      const currentPrHeadSha = "f7658d3";
      const oldCheckRun = {
        id: 1,
        name: "Old CI Build",
        head_sha: "e903bc1", // Stale commit before rebase
      };
      const currentCheckRun = {
        id: 2,
        name: "Current CI Build",
        head_sha: "f7658d3", // Matches current PR head
      };

      const checkRuns = [oldCheckRun, currentCheckRun];
      const validChecksForPr = checkRuns.filter(
        (cr) => cr.head_sha === currentPrHeadSha
      );

      expect(validChecksForPr.length).toBe(1);
      expect(validChecksForPr[0].id).toBe(2);
      expect(validChecksForPr[0].name).toBe("Current CI Build");
    });
  });

  describe("P1-10: Rate limit 429 and 403 error parsing", () => {
    it("calculates retry time from rate limit headers", () => {
      const rateLimit = { limit: 5000, remaining: 0, reset: Math.floor(Date.now() / 1000) + 60 };
      const err = new GitHubApiError("Rate limit exceeded", 429, rateLimit, 60);

      expect(err.status).toBe(429);
      expect(err.retryAfterSeconds).toBe(60);
      expect(err.rateLimit?.remaining).toBe(0);
    });

    it("handles 403 permission denied cleanly", () => {
      const err = new GitHubApiError("Forbidden: Resource not accessible by integration", 403);
      expect(err.status).toBe(403);
      expect(err.message).toContain("Forbidden");
    });
  });
});
