import { NextRequest } from "next/server";
import { getAuthenticatedContext } from "@/lib/supabase/auth";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { apiSuccess, apiError } from "@/lib/api-response";
import { purgeAllWorkspaceData } from "@/lib/governance/workspace-purge";
import { WorkspaceRole } from "@/lib/auth/rbac";

export async function POST(req: NextRequest) {
  const auth = await getAuthenticatedContext();
  if (!auth) {
    return apiError("UNAUTHORIZED", "Authentication required.", 401);
  }

  const role = (auth.role as WorkspaceRole) || "member";
  // Strict SOC2 requirement: Only the workspace Owner can initiate a total data wipe
  if (role !== "owner") {
    return apiError(
      "PERMISSION_DENIED",
      "Only the workspace Owner can execute a full workspace data purge.",
      403
    );
  }

  let body: any = {};
  try {
    body = await req.json();
  } catch {
    return apiError("BAD_REQUEST", "Confirmation payload required.", 400);
  }

  if (body.confirmWorkspaceId !== auth.workspaceId) {
    return apiError(
      "BAD_REQUEST",
      "Explicit confirmation required: confirmWorkspaceId must match active workspace ID.",
      400
    );
  }

  if (auth.isDemo) {
    const outcome = await purgeAllWorkspaceData({
      workspaceId: auth.workspaceId,
    });
    return apiSuccess({ outcome });
  }

  const supabase = createServiceRoleClient();
  const outcome = await purgeAllWorkspaceData({
    workspaceId: auth.workspaceId,
    supabase,
  });

  return apiSuccess({ outcome });
}
