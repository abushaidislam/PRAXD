import { createHash, createHmac, timingSafeEqual } from "node:crypto";

// GitHub's documented 25 MB webhook payload cap (allow up to 24 MB)
export const MAX_WEBHOOK_BYTES = 24 * 1024 * 1024;

/**
 * Reads the request body as raw bytes with an enforced size limit.
 * Must be read exactly once before any framework JSON parsing.
 */
export async function readRawBodyWithLimit(request: Request): Promise<Buffer> {
  const reader = request.body?.getReader();
  if (!reader) return Buffer.alloc(0);

  const chunks: Buffer[] = [];
  let totalBytes = 0;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      totalBytes += value.byteLength;
      if (totalBytes > MAX_WEBHOOK_BYTES) {
        await reader.cancel();
        throw new Error("WEBHOOK_PAYLOAD_TOO_LARGE");
      }
      chunks.push(Buffer.from(value));
    }
  } finally {
    reader.releaseLock();
  }

  return Buffer.concat(chunks, totalBytes);
}

/**
 * Verifies the GitHub HMAC SHA-256 webhook signature.
 * Enforces:
 * 1. Must start with 'sha256='
 * 2. Exactly 64 hex characters
 * 3. Constant-time comparison (crypto.timingSafeEqual) on equal-length buffers
 */
export function verifyGitHubWebhookSignature(
  rawBody: Buffer,
  signatureHeader: string | null,
  secret: string
): boolean {
  if (!signatureHeader || !signatureHeader.startsWith("sha256=")) {
    return false;
  }

  const receivedHex = signatureHeader.slice("sha256=".length);
  // Exactly 64 hexadecimal characters
  if (!/^[a-f0-9]{64}$/i.test(receivedHex)) {
    return false;
  }

  const expectedHex = createHmac("sha256", secret)
    .update(rawBody)
    .digest("hex");

  const received = Buffer.from(receivedHex, "hex");
  const expected = Buffer.from(expectedHex, "hex");

  if (received.length !== expected.length) {
    return false;
  }

  return timingSafeEqual(received, expected);
}

/**
 * Computes SHA-256 digest of raw webhook body for unique verification and storage
 */
export function computePayloadSha256(rawBody: Buffer): string {
  return createHash("sha256").update(rawBody).digest("hex");
}
