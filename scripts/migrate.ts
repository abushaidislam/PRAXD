#!/usr/bin/env node
import { getMigrationStatus, runMigrations } from "../lib/db/migrator";

async function main() {
  const args = process.argv.slice(2);
  const isDryRun = args.includes("--dry-run");
  const isStatusOnly = args.includes("--status");

  console.log("=== PRAXD Supabase Database Migration Runner ===");

  if (isStatusOnly) {
    const status = await getMigrationStatus();
    console.log(`Total migrations: ${status.totalMigrations}`);
    console.log(`Applied: ${status.appliedCount}`);
    console.log(`Pending: ${status.pendingCount}`);
    console.log(`Up to date: ${status.isUpToDate}`);
    console.log(`Checksums valid: ${status.verifiedChecksums}`);
    process.exit(status.isUpToDate ? 0 : 1);
  }

  console.log(`Running migrations... (Dry-run: ${isDryRun})`);
  const result = await runMigrations({ dryRun: isDryRun });

  console.log(`Applied: ${result.applied.length > 0 ? result.applied.join(", ") : "none"}`);
  console.log(`Skipped: ${result.skipped.length > 0 ? result.skipped.join(", ") : "none"}`);

  if (result.errors.length > 0) {
    console.error("Migration failed with errors:");
    result.errors.forEach((err) => console.error(` - ${err}`));
    process.exit(1);
  }

  console.log(`Migration completed successfully in ${result.totalDurationMs}ms.`);
  process.exit(0);
}

if (require.main === module) {
  main().catch((err) => {
    console.error("Fatal migration error:", err);
    process.exit(1);
  });
}
