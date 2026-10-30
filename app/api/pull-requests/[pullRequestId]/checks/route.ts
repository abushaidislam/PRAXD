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

  // First get the PR's current head_sha (Strict requirement P1-09)
  const { data: pr, error: prError } = await supabase
    .from("pull_requests")
    .select("head_sha")
    .eq("id", pullRequestId)
    .eq("workspace_id", auth.workspaceId)
    .single();

  if (prError || !pr) {
    return apiError("NOT_FOUND", "Pull request not found.", 404);
  }

  // Only return checks whose head_sha matches the current PR head_sha
  const { data: checks, error } = await supabase
    .from("check_runs")
    .select("*")
    .eq("pull_request_id", pullRequestId)
    .eq("head_sha", pr.head_sha || "")
    .eq("workspace_id", auth.workspaceId)
    .order("started_at", { ascending: false });

  if (error) {
    return apiSuccess({ checks: [] });
  }

  return apiSuccess({ checks: checks || [] });
}
