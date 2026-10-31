import { NextRequest } from "next/server";
import { getAuthenticatedContext } from "@/lib/supabase/auth";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { triggerAiReview, liveReviewsStore } from "@/lib/ai/lifecycle";
import { apiSuccess, apiError } from "@/lib/api-response";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ pullRequestId: string }> }
) {
  const { pullRequestId } = await params;
  const auth = await getAuthenticatedContext();
  if (!auth) {
    return apiError("UNAUTHORIZED", "Authentication required.", 401);
  }

  let body: any = {};
  try {
    body = await req.json();
  } catch {
    // Body optional
  }

  try {
    const supabase = createServiceRoleClient();
    const result = await triggerAiReview(supabase, {
      workspaceId: auth.workspaceId,
      pullRequestId,
      userId: auth.userId,
      preferredModel: body.model,
    });

    return apiSuccess(result, result.isExistingActiveRun ? 200 : 202);
  } catch (err: any) {
    return apiError("REVIEW_TRIGGER_FAILED", err.message || "Failed to trigger AI review.", 400);
  }
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ pullRequestId: string }> }
) {
  const { pullRequestId } = await params;
  const auth = await getAuthenticatedContext();
  if (!auth) {
    return apiError("UNAUTHORIZED", "Authentication required.", 401);
  }

  // Handle live PRs from in-memory review store
  if (pullRequestId.startsWith("live__")) {
    const liveData = liveReviewsStore.get(pullRequestId);
    if (liveData) {
      return apiSuccess({
        run: liveData.run,
        findings: liveData.findings,
      });
    }
    return apiSuccess({ run: null, findings: [] });
  }

  const supabase = createServiceRoleClient();

  // Fetch PR current head_sha
  const { data: pr } = await supabase
    .from("pull_requests")
    .select("head_sha")
    .eq("id", pullRequestId)
    .eq("workspace_id", auth.workspaceId)
    .single();

  if (!pr) {
    return apiError("NOT_FOUND", "Pull request not found.", 404);
  }

  // Fetch latest review run matching current head_sha
  const { data: run } = await supabase
    .from("ai_review_runs")
    .select("*")
    .eq("pull_request_id", pullRequestId)
    .eq("head_sha", pr.head_sha || "")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!run) {
    return apiSuccess({ run: null, findings: [] });
  }

  // Fetch validated findings for this run
  const { data: findings } = await supabase
    .from("ai_findings")
    .select("*")
    .eq("review_run_id", run.id)
    .order("created_at", { ascending: true });

  return apiSuccess({
    run,
    findings: findings || [],
  });
}
