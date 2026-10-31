import { ReviewContext } from "./context-builder";
import { AIReviewResult } from "@/types/ai-review";
import { AIReviewProvider, DeterministicReviewer } from "./reviewer";

export interface ProviderEntry {
  name: string;
  provider: AIReviewProvider;
}

/**
 * Model Fallback Chain Reviewer.
 * Automatically fails over to subsequent providers if primary provider fails due to
 * rate limits (HTTP 429), outages (HTTP 500/502/503), or network errors.
 */
export class FallbackChainReviewer implements AIReviewProvider {
  private chain: ProviderEntry[];

  constructor(chain: ProviderEntry[]) {
    if (!chain || chain.length === 0) {
      this.chain = [{ name: "deterministic", provider: new DeterministicReviewer() }];
    } else {
      this.chain = [...chain];
    }
  }

  async executeReview(context: ReviewContext): Promise<AIReviewResult> {
    const errorLogs: Array<{ provider: string; error: string }> = [];

    for (let i = 0; i < this.chain.length; i++) {
      const entry = this.chain[i];
      try {
        const result = await entry.provider.executeReview(context);
        // If we succeeded on a fallback (not first attempt), record telemetry note in summary
        if (i > 0) {
          result.review_summary = `[Failover from ${errorLogs.map((e) => e.provider).join(", ")} to ${entry.name}] ${result.review_summary}`;
        }
        return result;
      } catch (err: any) {
        const errMsg = err?.message || "Unknown error";
        console.warn(`[FallbackChain] Provider '${entry.name}' failed: ${errMsg}. Attempting failover...`);
        errorLogs.push({ provider: entry.name, error: errMsg });
      }
    }

    // Ultimate fallback if entire chain failed
    console.warn("[FallbackChain] All chain providers failed. Executing deterministic fallback reviewer.");
    const fallback = new DeterministicReviewer();
    const result = await fallback.executeReview(context);
    result.review_summary = `[All upstream AI providers unavailable; evaluated using deterministic fallback engine] ${result.review_summary}`;
    return result;
  }
}
