import { NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/server";

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

  return NextResponse.json(
    {
      status: dbStatus === "healthy" ? "healthy" : "degraded",
      version: "0.1.0",
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV || "development",
      checks: {
        database: dbStatus,
        latencyMs: durationMs,
      },
    },
    {
      status: dbStatus === "healthy" ? 200 : 503,
      headers: {
        "Cache-Control": "no-store, max-age=0",
      },
    }
  );
}
