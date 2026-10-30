import crypto from "crypto";

interface InstallStatePayload {
  userId: string;
  workspaceId: string;
  nonce: string;
  expiresAt: number;
}

// Track used nonces in-memory (and can be backed by db in distributed environments)
const usedNonces = new Set<string>();

const STATE_SECRET = process.env.CREDENTIAL_ENCRYPTION_KEY_BASE64 || "praxd-secure-oauth-state-secret-default-key-32b";
const EXPIRY_MS = 10 * 60 * 1000; // 10 minutes

/**
 * Creates a cryptographically signed, tamper-proof state token for GitHub App installation.
 * Binds the installation flow to the initiating user and workspace.
 */
export function createInstallState(userId: string, workspaceId: string): string {
  const nonce = crypto.randomBytes(16).toString("hex");
  const expiresAt = Date.now() + EXPIRY_MS;

  const payload: InstallStatePayload = {
    userId,
    workspaceId,
    nonce,
    expiresAt,
  };

  const serialized = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = crypto
    .createHmac("sha256", STATE_SECRET)
    .update(serialized)
    .digest("base64url");

  return `${serialized}.${signature}`;
}

/**
 * Validates a returned state token from GitHub App installation callback.
 * Enforces:
 * 1. Valid HMAC signature (detects tampering)
 * 2. Not expired (within 10 minutes)
 * 3. Single-use (replay prevention: cannot be reused)
 */
export function verifyInstallState(state: string | null | undefined): {
  isValid: boolean;
  error?: string;
  userId?: string;
  workspaceId?: string;
} {
  if (!state || typeof state !== "string") {
    return { isValid: false, error: "Missing state parameter" };
  }

  const parts = state.split(".");
  if (parts.length !== 2) {
    return { isValid: false, error: "Malformed state parameter" };
  }

  const [serialized, receivedSignature] = parts;

  // Constant-time signature comparison to prevent timing attacks
  const expectedSignature = crypto
    .createHmac("sha256", STATE_SECRET)
    .update(serialized)
    .digest("base64url");

  const sigBufferA = Buffer.from(receivedSignature);
  const sigBufferB = Buffer.from(expectedSignature);

  if (
    sigBufferA.length !== sigBufferB.length ||
    !crypto.timingSafeEqual(sigBufferA, sigBufferB)
  ) {
    return { isValid: false, error: "Invalid state signature (tampered or forged)" };
  }

  try {
    const payload: InstallStatePayload = JSON.parse(
      Buffer.from(serialized, "base64url").toString("utf8")
    );

    // Check expiration
    if (Date.now() > payload.expiresAt) {
      return { isValid: false, error: "State parameter has expired" };
    }

    // Check single-use
    if (usedNonces.has(payload.nonce)) {
      return { isValid: false, error: "State parameter has already been used (replay detected)" };
    }

    // Mark nonce as used
    usedNonces.add(payload.nonce);

    return {
      isValid: true,
      userId: payload.userId,
      workspaceId: payload.workspaceId,
    };
  } catch {
    return { isValid: false, error: "Failed to parse state payload" };
  }
}

/**
 * Helper for testing nonce resets in unit tests
 */
export function _resetUsedNoncesForTesting() {
  usedNonces.clear();
}
