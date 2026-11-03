import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedContext } from "@/lib/supabase/auth";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { fetchLivePullRequests } from "@/lib/github/live";
import { syncRecentAccountPullRequests } from "@/lib/github/sync";
import { mapDbPrToDomain } from "@/lib/github/mapper";
import { apiError } from "@/lib/api-response";

let lastSyncTimestamp = 0;
const AUTO_SYNC_COOLDOWN_MS = 30_000; // 30 seconds debounce window for auto-reconciliation

export async function GET(req: NextRequest) {
  const auth = await getAuthenticatedContext();
  if (!auth) {
    return apiError("UNAUTHORIZED", "Authentication required.", 401);
  }

  const { searchParams } = new URL(req.url);
  const view = searchParams.get("view") || "all";
  const state = searchParams.get("state") || "open";
  const q = searchParams.get("q");
  const limit = Math.min(parseInt(searchParams.get("limit") || "24", 10), 100);
  const page = Math.max(parseInt(searchParams.get("page") || "1", 10), 1);
  const offset = (page - 1) * limit;
  const forceSync = searchParams.get("sync") === "true";

  const supabase = createServiceRoleClient();

  // On page 1, automatically reconcile recently created or updated PRs from GitHub across all user repos
  if (page === 1 && (forceSync || (!q && Date.now() - lastSyncTimestamp > AUTO_SYNC_COOLDOWN_MS))) {
    try {
      await syncRecentAccountPullRequests(supabase, auth.workspaceId);
      lastSyncTimestamp = Date.now();
    } catch (syncErr) {
      console.error("Auto GitHub PR reconciliation error:", syncErr);
    }
  }

  let query = supabase
    .from("pull_requests")
    .select(
      `
      *,
      repositories!inner (
        name,
        full_name,
        owner_login,
        is_accessible
      )
    `,
      { count: "exact" }
    )
    .eq("workspace_id", auth.workspaceId)
    .eq("repositories.is_accessible", true)
    .order("github_updated_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (state !== "all") {
    query = query.eq("state", state as "open" | "closed" | "merged");
  }

  if (view === "authored") {
    query = query.eq("author_login", "abushaidislam");
  }

  if (q) {
    query = query.or(`title.ilike.%${q}%,number.eq.${parseInt(q, 10) || 0}`);
  }

  const { data, count, error } = await query;
  if (!error && data && data.length > 0) {
    const formattedPrs = data.map(mapDbPrToDomain);
    const total = count ?? formattedPrs.length;
    const hasMore = offset + formattedPrs.length < total;

    return NextResponse.json({
      data: formattedPrs,
      pagination: {
        page,
        limit,
        total,
        hasMore,
        nextCursor: hasMore ? String(page + 1) : null,
        hasNextPage: hasMore,
      },
    });
  }

  // Graceful fallback: If Supabase table is empty or error, fetch real live PRs directly from GitHub API
  const livePrs = await fetchLivePullRequests({ state, view, q: q || undefined, limit, page });
  const hasMore = livePrs.length >= limit;

  return NextResponse.json({
    data: livePrs,
    pagination: {
      page,
      limit,
      total: livePrs.length,
      hasMore,
      nextCursor: hasMore ? String(page + 1) : null,
      hasNextPage: hasMore,
    },
  });
}
