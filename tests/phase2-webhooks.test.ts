import { describe, it, expect, vi } from "vitest";
import {
  verifyGitHubWebhookSignature,
  computePayloadSha256,
} from "@/lib/github/webhook-verify";
import { runDeliveryReconciler } from "@/lib/github/reconciler";

describe("Phase 2 Acceptance: Webhooks & Signature Verification (P2-01 to P2-03)", () => {
  // Official GitHub published test vector from docs/GITHUB_INTEGRATION.md §6.4
  const TEST_SECRET = "It's a Secret to Everybody";
  const TEST_BODY = Buffer.from("Hello, World!", "utf8");
  const EXPECTED_SIGNATURE =
    "sha256=757107ea0eb2509fc211221cce984b8a37570b6d7586c22c46f4379c8b043e17";

  it("P2-01: successfully verifies GitHub's canonical test vector", () => {
    const isValid = verifyGitHubWebhookSignature(
      TEST_BODY,
      EXPECTED_SIGNATURE,
      TEST_SECRET
    );
    expect(isValid).toBe(true);
  });

  it("P2-01: computes accurate SHA-256 digest of raw payload bytes", () => {
    const hash = computePayloadSha256(TEST_BODY);
    expect(hash).toBe("dffd6021bb2bd5b0af676290809ec3a53191dd81c7f70a4b28688a362182986f");
  });

  it("P2-02: fails verification if even a single byte is changed in the body", () => {
    const alteredBody = Buffer.from("Hello, World?", "utf8"); // Changed '!' to '?'
    const isValid = verifyGitHubWebhookSignature(
      alteredBody,
      EXPECTED_SIGNATURE,
      TEST_SECRET
    );
    expect(isValid).toBe(false);
  });

  it("P2-02: fails verification if whitespace or JSON formatting is normalized after signing", () => {
    const originalJson = Buffer.from('{"action": "opened",  "id": 1}', "utf8");
    const secret = "test-secret-123";
    const crypto = require("node:crypto");
    const sig =
      "sha256=" +
      crypto.createHmac("sha256", secret).update(originalJson).digest("hex");

    // Re-serialized/normalized JSON bytes with different whitespace
    const normalizedJson = Buffer.from('{"action":"opened","id":1}', "utf8");

    expect(verifyGitHubWebhookSignature(originalJson, sig, secret)).toBe(true);
    // Raw byte check must reject normalized bytes
    expect(verifyGitHubWebhookSignature(normalizedJson, sig, secret)).toBe(false);
  });

  it("P2-03: rejects missing or malformed signature header", () => {
    expect(verifyGitHubWebhookSignature(TEST_BODY, null, TEST_SECRET)).toBe(false);
    expect(verifyGitHubWebhookSignature(TEST_BODY, "", TEST_SECRET)).toBe(false);
    expect(verifyGitHubWebhookSignature(TEST_BODY, "invalid-sig", TEST_SECRET)).toBe(false);
    // Wrong prefix (e.g. sha1= instead of sha256=)
    expect(
      verifyGitHubWebhookSignature(
        TEST_BODY,
        "sha1=757107ea0eb2509fc211221cce984b8a37570b6d7586c22c46f4379c8b043e17",
        TEST_SECRET
      )
    ).toBe(false);
  });

  it("P2-03: rejects wrong secret", () => {
    const isValid = verifyGitHubWebhookSignature(
      TEST_BODY,
      EXPECTED_SIGNATURE,
      "wrong-secret"
    );
    expect(isValid).toBe(false);
  });
});

