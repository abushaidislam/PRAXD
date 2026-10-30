import { describe, it, expect, beforeEach } from "vitest";
import {
  createInstallState,
  verifyInstallState,
  _resetUsedNoncesForTesting,
} from "@/lib/github/state";

describe("Phase 1 Acceptance: GitHub OAuth State Security (P1-01, P1-02)", () => {
  beforeEach(() => {
    _resetUsedNoncesForTesting();
  });

  it("P1-01: generates a valid signed state token bound to user and workspace", () => {
    const userId = "usr-1234-uuid";
    const workspaceId = "ws-5678-uuid";

    const state = createInstallState(userId, workspaceId);
    expect(state).toBeTruthy();
    expect(state.includes(".")).toBe(true);

    const verified = verifyInstallState(state);
    expect(verified.isValid).toBe(true);
    expect(verified.userId).toBe(userId);
    expect(verified.workspaceId).toBe(workspaceId);
  });

  it("P1-02: rejects omitted or null state token", () => {
    const result1 = verifyInstallState(null);
    expect(result1.isValid).toBe(false);
    expect(result1.error).toContain("Missing state");

    const result2 = verifyInstallState("");
    expect(result2.isValid).toBe(false);
  });

  it("P1-02: rejects tampered state token with altered payload or signature", () => {
    const validState = createInstallState("usr-original", "ws-original");
    const [payload, sig] = validState.split(".");

    // Alter payload
    const tamperedPayload = Buffer.from(
      JSON.stringify({ userId: "attacker", workspaceId: "ws-victim" })
    ).toString("base64url");

    const tamperedState = `${tamperedPayload}.${sig}`;
    const result = verifyInstallState(tamperedState);

    expect(result.isValid).toBe(false);
    expect(result.error).toContain("Invalid state signature");
  });

  it("P1-02: rejects reused state token (single-use enforcement against replay attacks)", () => {
    const state = createInstallState("usr-replay", "ws-replay");

    // First use: must succeed
    const firstVerification = verifyInstallState(state);
    expect(firstVerification.isValid).toBe(true);

    // Second use with identical state: MUST be rejected
    const secondVerification = verifyInstallState(state);
    expect(secondVerification.isValid).toBe(false);
    expect(secondVerification.error).toContain("already been used");
  });

  it("P1-02: rejects expired state token", () => {
    // Construct an expired token
    const expiredPayload = {
      userId: "usr-expired",
      workspaceId: "ws-expired",
      nonce: "nonce-12345",
      expiresAt: Date.now() - 5000, // 5 seconds in the past
    };

    const serialized = Buffer.from(JSON.stringify(expiredPayload)).toString("base64url");
    const crypto = require("crypto");
    const sig = crypto
      .createHmac("sha256", "praxd-secure-oauth-state-secret-default-key-32b")
      .update(serialized)
      .digest("base64url");

    const expiredState = `${serialized}.${sig}`;
    const result = verifyInstallState(expiredState);

    expect(result.isValid).toBe(false);
    expect(result.error).toContain("expired");
  });
});
