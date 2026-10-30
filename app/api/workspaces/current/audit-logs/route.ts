import { NextRequest } from "next/server";
import { getAuthenticatedContext } from "@/lib/supabase/auth";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { apiSuccess, apiError } from "@/lib/api-response";

export async function GET(req: NextRequest) {
  const auth = await getAuthenticatedContext();
  if (!auth) {
    return apiError("UNAUTHORIZED", "Authentication required.", 401);
  }

  const { searchParams } = new URL(req.url);
  const limitParam = parseInt(searchParams.get("limit") || "50", 10);
  const limit = Math.min(Math.max(1, isNaN(limitParam) ? 50 : limitParam), 100);
  const offsetParam = parseInt(searchParams.get("offset") || "0", 10);
  const offset = Math.max(0, isNaN(offsetParam) ? 0 : offsetParam);

  const supabase = createServiceRoleClient();

  const { data: logs, count, error } = await supabase
    .from("audit_logs")
    .select("*", { count: "exact" })
    .eq("workspace_id", auth.workspaceId)
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) {
    return apiError("QUERY_FAILED", error.message, 500);
  }

  return apiSuccess({
    auditLogs: logs || [],
    pagination: {
      limit,
      offset,
      total: count || 0,
      hasMore: (count || 0) > offset + limit,
    },
  });
}
