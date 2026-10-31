import { describe, it, expect, vi, beforeEach } from "vitest";
import { getAIReviewer, DeterministicReviewer, OpenAIReviewer, GeminiReviewer } from "@/lib/ai/reviewer";
import { liveReviewsStore } from "@/lib/ai/lifecycle";

describe("Live AI Review & Model Readiness Tests", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
    vi.clearAllMocks();
  });

  it("resolves DeterministicReviewer when no external AI keys are configured", () => {
    delete process.env.OPENAI_API_KEY;
    delete process.env.GEMINI_API_KEY;
    delete process.env.GOOGLE_GENAI_API_KEY;

    const reviewer = getAIReviewer();
    expect(reviewer).toBeInstanceOf(DeterministicReviewer);
  });

  it("resolves GeminiReviewer when GEMINI_API_KEY is configured", () => {
    process.env.GEMINI_API_KEY = "ai-test-gemini-key";
    delete process.env.OPENAI_API_KEY;

    const reviewer = getAIReviewer();
    expect(reviewer).toBeInstanceOf(GeminiReviewer);
  });

  it("resolves OpenAIReviewer when OPENAI_API_KEY is configured and no Gemini key", () => {
    delete process.env.GEMINI_API_KEY;
    delete process.env.GOOGLE_GENAI_API_KEY;
    process.env.OPENAI_API_KEY = "sk-test-openai-key";

    const reviewer = getAIReviewer();
    expect(reviewer).toBeInstanceOf(OpenAIReviewer);
  });

  it("stores and retrieves live review runs in memory without throwing database errors", () => {
    const testPrId = "live__testowner__testrepo__99";
    const testHeadSha = "abc1234567890abcdef1234567890abcdef12345";

    liveReviewsStore.set(testPrId, {
      run: {
        id: "run-live-test",
        pull_request_id: testPrId,
        head_sha: testHeadSha,
        status: "completed",
        provider: "gemini",
        model: "gemini-2.5-flash",
        summary: "Test live PR review completed successfully.",
        overall_risk: "low",
        created_at: new Date().toISOString(),
        completed_at: new Date().toISOString(),
        findings_count: 0,
      },
      findings: [],
    });

    expect(liveReviewsStore.has(testPrId)).toBe(true);
    const stored = liveReviewsStore.get(testPrId);
    expect(stored?.run.status).toBe("completed");
    expect(stored?.run.model).toBe("gemini-2.5-flash");
  });
});
