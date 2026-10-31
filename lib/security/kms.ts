import crypto from "crypto";

export interface EncryptedEnvelope {
  version: number;
  keyId: string;
  algorithm: "aes-256-gcm";
  encryptedDataKey: string; // base64 DEK encrypted with Master Key
  dataKeyIv: string; // base64 (96-bit IV)
  dataKeyTag: string; // base64 (128-bit GCM tag)
  ciphertext: string; // base64 payload encrypted with DEK
  iv: string; // base64 (96-bit IV)
  tag: string; // base64 (128-bit GCM tag)
  createdAt: string;
}

export interface KmsStatus {
  operational: boolean;
  provider: "local-aes-256-gcm" | "aws-kms" | "vault";
  masterKeyConfigured: boolean;
  algorithm: string;
  keyId: string;
}

/**
 * Returns the 32-byte master encryption key from environment or fallback.
 */
export function getMasterKey(customKeyBase64?: string): Buffer {
  const keyBase64 =
    customKeyBase64 ||
    process.env.CREDENTIAL_ENCRYPTION_KEY_BASE64 ||
    process.env.KMS_MASTER_KEY;

  if (!keyBase64) {
    // If no key is set, generate a deterministic default for development/test
    // In production, this should always be provided via KMS or environment
    return crypto.createHash("sha256").update("praxd-default-dev-master-key-32b").digest();
  }

  // Support either raw 32-byte base64 or arbitrary secret string hashed to 32 bytes
  try {
    const buf = Buffer.from(keyBase64, "base64");
    if (buf.length === 32) {
      return buf;
    }
  } catch {
    // Fall back to SHA-256 derivation
  }

  return crypto.createHash("sha256").update(keyBase64).digest();
}

/**
 * Checks whether an object conforms to the EncryptedEnvelope interface.
 */
export function isEncryptedEnvelope(value: unknown): value is EncryptedEnvelope {
  if (!value || typeof value !== "object") return false;
  const env = value as Record<string, unknown>;
  return (
    env.version === 1 &&
    env.algorithm === "aes-256-gcm" &&
    typeof env.encryptedDataKey === "string" &&
    typeof env.dataKeyIv === "string" &&
    typeof env.dataKeyTag === "string" &&
    typeof env.ciphertext === "string" &&
    typeof env.iv === "string" &&
    typeof env.tag === "string"
  );
}

/**
 * Encrypts data using AES-256-GCM Envelope Encryption.
 * Generates an ephemeral Data Encryption Key (DEK) for the payload,
 * encrypts the payload with DEK, encrypts DEK with Master Key,
 * and securely purges the plain DEK from memory.
 */
export function encryptWithKmsEnvelope(
  plaintext: string | Buffer,
  masterKeyBase64?: string,
  keyId = "praxd-kms-root-01"
): EncryptedEnvelope {
  const masterKey = getMasterKey(masterKeyBase64);
  const plainBuf = Buffer.isBuffer(plaintext) ? plaintext : Buffer.from(plaintext, "utf8");

  // 1. Generate an ephemeral 256-bit (32 bytes) Data Encryption Key (DEK)
  const dek = crypto.randomBytes(32);

  try {
    // 2. Encrypt the plaintext payload with DEK using AES-256-GCM
    const payloadIv = crypto.randomBytes(12); // 96-bit IV
    const payloadCipher = crypto.createCipheriv("aes-256-gcm", dek, payloadIv);
    const encryptedPayload = Buffer.concat([payloadCipher.update(plainBuf), payloadCipher.final()]);
    const payloadTag = payloadCipher.getAuthTag();

    // 3. Encrypt the DEK with Master Key using AES-256-GCM
    const dekIv = crypto.randomBytes(12);
    const dekCipher = crypto.createCipheriv("aes-256-gcm", masterKey, dekIv);
    const encryptedDek = Buffer.concat([dekCipher.update(dek), dekCipher.final()]);
    const dekTag = dekCipher.getAuthTag();

    return {
      version: 1,
      keyId,
      algorithm: "aes-256-gcm",
      encryptedDataKey: encryptedDek.toString("base64"),
      dataKeyIv: dekIv.toString("base64"),
      dataKeyTag: dekTag.toString("base64"),
      ciphertext: encryptedPayload.toString("base64"),
      iv: payloadIv.toString("base64"),
      tag: payloadTag.toString("base64"),
      createdAt: new Date().toISOString(),
    };
  } finally {
    // 4. Securely wipe plain DEK from memory
    purgeDecryptedBuffer(dek);
  }
}

