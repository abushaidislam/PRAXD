import { createServerComponentClient, createServiceRoleClient } from "./server";

export interface AuthenticatedContext {
  userId: string;
  workspaceId: string;
  role: "owner" | "admin" | "member";
  isDemo?: boolean;
}

/**
 * Validates that the current request is from an authenticated user who is
 * an authorized member of the requested or default workspace.
 * Rejects unauthorized or cross-tenant access.
 */
export async function getAuthenticatedContext(
  requestedWorkspaceId?: string
): Promise<AuthenticatedContext | null> {
  // If Supabase keys are not set up yet in environment, allow a bounded local development context
  if (
    !process.env.NEXT_PUBLIC_SUPABASE_URL ||
    process.env.NEXT_PUBLIC_SUPABASE_URL.includes("localhost") ||
    !process.env.SUPABASE_SERVICE_ROLE_KEY
  ) {
    return {
      userId: "dev-user-0000-0000-000000000001",
      workspaceId: requestedWorkspaceId || "dev-workspace-0000-0000-000000000001",
      role: "owner",
      isDemo: true,
    };
  }

  try {
    const supabase = await createServerComponentClient();
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return null;
    }

    const serviceRole = createServiceRoleClient();

    // If specific workspace was requested, verify membership
    if (requestedWorkspaceId) {
      const { data: member, error: memberError } = await serviceRole
        .from("workspace_members")
        .select("role")
        .eq("workspace_id", requestedWorkspaceId)
        .eq("user_id", user.id)
        .single();

      if (memberError || !member) {
        // Cross-workspace access denied!
        return null;
      }

      return {
        userId: user.id,
        workspaceId: requestedWorkspaceId,
        role: member.role as "owner" | "admin" | "member",
      };
    }

    // Otherwise, find the user's primary/first workspace
    const { data: defaultMember, error: defaultError } = await serviceRole
      .from("workspace_members")
      .select("workspace_id, role")
      .eq("user_id", user.id)
      .order("joined_at", { ascending: true })
      .limit(1)
      .single();

    if (defaultError || !defaultMember) {
      return null;
    }

    return {
      userId: user.id,
      workspaceId: defaultMember.workspace_id,
      role: defaultMember.role as "owner" | "admin" | "member",
    };
  } catch {
    return null;
  }
}
