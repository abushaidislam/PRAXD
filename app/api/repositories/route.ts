import { NextRequest } from "next/server";
import { getAuthenticatedContext } from "@/lib/supabase/auth";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { apiPaginated, apiError } from "@/lib/api-response";

export async function GET(req: NextRequest) {
  const auth = await getAuthenticatedContext();
  if (!auth) {
    return apiError("UNAUTHORIZED", "Authentication required.", 401);
  }

  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q");
  const limit = Math.min(parseInt(searchParams.get("limit") || "30", 10), 100);

  const supabase = createServiceRoleClient();
  let query = supabase
    .from("repositories")
    .select("*")
    .eq("workspace_id", auth.workspaceId)
    .eq("is_accessible", true)
    .order("github_updated_at", { ascending: false })
    .limit(limit);

  if (q) {
    query = query.ilike("full_name", `%${q}%`);
  }

  const { data, error } = await query;
  if (error) {
    return apiPaginated([], { nextCursor: null, hasNextPage: false });
  }

  return apiPaginated(data || [], { nextCursor: null, hasNextPage: false });
}
