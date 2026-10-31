import { NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { getKmsStatus } from "@/lib/security/kms";
import { getMigrationStatus } from "@/lib/db/migrator";

export const dynamic = "force-dynamic";

export async function GET() {
  const startTime = Date.now();
  let dbStatus = "healthy";

  try {
    const supabase = createServiceRoleClient();
    // Simple ping query to confirm PostgreSQL connectivity
    const { error } = await supabase.from("workspaces").select("id").limit(1);
    if (error) {
      dbStatus = `degraded: ${error.message}`;
    }
  } catch (err: any) {
    dbStatus = `unreachable: ${err.message}`;
  }

  const durationMs = Date.now() - startTime;
  const kmsStatus = getKmsStatus();
  let migrationStatus = { isUpToDate: true, pendingCount: 0 };

  try {
    const migReport = await getMigrationStatus();
    migrationStatus = {
      isUpToDate: migReport.isUpToDate,
      pendingCount: migReport.pendingCount,
    };
  } catch {
    // If running in restricted or mock environment
  }

  const isHealthy = dbStatus === "healthy" && kmsStatus.operational;

  return NextResponse.json(
    {
      status: isHealthy ? "healthy" : "degraded",
      version: "0.6.0",
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV || "development",
      checks: {
        database: dbStatus,
        latencyMs: durationMs,
        kms: {
          operational: kmsStatus.operational,
          provider: kmsStatus.provider,
          algorithm: kmsStatus.algorithm,
        },
        migrations: migrationStatus,
      },
    },
    {
      status: isHealthy ? 200 : 503,
      headers: {
        "Cache-Control": "no-store, max-age=0",
      },
    }
  );
}
