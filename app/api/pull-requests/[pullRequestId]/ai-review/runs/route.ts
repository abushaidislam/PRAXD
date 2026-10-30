import { NextRequest } from "next/server";
import { getAuthenticatedContext } from "@/lib/supabase/auth";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { apiSuccess, apiError } from "@/lib/api-response";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ pullRequestId: string }> }
) {
  const { pullRequestId } = await params;
  const auth = await getAuthenticatedContext();
  if (!auth) {
    return apiError("UNAUTHORIZED", "Authentication required.", 401);
  }

  const supabase = createServiceRoleClient();
  const { data: runs, error } = await supabase
    .from("ai_review_runs")
    .select("id, head_sha, status, provider, model, summary, overall_risk, findings_count, created_at, completed_at")
    .eq("pull_request_id", pullRequestId)
    .eq("workspace_id", auth.workspaceId)
    .order("created_at", { ascending: false });

  if (error) {
    return apiSuccess({ runs: [] });
  }

  return apiSuccess({ runs: runs || [] });
}