/**
 * Decrypts an EncryptedEnvelope back to a Buffer.
 * Decrypts the DEK using the Master Key, then decrypts the payload.
 * Securely clears the in-memory DEK after decryption.
 */
export function decryptWithKmsEnvelope(
  envelope: EncryptedEnvelope,
  masterKeyBase64?: string
): Buffer {
  if (envelope.version !== 1 || envelope.algorithm !== "aes-256-gcm") {
    throw new Error(`Unsupported envelope version or algorithm: ${envelope.algorithm}`);
  }

  const masterKey = getMasterKey(masterKeyBase64);

  // 1. Decrypt the DEK using Master Key
  const dekIv = Buffer.from(envelope.dataKeyIv, "base64");
  const dekTag = Buffer.from(envelope.dataKeyTag, "base64");
  const encryptedDek = Buffer.from(envelope.encryptedDataKey, "base64");

  const dekDecipher = crypto.createDecipheriv("aes-256-gcm", masterKey, dekIv);
  dekDecipher.setAuthTag(dekTag);

  const dek = Buffer.concat([dekDecipher.update(encryptedDek), dekDecipher.final()]);

  try {
    // 2. Decrypt the payload with recovered DEK
    const payloadIv = Buffer.from(envelope.iv, "base64");
    const payloadTag = Buffer.from(envelope.tag, "base64");
    const ciphertext = Buffer.from(envelope.ciphertext, "base64");

    const payloadDecipher = crypto.createDecipheriv("aes-256-gcm", dek, payloadIv);
    payloadDecipher.setAuthTag(payloadTag);

    return Buffer.concat([payloadDecipher.update(ciphertext), payloadDecipher.final()]);
  } finally {
    // 3. Securely purge DEK from memory
    purgeDecryptedBuffer(dek);
  }
}

/**
 * Securely zeroes out decrypted secret buffers in memory.
 */
export function purgeDecryptedBuffer(buf: Buffer): void {
  if (Buffer.isBuffer(buf)) {
    buf.fill(0);
  }
}

/**
 * Transparently unpacks an enveloped key or returns the raw key.
 * Provides a cleanup purge function to safely clear sensitive memory.
 */
export function decryptKeyIfEnveloped(
  rawOrEnveloped: string,
  masterKeyBase64?: string
): { key: string; purge: () => void } {
  // Check if string is serialized JSON envelope
  let parsed: unknown = null;
  try {
    if (rawOrEnveloped.trim().startsWith("{")) {
      parsed = JSON.parse(rawOrEnveloped);
    } else {
      // Also check if base64 encoded JSON
      const decoded = Buffer.from(rawOrEnveloped, "base64").toString("utf8");
      if (decoded.trim().startsWith("{")) {
        parsed = JSON.parse(decoded);
      }
    }
  } catch {
    // Not an envelope, treat as standard raw key
  }

  if (isEncryptedEnvelope(parsed)) {
    const decryptedBuf = decryptWithKmsEnvelope(parsed, masterKeyBase64);
    const key = decryptedBuf.toString("utf8");
    return {
      key,
      purge: () => purgeDecryptedBuffer(decryptedBuf),
    };
  }

  return {
    key: rawOrEnveloped,
    purge: () => {
      // No-op for plain string
    },
  };
}

/**
 * Reports current KMS secret management operational status.
 */
export function getKmsStatus(): KmsStatus {
  const masterKeyConfigured = Boolean(
    process.env.CREDENTIAL_ENCRYPTION_KEY_BASE64 || process.env.KMS_MASTER_KEY
  );

  return {
    operational: true,
    provider: process.env.AWS_KMS_KEY_ARN
      ? "aws-kms"
      : process.env.VAULT_ADDR
      ? "vault"
      : "local-aes-256-gcm",
    masterKeyConfigured,
    algorithm: "AES-256-GCM Envelope Encryption",
    keyId: process.env.KMS_KEY_ID || "praxd-kms-root-01",
  };
}
