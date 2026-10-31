import fs from "fs";
import path from "path";
import crypto from "crypto";

export interface MigrationFile {
  name: string;
  path: string;
  checksum: string;
  sql: string;
}

export interface MigrationRecord {
  name: string;
  checksum: string;
  executedAt: string;
  executionTimeMs: number;
  status: "applied" | "pending" | "checksum_mismatch";
}

export interface MigrationRunResult {
  success: boolean;
  applied: string[];
  skipped: string[];
  errors: string[];
  totalDurationMs: number;
  appliedRecords: MigrationRecord[];
}

export interface MigrationStatusReport {
  isUpToDate: boolean;
  totalMigrations: number;
  appliedCount: number;
  pendingCount: number;
  migrations: MigrationRecord[];
  verifiedChecksums: boolean;
}

// In-memory ledger for tests, demo environments, or local runners
const inMemoryAppliedMigrations = new Map<string, MigrationRecord>();

/**
 * Computes deterministic SHA-256 checksum of SQL migration content.
 * Normalizes CRLF to LF to ensure consistent checksums across Windows and Linux environments.
 */
export function computeMigrationChecksum(content: string): string {
  const normalized = content.replace(/\r\n/g, "\n").trim();
  return crypto.createHash("sha256").update(normalized, "utf8").digest("hex");
}

/**
 * Reads and parses all SQL migration files in migrations directory, sorted chronologically.
 */
export function getAvailableMigrationFiles(migrationsDir?: string): MigrationFile[] {
  const dir = migrationsDir || path.join(process.cwd(), "migrations");

  if (!fs.existsSync(dir)) {
    return [];
  }

  const fileNames = fs
    .readdirSync(dir)
    .filter((f) => f.endsWith(".sql"))
    .sort();

  return fileNames.map((name) => {
    const fullPath = path.join(dir, name);
    const sql = fs.readFileSync(fullPath, "utf8");
    const checksum = computeMigrationChecksum(sql);
    return {
      name,
      path: fullPath,
      checksum,
      sql,
    };
  });
}

/**
 * Inspects migration state and checks for pending migrations or checksum tampering.
 */
export async function getMigrationStatus(
  migrationsDir?: string,
  executedRecords?: MigrationRecord[]
): Promise<MigrationStatusReport> {
  const files = getAvailableMigrationFiles(migrationsDir);
  const recordsMap = new Map<string, MigrationRecord>();

  if (executedRecords && executedRecords.length > 0) {
    for (const r of executedRecords) {
      recordsMap.set(r.name, r);
    }
  } else {
    for (const [name, rec] of inMemoryAppliedMigrations.entries()) {
      recordsMap.set(name, rec);
    }
  }

  let verifiedChecksums = true;
  let appliedCount = 0;
  let pendingCount = 0;

  const migrations: MigrationRecord[] = files.map((f) => {
    const existing = recordsMap.get(f.name);
    if (!existing) {
      pendingCount++;
      return {
        name: f.name,
        checksum: f.checksum,
        executedAt: "",
        executionTimeMs: 0,
        status: "pending",
      };
    }

    if (existing.checksum !== f.checksum) {
      verifiedChecksums = false;
      return {
        name: f.name,
        checksum: f.checksum,
        executedAt: existing.executedAt,
        executionTimeMs: existing.executionTimeMs,
        status: "checksum_mismatch",
      };
    }

    appliedCount++;
    return {
      name: f.name,
      checksum: f.checksum,
      executedAt: existing.executedAt,
      executionTimeMs: existing.executionTimeMs,
      status: "applied",
    };
  });

  return {
    isUpToDate: pendingCount === 0 && verifiedChecksums,
    totalMigrations: files.length,
    appliedCount,
    pendingCount,
    migrations,
    verifiedChecksums,
  };
}

/**
 * Executes database migrations idempotently with execution timing and checksum tracking.
 */
export async function runMigrations(options?: {
  migrationsDir?: string;
  dryRun?: boolean;
  executor?: (sql: string, name: string) => Promise<void>;
}): Promise<MigrationRunResult> {
  const startTime = Date.now();
  const files = getAvailableMigrationFiles(options?.migrationsDir);
  const applied: string[] = [];
  const skipped: string[] = [];
  const errors: string[] = [];
  const appliedRecords: MigrationRecord[] = [];

  for (const file of files) {
    const existing = inMemoryAppliedMigrations.get(file.name);

    if (existing) {
      if (existing.checksum !== file.checksum) {
        errors.push(
          `Checksum mismatch for migration ${file.name}. Expected ${existing.checksum}, found ${file.checksum}. Migration file was altered after execution!`
        );
        break;
      }
      skipped.push(file.name);
      continue;
    }

    if (options?.dryRun) {
      applied.push(`[DRY-RUN] ${file.name}`);
      continue;
    }

    const stepStart = Date.now();
    try {
      if (options?.executor) {
        await options.executor(file.sql, file.name);
      }

      const duration = Date.now() - stepStart;
      const record: MigrationRecord = {
        name: file.name,
        checksum: file.checksum,
        executedAt: new Date().toISOString(),
        executionTimeMs: duration,
        status: "applied",
      };

      inMemoryAppliedMigrations.set(file.name, record);
      appliedRecords.push(record);
      applied.push(file.name);
    } catch (err: any) {
      errors.push(`Error executing migration ${file.name}: ${err?.message || String(err)}`);
      break;
    }
  }

  return {
    success: errors.length === 0,
    applied,
    skipped,
    errors,
    totalDurationMs: Date.now() - startTime,
    appliedRecords,
  };
}

/**
 * Resets migration ledger (useful in tests).
 */
export function resetMigrationState(): void {
  inMemoryAppliedMigrations.clear();
}
