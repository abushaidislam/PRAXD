import { NextRequest } from "next/server";
import { getAuthenticatedContext } from "@/lib/supabase/auth";
import { apiSuccess, apiError } from "@/lib/api-response";

export async function GET(req: NextRequest) {
  const auth = await getAuthenticatedContext();
  if (!auth) {
    return apiError("UNAUTHORIZED", "User must be authenticated.", 401);
  }

  return apiSuccess({
    id: auth.workspaceId,
    name: "Primary Workspace",
    slug: "praxd-main",
    role: auth.role,
    isDemo: !!auth.isDemo,
  });
}
