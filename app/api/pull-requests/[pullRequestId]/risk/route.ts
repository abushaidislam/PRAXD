import { NextRequest } from "next/server";
import { getAuthenticatedContext } from "@/lib/supabase/auth";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { apiSuccess, apiError } from "@/lib/api-response";
import { computeRiskScore } from "@/lib/policy/risk-scoring";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ pullRequestId: string }> }
) {
  const auth = await getAuthenticatedContext();
  if (!auth) {
    return apiError("UNAUTHORIZED", "Authentication required.", 401);
  }

  const { pullRequestId } = await params;
  if (!pullRequestId) {
    return apiError("BAD_REQUEST", "Pull request ID is required.", 400);
  }

  const supabase = createServiceRoleClient();

  // Retrieve PR
  const { data: pr, error: prError } = await supabase
    .from("pull_requests")
    .select("id, additions, deletions, repository_id")
    .eq("id", pullRequestId)
    .eq("workspace_id", auth.workspaceId)
    .maybeSingle();

  if (prError || !pr) {
    // If not found in DB, could be a fixture or not found
    return apiError("NOT_FOUND", "Pull request not found.", 404);
  }

  // Retrieve files
  const { data: files } = await supabase
    .from("pull_request_files")
    .select("file_path, additions, deletions")
    .eq("pull_request_id", pullRequestId);

  // Retrieve existing AI findings from latest review run
  const { data: latestRun } = await supabase
    .from("ai_review_runs")
    .select("id")
    .eq("pull_request_id", pullRequestId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  let findings: Array<{ severity: string }> = [];
  if (latestRun) {
    const { data: runFindings } = await supabase
      .from("ai_findings")
      .select("severity")
      .eq("review_run_id", latestRun.id);
    findings = (runFindings || []).map((f) => ({ severity: f.severity }));
  }

  const risk = computeRiskScore({
    additions: pr.additions || 0,
    deletions: pr.deletions || 0,
    files: (files || []).map((f) => ({
      path: f.file_path,
      additions: f.additions || 0,
      deletions: f.deletions || 0,
    })),
    findings,
  });

  return apiSuccess({ risk });
}
