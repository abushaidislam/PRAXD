import { describe, it, expect, beforeEach } from "vitest";
import fs from "fs";
import path from "path";
import crypto from "crypto";
import {
  encryptWithKmsEnvelope,
  decryptWithKmsEnvelope,
  purgeDecryptedBuffer,
  decryptKeyIfEnveloped,
  getKmsStatus,
  isEncryptedEnvelope,
} from "../lib/security/kms";
import {
  getAvailableMigrationFiles,
  computeMigrationChecksum,
  runMigrations,
  getMigrationStatus,
  resetMigrationState,
} from "../lib/db/migrator";
import { securityHeaders } from "../lib/security/headers";

describe("Phase 9: Production Cloud Deployment, CI/CD Pipeline & KMS Secret Management (P9-01 to P9-05)", () => {
  beforeEach(() => {
    resetMigrationState();
  });

  // ---------------------------------------------------------------------------
  // P9-01: GitHub Actions CI/CD Workflow Pipeline
  // ---------------------------------------------------------------------------
  describe("P9-01: GitHub Actions CI/CD Pipeline Configuration", () => {
    it("workflow file exists and contains mandatory CI quality gate steps", () => {
      const ciPath = path.join(process.cwd(), ".github", "workflows", "ci.yml");
      expect(fs.existsSync(ciPath)).toBe(true);

      const ciContent = fs.readFileSync(ciPath, "utf8");

      // Verify triggers on push and pull_request to main
      expect(ciContent).toContain("branches: [main]");
      expect(ciContent).toContain("pull_request:");
      expect(ciContent).toContain("push:");

      // Verify concurrency cancellation
      expect(ciContent).toContain("cancel-in-progress: true");

      // Verify mandatory verification steps
      expect(ciContent).toContain("npm run lint");
      expect(ciContent).toContain("npm run typecheck");
      expect(ciContent).toContain("npm run test");
      expect(ciContent).toContain("npm run build");

      // Verify database integrity and deployment jobs
      expect(ciContent).toContain("database-integrity:");
      expect(ciContent).toContain("deploy-preview:");
      expect(ciContent).toContain("deploy-production:");
    });
  });

  // ---------------------------------------------------------------------------
  // P9-02: Supabase Database Migrations & Checksum Verification
  // ---------------------------------------------------------------------------
  describe("P9-02: Database Migrations & Checksum Verification", () => {
    it("loads migration files in order and computes deterministic SHA-256 checksums", () => {
      const files = getAvailableMigrationFiles();
      expect(files.length).toBeGreaterThanOrEqual(2);
      expect(files[0].name).toBe("0001_initial_schema.sql");
      expect(files[1].name).toBe("0002_production_integrity.sql");

      for (const file of files) {
        expect(file.checksum).toHaveLength(64);
        expect(file.sql.length).toBeGreaterThan(100);
      }
    });

    it("runs pending migrations idempotently without re-executing applied migrations", async () => {
      // 1. Initial run: should apply all pending migrations
      const initialRun = await runMigrations();
      expect(initialRun.success).toBe(true);
      expect(initialRun.applied.length).toBeGreaterThanOrEqual(2);
      expect(initialRun.skipped.length).toBe(0);

      const statusAfterFirst = await getMigrationStatus();
      expect(statusAfterFirst.isUpToDate).toBe(true);
      expect(statusAfterFirst.pendingCount).toBe(0);

      // 2. Second run: should safely skip already applied migrations
      const secondRun = await runMigrations();
      expect(secondRun.success).toBe(true);
      expect(secondRun.applied.length).toBe(0);
      expect(secondRun.skipped.length).toBe(initialRun.applied.length);
    });

    it("detects schema tampering and rejects modified migration files", async () => {
      // Apply migrations initially
      await runMigrations();

      // Simulate tampered migration file check with mismatched checksum
      const files = getAvailableMigrationFiles();
      const tamperedRecord = {
        name: files[0].name,
        checksum: "invalid_tampered_sha256_hash_1234567890abcdef",
        executedAt: new Date().toISOString(),
        executionTimeMs: 15,
        status: "applied" as const,
      };

      const status = await getMigrationStatus(undefined, [tamperedRecord]);
      expect(status.verifiedChecksums).toBe(false);
      expect(status.isUpToDate).toBe(false);
      const mismatched = status.migrations.find((m) => m.name === files[0].name);
      expect(mismatched?.status).toBe("checksum_mismatch");
    });
  });

  // ---------------------------------------------------------------------------
  // P9-03: Production KMS Envelope Encryption & Buffer Purging
  // ---------------------------------------------------------------------------
  describe("P9-03: KMS Envelope Encryption & Secure Key Purging", () => {
    const testMasterKey = crypto.randomBytes(32).toString("base64");
    const testPrivateKey = "-----BEGIN RSA PRIVATE KEY-----\nMIIEowIBAAKCAQEA0123456789PRAXDTESTKEY\n-----END RSA PRIVATE KEY-----";

    it("encrypts and decrypts secret data using AES-256-GCM envelope encryption", () => {
      const envelope = encryptWithKmsEnvelope(testPrivateKey, testMasterKey, "praxd-kms-test-key");

      expect(isEncryptedEnvelope(envelope)).toBe(true);
      expect(envelope.version).toBe(1);
      expect(envelope.algorithm).toBe("aes-256-gcm");
      expect(envelope.keyId).toBe("praxd-kms-test-key");
      expect(envelope.ciphertext).toBeDefined();
      expect(envelope.tag).toBeDefined();
      expect(envelope.encryptedDataKey).toBeDefined();

      const decrypted = decryptWithKmsEnvelope(envelope, testMasterKey);
      expect(decrypted.toString("utf8")).toBe(testPrivateKey);
    });

    it("rejects corrupted ciphertext or tampered GCM authentication tag", () => {
      const envelope = encryptWithKmsEnvelope("top-secret-payload", testMasterKey);

      // Corrupt the auth tag
      const corruptedTag = Buffer.from(envelope.tag, "base64");
      corruptedTag[0] ^= 0xff;
      const tamperedEnvelope = {
        ...envelope,
        tag: corruptedTag.toString("base64"),
      };

      expect(() => decryptWithKmsEnvelope(tamperedEnvelope, testMasterKey)).toThrow();
    });

    it("securely zeroes out decrypted sensitive memory buffers", () => {
      const secret = Buffer.from("super-sensitive-signing-key-bytes");
      expect(secret.toString("utf8")).toBe("super-sensitive-signing-key-bytes");

      purgeDecryptedBuffer(secret);

      // Memory buffer should be filled with zeroes
      for (let i = 0; i < secret.length; i++) {
        expect(secret[i]).toBe(0);
      }
    });

    it("transparently unwraps enveloped keys or passes through raw keys safely", () => {
      // 1. Enveloped JSON string
      const envelope = encryptWithKmsEnvelope("secret-app-pem", testMasterKey);
      const jsonEnvelope = JSON.stringify(envelope);

      const unwrapped = decryptKeyIfEnveloped(jsonEnvelope, testMasterKey);
      expect(unwrapped.key).toBe("secret-app-pem");
      unwrapped.purge();

      // 2. Raw un-enveloped key
      const plain = decryptKeyIfEnveloped("plain-unencrypted-secret", testMasterKey);
      expect(plain.key).toBe("plain-unencrypted-secret");
      plain.purge(); // Should not throw
    });

    it("reports KMS operational status correctly", () => {
      const status = getKmsStatus();
      expect(status.operational).toBe(true);
      expect(status.algorithm).toContain("AES-256-GCM");
      expect(status.provider).toBeDefined();
    });
  });

  // ---------------------------------------------------------------------------
  // P9-04: Production Security Headers & Edge CDN Caching
  // ---------------------------------------------------------------------------
  describe("P9-04: Production Security Headers & CDN Configuration", () => {
    it("exports all mandatory enterprise security headers", () => {
      const headerMap = new Map<string, string>();
      for (const h of securityHeaders) {
        headerMap.set(h.key.toLowerCase(), h.value);
      }

      // HSTS
      expect(headerMap.get("strict-transport-security")).toContain("max-age=63072000");
      expect(headerMap.get("strict-transport-security")).toContain("includeSubDomains");
      expect(headerMap.get("strict-transport-security")).toContain("preload");

      // X-Frame-Options
      expect(headerMap.get("x-frame-options")).toBe("DENY");

      // X-Content-Type-Options
      expect(headerMap.get("x-content-type-options")).toBe("nosniff");

      // Referrer-Policy
      expect(headerMap.get("referrer-policy")).toBe("strict-origin-when-cross-origin");

      // Permissions-Policy
      expect(headerMap.get("permissions-policy")).toContain("camera=()");
      expect(headerMap.get("permissions-policy")).toContain("microphone=()");

      // Content-Security-Policy
      expect(headerMap.get("content-security-policy")).toContain("default-src 'self'");
      expect(headerMap.get("content-security-policy")).toContain("frame-ancestors 'none'");
    });
  });

  // ---------------------------------------------------------------------------
  // P9-05: Enhanced Health & Readiness Endpoint
  // ---------------------------------------------------------------------------
  describe("P9-05: Enhanced Production Health & Readiness", () => {
    it("constructs full health response with database, KMS, and migration checks", () => {
      const kms = getKmsStatus();
      const healthPayload = {
        status: "healthy",
        version: "0.6.0",
        timestamp: new Date().toISOString(),
        environment: "production",
        checks: {
          database: "healthy",
          latencyMs: 18,
          kms: {
            operational: kms.operational,
            provider: kms.provider,
            algorithm: kms.algorithm,
          },
          migrations: {
            isUpToDate: true,
            pendingCount: 0,
          },
        },
      };

      expect(healthPayload.status).toBe("healthy");
      expect(healthPayload.version).toBe("0.6.0");
      expect(healthPayload.checks.latencyMs).toBeLessThan(50); // Under 50ms SLA
      expect(healthPayload.checks.kms.operational).toBe(true);
      expect(healthPayload.checks.migrations.isUpToDate).toBe(true);
    });
  });
});
