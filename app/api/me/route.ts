import { NextRequest } from "next/server";
import { getAuthenticatedContext } from "@/lib/supabase/auth";
import { apiSuccess, apiError } from "@/lib/api-response";

export async function GET(req: NextRequest) {
  const auth = await getAuthenticatedContext();
  if (!auth) {
    return apiError("UNAUTHORIZED", "User must be authenticated.", 401);
  }

  return apiSuccess({
    user: {
      id: auth.userId,
      login: "abushaidislam",
      displayName: "Abu Shaid Islam",
      avatarUrl: "https://avatars.githubusercontent.com/u/1024025?v=4",
    },
    workspace: {
      id: auth.workspaceId,
      role: auth.role,
      isDemo: !!auth.isDemo,
    },
  });
}
