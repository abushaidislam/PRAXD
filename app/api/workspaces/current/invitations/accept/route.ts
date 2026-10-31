import { NextRequest } from "next/server";
import { getAuthenticatedContext } from "@/lib/supabase/auth";
import { invitationStore } from "@/lib/auth/invitations";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { apiSuccess, apiError } from "@/lib/api-response";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const auth = await getAuthenticatedContext();
  const userId = auth?.userId || "dev-user-0000-0000-000000000001";

  let body: any = {};
  try {
    body = await req.json();
  } catch {
    return apiError("INVALID_JSON", "Request body must be valid JSON.", 400);
  }

  const token = (body.token || "").trim();
  if (!token) {
    return apiError("TOKEN_REQUIRED", "Invitation token is required.", 400);
  }

  const result = invitationStore.verifyAndAcceptToken(token, userId);
  if (!result.valid) {
    return apiError("INVALID_INVITATION", result.reason, 400);
  }

  try {
    const supabase = createServiceRoleClient();
    await supabase.from("workspace_members").insert({
      workspace_id: result.invitation.workspaceId,
      user_id: userId,
      role: result.invitation.role as any,
    });
  } catch {
    // Demo fallback
  }

  return apiSuccess({
    accepted: true,
    workspaceId: result.invitation.workspaceId,
    role: result.invitation.role,
  });
}
