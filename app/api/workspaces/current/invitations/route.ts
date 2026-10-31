import { NextRequest } from "next/server";
import { getAuthenticatedContext } from "@/lib/supabase/auth";
import { canManageMembers, WorkspaceRole } from "@/lib/auth/rbac";
import { invitationStore } from "@/lib/auth/invitations";
import { apiSuccess, apiError } from "@/lib/api-response";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const auth = await getAuthenticatedContext();
  if (!auth) {
    return apiError("UNAUTHORIZED", "Authentication required.", 401);
  }

  const invitations = invitationStore.getInvitationsForWorkspace(auth.workspaceId);
  return apiSuccess({ invitations });
}

export async function POST(req: NextRequest) {
  const auth = await getAuthenticatedContext();
  if (!auth) {
    return apiError("UNAUTHORIZED", "Authentication required.", 401);
  }

  if (!canManageMembers(auth.role)) {
    return apiError(
      "PERMISSION_DENIED",
      "Only workspace owners and admins can invite members.",
      403
    );
  }

  let body: any = {};
  try {
    body = await req.json();
  } catch {
    return apiError("INVALID_JSON", "Request body must be valid JSON.", 400);
  }

  const email = (body.email || "").trim();
  if (!email || !email.includes("@")) {
    return apiError("INVALID_EMAIL", "A valid email address is required.", 400);
  }

  const role: WorkspaceRole = body.role || "reviewer";
  const validRoles: WorkspaceRole[] = ["admin", "reviewer", "viewer", "member"];
  if (!validRoles.includes(role)) {
    return apiError("INVALID_ROLE", `Role must be one of: ${validRoles.join(", ")}`, 400);
  }

  const invitation = invitationStore.createInvitation({
    workspaceId: auth.workspaceId,
    email,
    role,
    invitedByUserId: auth.userId,
    expiresInDays: 7,
  });

  return apiSuccess(
    {
      invitation,
      inviteUrl: `/invite/accept?token=${encodeURIComponent(invitation.token)}`,
    },
    201
  );
}
