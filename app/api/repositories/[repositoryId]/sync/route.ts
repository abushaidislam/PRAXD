import { NextRequest } from "next/server";
import { getAuthenticatedContext } from "@/lib/supabase/auth";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { syncRepositoryPullRequests } from "@/lib/github/sync";
import { apiSuccess, apiError } from "@/lib/api-response";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ repositoryId: string }> }
) {
  const { repositoryId } = await params;
  const auth = await getAuthenticatedContext();
  if (!auth) {
    return apiError("UNAUTHORIZED", "Authentication required.", 401);
  }

  const supabase = createServiceRoleClient();

  // Verify repository belongs to workspace (tenant isolation)
  const { data: rawRepo, error } = await supabase
    .from("repositories")
    .select(`
      id,
      workspace_id,
      installation_id,
      owner_login,
      name,
      github_installations!inner (
        installation_id,
        status
      )
    `)
    .eq("id", repositoryId)
    .eq("workspace_id", auth.workspaceId)
    .single();

  const repo = rawRepo as any;

  if (error || !repo) {
    return apiError("NOT_FOUND", "Repository not found or access denied.", 404);
  }

  const githubInstallation = repo.github_installations;
  if (!githubInstallation || githubInstallation.status !== "active") {
    return apiError("INSTALLATION_SUSPENDED", "GitHub App installation is inactive.", 403);
  }

  try {
    const result = await syncRepositoryPullRequests(supabase, {
      id: repo.id,
      workspace_id: repo.workspace_id,
      installation_id: repo.installation_id,
      github_installation_id: githubInstallation.installation_id,
      owner_login: repo.owner_login,
      name: repo.name,
    });

    return apiSuccess({ status: "synced", syncedCount: result.syncedCount });
  } catch (err: any) {
    return apiError("SYNC_FAILED", err.message || "Failed to sync pull requests from GitHub.", 500);
  }
}