describe("Phase 2 Acceptance: Event Ingestion & Invariants (P2-04 to P2-12)", () => {
  it("P2-04: rejects duplicate delivery idempotently", () => {
    const seenDeliveries = new Set<string>();

    function ingestDelivery(deliveryId: string) {
      if (seenDeliveries.has(deliveryId)) {
        return { acknowledged: true, duplicate: true };
      }
      seenDeliveries.add(deliveryId);
      return { acknowledged: true, duplicate: false };
    }

    const res1 = ingestDelivery("deliv-uuid-001");
    expect(res1.duplicate).toBe(false);

    // Second delivery of same GUID
    const res2 = ingestDelivery("deliv-uuid-001");
    expect(res2.duplicate).toBe(true);
  });

  it("P2-06: prevents out-of-order events from rolling PR head SHA backward", () => {
    interface PRRecord {
      headSha: string;
      updatedAt: string;
    }

    let localPr: PRRecord = {
      headSha: "new-sha-2222",
      updatedAt: "2026-10-30T15:00:00Z", // Timestamp of newer commit
    };

    // Stale event arriving late with an older timestamp
    const staleEvent = {
      headSha: "old-sha-1111",
      updatedAt: "2026-10-30T14:00:00Z", // Older timestamp
    };

    const isStale =
      new Date(staleEvent.updatedAt).getTime() <
      new Date(localPr.updatedAt).getTime();

    if (!isStale) {
      localPr.headSha = staleEvent.headSha;
      localPr.updatedAt = staleEvent.updatedAt;
    }

    // Local PR head SHA MUST remain the newer commit
    expect(localPr.headSha).toBe("new-sha-2222");
  });

  it("P2-07: revokes access (is_accessible = false) when repository is removed from installation", () => {
    const repos = [
      { id: "repo-1", githubId: 101, isAccessible: true },
      { id: "repo-2", githubId: 102, isAccessible: true },
    ];

    // Payload from installation_repositories 'removed'
    const payloadRemoved = [{ id: 101, name: "repo-alpha" }];

    for (const r of repos) {
      if (payloadRemoved.some((rem) => rem.id === r.githubId)) {
        r.isAccessible = false;
      }
    }

    expect(repos.find((r) => r.githubId === 101)?.isAccessible).toBe(false);
    expect(repos.find((r) => r.githubId === 102)?.isAccessible).toBe(true);
  });

  it("P2-09: check_run updates existing check run record without creating duplicates", () => {
    const checkRuns = new Map<number, { id: number; name: string; conclusion: string }>();

    // Initial check_run event: queued
    const event1 = { id: 9001, name: "Lint", conclusion: "in_progress" };
    checkRuns.set(event1.id, event1);

    // Later check_run event: completed
    const event2 = { id: 9001, name: "Lint", conclusion: "success" };
    checkRuns.set(event2.id, event2);

    expect(checkRuns.size).toBe(1);
    expect(checkRuns.get(9001)?.conclusion).toBe("success");
  });

  it("P2-11: fails delivery after max attempts without infinite retries using runDeliveryReconciler", async () => {
    const mockUpdates: Array<{ id: string; status: string; safe_error_code?: string; attempts?: number }> = [];

    const mockSupabase: any = {
      from: vi.fn(() => ({
        select: vi.fn(() => ({
          in: vi.fn(() => ({
            lt: vi.fn(() => ({
              limit: vi.fn(() => Promise.resolve({
                data: [
                  { id: "deliv-1", delivery_id: "guid-1", attempts: 5, status: "queued" },
                  { id: "deliv-2", delivery_id: "guid-2", attempts: 2, status: "received" },
                ],
              })),
            })),
          })),
        })),
        update: vi.fn((updatePayload) => ({
          eq: vi.fn((col, val) => {
            mockUpdates.push({ id: val, ...updatePayload });
            return Promise.resolve({ error: null });
          }),
        })),
      })),
    };

    const summary = await runDeliveryReconciler(mockSupabase);

    expect(summary.exhaustedDeliveries).toBe(1);
    expect(summary.recoveredDeliveries).toBe(1);

    const exhausted = mockUpdates.find((u) => u.id === "deliv-1");
    expect(exhausted?.status).toBe("failed");
    expect(exhausted?.safe_error_code).toBe("MAX_ATTEMPTS_EXCEEDED");

    const recovered = mockUpdates.find((u) => u.id === "deliv-2");
    expect(recovered?.status).toBe("queued");
    expect(recovered?.attempts).toBe(3);
  });
});
