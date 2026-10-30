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
  const view = searchParams.get("view") || "all";
  const state = searchParams.get("state") || "open";
  const q = searchParams.get("q");
  const limit = Math.min(parseInt(searchParams.get("limit") || "50", 10), 100);

  const supabase = createServiceRoleClient();
  let query = supabase
    .from("pull_requests")
    .select(`
      *,
      repositories!inner (
        name,
        full_name,
        owner_login,
        is_accessible
      )
    `)
    .eq("workspace_id", auth.workspaceId)
    .eq("repositories.is_accessible", true)
    .order("github_updated_at", { ascending: false })
    .limit(limit);

  if (state !== "all") {
    query = query.eq("state", state as "open" | "closed" | "merged");
  }

  if (view === "authored") {
    // Authored by current user login (e.g. from session or profile)
    query = query.eq("author_login", "abushaidislam");
  }

  if (q) {
    query = query.or(`title.ilike.%${q}%,number.eq.${parseInt(q, 10) || 0}`);
  }

  const { data, error } = await query;
  if (error) {
    return apiPaginated([], { nextCursor: null, hasNextPage: false });
  }

  return apiPaginated(data || [], { nextCursor: null, hasNextPage: false });
}
