import { NextRequest } from "next/server";
import { getAuthenticatedContext } from "@/lib/supabase/auth";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { getActiveInstallation } from "@/lib/github/live";
import { apiSuccess, apiError } from "@/lib/api-response";

export async function GET(req: NextRequest) {
  const auth = await getAuthenticatedContext();
  if (!auth) {
    return apiError("UNAUTHORIZED", "Authentication required.", 401);
  }

  const supabase = createServiceRoleClient();
  const { data: installations, error } = await supabase
    .from("github_installations")
    .select("*")
    .eq("workspace_id", auth.workspaceId);

  if (!error && installations && installations.length > 0) {
    return apiSuccess({ installations });
  }

  // Fallback: Check active installation directly with GitHub API
  const liveInstall = await getActiveInstallation();
  if (liveInstall) {
    return apiSuccess({
      installations: [
        {
          id: `live-install-${liveInstall.id}`,
          workspace_id: auth.workspaceId,
          installation_id: liveInstall.id,
          account_login: liveInstall.login,
          status: "active",
        },
      ],
    });
  }

  return apiSuccess({ installations: [] });
}
