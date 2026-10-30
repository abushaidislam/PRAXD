import { NextRequest, NextResponse } from "next/server";
import { verifyInstallState } from "@/lib/github/state";
import { getAuthenticatedContext } from "@/lib/supabase/auth";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { syncInstallationRepositories } from "@/lib/github/sync";
import { getInstallationDetails } from "@/lib/github/app-auth";
import { apiError } from "@/lib/api-response";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const stateParam = searchParams.get("state");
  const cookieState = req.cookies.get("praxd_install_state")?.value;
  const installationIdStr = searchParams.get("installation_id");

  const appOrigin =
    req.nextUrl.origin || process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

  if (!installationIdStr) {
    return apiError("MISSING_INSTALLATION_ID", "No installation_id provided by GitHub.", 400);
  }

  const installationId = parseInt(installationIdStr, 10);
  if (isNaN(installationId) || installationId <= 0) {
    return apiError("INVALID_INSTALLATION_ID", "Installation ID is invalid.", 400);
  }

  // 1. Resolve initiating user & workspace context
  // First, check state parameter from query string or HTTP-only installation cookie
  let userId: string | undefined;
  let workspaceId: string | undefined;

  const rawState = stateParam || cookieState;
  if (rawState) {
    const validation = verifyInstallState(rawState);
    if (validation.isValid && validation.workspaceId && validation.userId) {
      userId = validation.userId;
      workspaceId = validation.workspaceId;
    }
  }

  // 2. If state was not returned (GitHub Setup URL drops ?state= when redirected from installations/new),
  // fallback to the active authenticated session or demo context
  if (!workspaceId || !userId) {
    const auth = await getAuthenticatedContext();
    if (auth) {
      userId = auth.userId;
      workspaceId = auth.workspaceId;
    }
  }

  if (!workspaceId || !userId) {
    return apiError(
      "INVALID_OAUTH_STATE",
      "The GitHub App installation state parameter is invalid or missing, and no active user session was found.",
      400
    );
  }

  // 3. Verify installation details from GitHub API to retrieve canonical account login
  let accountLogin = "github-installation";
  try {
    const installInfo = await getInstallationDetails(installationId);
    if (installInfo) {
      accountLogin = installInfo.account.login;
    }
  } catch {
    // Keep fallback account login if GitHub App credentials are not active yet
  }

  const supabase = createServiceRoleClient();

  // Upsert installation row
  const { data: installation, error: installError } = await supabase
    .from("github_installations")
    .upsert(
      {
        workspace_id: workspaceId,
        installation_id: installationId,
        account_login: accountLogin,
        status: "active",
        installed_by: userId,
        last_synced_at: new Date().toISOString(),
      },
      { onConflict: "installation_id" }
    )
    .select("id")
    .single();

  const redirectResponse = (url: string) => {
    const res = NextResponse.redirect(url);
    res.cookies.delete("praxd_install_state");
    return res;
  };

  if (installError || !installation) {
    // If running in development without a live Supabase connection, return a clean notice
    return redirectResponse(`${appOrigin}/?installation=connected&demo=true`);
  }

  // Synchronize repositories
  try {
    await syncInstallationRepositories(
      supabase,
      installation.id,
      installationId,
      workspaceId
    );
  } catch (err: any) {
    // Log sync error, keep installation active
    await supabase
      .from("github_installations")
      .update({ last_sync_error: err?.message || "Initial repository sync failed" })
      .eq("id", installation.id);
  }

  return redirectResponse(`${appOrigin}/?installation=success`);
}
