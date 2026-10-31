import { NextRequest } from "next/server";
import { getAuthenticatedContext } from "@/lib/supabase/auth";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { apiSuccess, apiError } from "@/lib/api-response";
import { purgeExpiredDiffs } from "@/lib/governance/retention";
import { canManagePolicy, WorkspaceRole } from "@/lib/auth/rbac";

export async function POST(req: NextRequest) {
  const auth = await getAuthenticatedContext();
  if (!auth) {
    return apiError("UNAUTHORIZED", "Authentication required.", 401);
  }

  const role = (auth.role as WorkspaceRole) || "member";
  if (!canManagePolicy(role)) {
    return apiError(
      "PERMISSION_DENIED",
      "Only workspace owners and admins can trigger patch retention purges.",
      403
    );
  }

  let retentionDays: number | undefined;
  try {
    const body = await req.json().catch(() => ({}));
    if (typeof body.retentionDays === "number") {
      retentionDays = body.retentionDays;
    }
  } catch {
    // Ignore JSON parse errors for empty bodies
  }

  if (auth.isDemo) {
    const result = await purgeExpiredDiffs({
      workspaceId: auth.workspaceId,
      retentionDays,
    });
    return apiSuccess({ result });
  }

  const supabase = createServiceRoleClient();
  const result = await purgeExpiredDiffs({
    workspaceId: auth.workspaceId,
    retentionDays,
    supabase,
  });

  return apiSuccess({ result });
}
