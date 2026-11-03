import { NextRequest } from "next/server";
import { getAuthenticatedContext } from "@/lib/supabase/auth";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { syncRecentAccountPullRequests } from "@/lib/github/sync";
import { apiSuccess, apiError } from "@/lib/api-response";

export async function POST(req: NextRequest) {
  const auth = await getAuthenticatedContext();
  if (!auth) {
    return apiError("UNAUTHORIZED", "Authentication required.", 401);
  }

  const supabase = createServiceRoleClient();
  try {
    const result = await syncRecentAccountPullRequests(supabase, auth.workspaceId);
    return apiSuccess({ status: "synced", ...result });
  } catch (err: any) {
    return apiError(
      "SYNC_FAILED",
      err.message || "Failed to sync pull requests from GitHub.",
      500
    );
  }
}

export async function GET(req: NextRequest) {
  return POST(req);
}
