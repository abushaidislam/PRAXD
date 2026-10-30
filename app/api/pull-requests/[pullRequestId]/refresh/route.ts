import { NextRequest } from "next/server";
import { getAuthenticatedContext } from "@/lib/supabase/auth";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { syncPullRequestDetails } from "@/lib/github/sync";
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

  const supabase = createServiceRoleClient();
  const { data: rawPr, error } = await supabase
    .from("pull_requests")
    .select(`
      id,
      workspace_id,
      number,
      head_sha,
      repository_id,
      repositories!inner (
        name,
        owner_login,
        installation_id,
        github_installations!inner (
          installation_id,
          status
        )
      )
    `)
    .eq("id", pullRequestId)
    .eq("workspace_id", auth.workspaceId)
    .single();

  const pr = rawPr as any;

  if (error || !pr) {
    return apiError("NOT_FOUND", "Pull request not found or access denied.", 404);
  }

  const repo = pr.repositories;
  const installation = repo.github_installations;

  if (!installation || installation.status !== "active") {
    return apiError("INSTALLATION_INACTIVE", "GitHub installation is inactive or suspended.", 403);
  }

  try {
    await syncPullRequestDetails(supabase, {
      id: pr.id,
      workspace_id: pr.workspace_id,
      number: pr.number,
      head_sha: pr.head_sha || "",
      repository_id: pr.repository_id,
      repo_owner: repo.owner_login,
      repo_name: repo.name,
      github_installation_id: installation.installation_id,
    });

    return apiSuccess({ status: "refreshed", pullRequestId: pr.id });
  } catch (err: any) {
    return apiError("REFRESH_FAILED", err.message || "Failed to refresh PR details from GitHub.", 500);
  }
}
