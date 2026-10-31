import { NextRequest } from "next/server";
import { getAuthenticatedContext } from "@/lib/supabase/auth";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { apiSuccess, apiError } from "@/lib/api-response";
import { fetchWorkspaceDoraMetrics, calculateDoraMetrics } from "@/lib/analytics/dora";

export async function GET(req: NextRequest) {
  const auth = await getAuthenticatedContext();
  if (!auth) {
    return apiError("UNAUTHORIZED", "Authentication required.", 401);
  }

  if (auth.isDemo) {
    const metrics = calculateDoraMetrics({ pullRequests: [] });
    return apiSuccess({ metrics });
  }

  const supabase = createServiceRoleClient();
  const metrics = await fetchWorkspaceDoraMetrics(supabase, auth.workspaceId);

  return apiSuccess({ metrics });
}
