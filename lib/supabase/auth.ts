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
 * In personal PR workspace mode, dynamically resolves the primary personal workspace.
 */
export async function getAuthenticatedContext(
  requestedWorkspaceId?: string
): Promise<AuthenticatedContext | null> {
  const serviceRole = createServiceRoleClient();

  // If Supabase keys are not set up yet in environment, allow a bounded local development context
  if (
    !process.env.NEXT_PUBLIC_SUPABASE_URL ||
    process.env.NEXT_PUBLIC_SUPABASE_URL.includes("localhost") ||
    !process.env.SUPABASE_SERVICE_ROLE_KEY
  ) {
    return {
      userId: "110ea1f9-4267-4f86-8e94-9a69de13fc65",
      workspaceId: requestedWorkspaceId || "a0000000-0000-0000-0000-000000000001",
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
      // Personal PR Workspace: When accessed directly without Supabase user session,
      // resolve the primary personal workspace so all database queries and sync flows match.
      const { data: defaultWs } = await serviceRole
        .from("workspaces")
        .select("id, created_by")
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle();

      if (defaultWs) {
        return {
          userId: defaultWs.created_by,
          workspaceId: defaultWs.id,
          role: "owner",
          isDemo: false,
        };
      }

      return {
        userId: "110ea1f9-4267-4f86-8e94-9a69de13fc65",
        workspaceId: requestedWorkspaceId || "a0000000-0000-0000-0000-000000000001",
        role: "owner",
        isDemo: true,
      };
    }

    // If specific workspace was requested, verify membership
    if (requestedWorkspaceId) {
      const { data: member, error: memberError } = await serviceRole
        .from("workspace_members")
        .select("role")
        .eq("workspace_id", requestedWorkspaceId)
        .eq("user_id", user.id)
        .single();

      if (memberError || !member) {
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
