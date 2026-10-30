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

  if (error) {
    return apiSuccess({ files: [] });
  }

  return apiSuccess({ files: files || [] });
}
