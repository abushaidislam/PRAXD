import { createServiceRoleClient } from "@/lib/supabase/server";

export interface GitHubUserProfile {
  id: string;
  login: string;
  name: string | null;
  avatarUrl: string;
  email: string | null;
}

export interface WorkspaceOnboardingResult {
  userId: string;
  workspaceId: string;
  isNewUser: boolean;
  isNewWorkspace: boolean;
  profile: GitHubUserProfile;
}

/**
 * Hydrates user profile and provisions a default workspace upon GitHub SSO.
 */
export async function onboardGitHubUser(
  profile: GitHubUserProfile,
  supabaseClient?: any
): Promise<WorkspaceOnboardingResult> {
  const supabase = supabaseClient || createServiceRoleClient();

  // 1. Upsert user profile
  let isNewUser = false;
  try {
    const { data: existingProfile } = await supabase
      .from("profiles")
      .select("id")
      .eq("id", profile.id)
      .maybeSingle();

    if (!existingProfile) {
      isNewUser = true;
      await supabase.from("profiles").insert({
        id: profile.id,
        display_name: profile.name || profile.login,
        avatar_url: profile.avatarUrl,
        updated_at: new Date().toISOString(),
      });
    } else {
      await supabase
        .from("profiles")
        .update({
          display_name: profile.name || profile.login,
          avatar_url: profile.avatarUrl,
          updated_at: new Date().toISOString(),
        })
        .eq("id", profile.id);
    }
  } catch {
    // In-memory or offline fallback
  }

  // 2. Check existing workspace membership
  let workspaceId = `ws-${profile.login}`;
  let isNewWorkspace = false;

  try {
    const { data: existingMember } = await supabase
      .from("workspace_members")
      .select("workspace_id")
      .eq("user_id", profile.id)
      .order("joined_at", { ascending: true })
      .limit(1)
      .maybeSingle();

    if (existingMember?.workspace_id) {
      workspaceId = existingMember.workspace_id;
    } else {
      // 3. Provision default workspace for user
      isNewWorkspace = true;
      const workspaceName = `${profile.name || profile.login}'s Workspace`;
      const workspaceSlug = profile.login.toLowerCase().replace(/[^a-z0-9_-]/g, "");

      const { data: newWs } = await supabase
        .from("workspaces")
        .insert({
          name: workspaceName,
          slug: workspaceSlug,
          created_by: profile.id,
        })
        .select("id")
        .single();

      if (newWs?.id) {
        workspaceId = newWs.id;
      }

      await supabase.from("workspace_members").insert({
        workspace_id: workspaceId,
        user_id: profile.id,
        role: "owner",
      });
    }
  } catch {
    // Fall back to workspaceId default
  }

  return {
    userId: profile.id,
    workspaceId,
    isNewUser,
    isNewWorkspace,
    profile,
  };
}
