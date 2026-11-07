import { NextRequest } from "next/server";
import { getAuthenticatedContext } from "@/lib/supabase/auth";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { fetchLivePullRequestDetails } from "@/lib/github/live";
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

  // Handle live PR files
  if (pullRequestId.startsWith("live__")) {
    const parts = pullRequestId.split("__");
    if (parts.length === 4) {
      const owner = parts[1];
      const repo = parts[2];
      const pullNumber = parseInt(parts[3], 10);
      if (!isNaN(pullNumber) && owner && repo) {
        const livePr = await fetchLivePullRequestDetails(owner, repo, pullNumber);
        if (livePr) {
          return apiSuccess({ files: livePr.files });
        }
      }
    }
  }

  const supabase = createServiceRoleClient();
  const { data: files, error } = await supabase
    .from("pull_request_files")
    .select("*")
    .eq("pull_request_id", pullRequestId)
    .eq("workspace_id", auth.workspaceId)
    .order("file_path", { ascending: true });

  if (!error && files && files.length > 0) {
    return apiSuccess({ files });
  }

  // Fallback: If DB files table hasn't been populated yet, fetch directly from GitHub
  // Explicitly filter by workspace_id to prevent cross-tenant data access (IDOR)
  const { data: rawPr } = await supabase
    .from("pull_requests")
    .select("number, repositories(owner_login, name)")
    .eq("id", pullRequestId)
    .eq("workspace_id", auth.workspaceId)
    .maybeSingle();

  const pr = rawPr as any;
  if (pr && pr.repositories?.owner_login && pr.repositories?.name) {
    const livePr = await fetchLivePullRequestDetails(
      pr.repositories.owner_login,
      pr.repositories.name,
      pr.number
    );
    if (livePr && livePr.files && livePr.files.length > 0) {
      return apiSuccess({ files: livePr.files });
    }
  }

  return apiSuccess({ files: files || [] });
}
