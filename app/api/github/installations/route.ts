import { NextRequest } from "next/server";
import { getAuthenticatedContext } from "@/lib/supabase/auth";
import { createServiceRoleClient } from "@/lib/supabase/server";
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

  if (error) {
    return apiSuccess({ installations: [] });
  }

  return apiSuccess({ installations: installations || [] });
}
