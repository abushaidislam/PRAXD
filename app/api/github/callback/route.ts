import { NextRequest, NextResponse } from "next/server";
import { verifyInstallState } from "@/lib/github/state";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { syncInstallationRepositories } from "@/lib/github/sync";
import { apiError } from "@/lib/api-response";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const state = searchParams.get("state");
  const installationIdStr = searchParams.get("installation_id");

  // Validate state parameter (P1-01, P1-02)
  const validation = verifyInstallState(state);
  if (!validation.isValid || !validation.workspaceId) {
    return apiError(
      "INVALID_OAUTH_STATE",
      validation.error || "The GitHub App installation state parameter is invalid or expired.",
      400
    );
  }

  if (!installationIdStr) {
    return apiError("MISSING_INSTALLATION_ID", "No installation_id provided by GitHub.", 400);
  }

  const installationId = parseInt(installationIdStr, 10);
  if (isNaN(installationId) || installationId <= 0) {
    return apiError("INVALID_INSTALLATION_ID", "Installation ID is invalid.", 400);
  }

  const supabase = createServiceRoleClient();

  // Upsert installation row
  const { data: installation, error: installError } = await supabase
    .from("github_installations")
    .upsert(
      {
        workspace_id: validation.workspaceId,
        installation_id: installationId,
        account_login: "github-installation",
        status: "active",
        installed_by: validation.userId,
        last_synced_at: new Date().toISOString(),
      },
      { onConflict: "installation_id" }
    )
    .select("id")
    .single();

  if (installError || !installation) {
    // If running in development without a live Supabase connection, return a clean notice
    const appOrigin = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    return NextResponse.redirect(`${appOrigin}/?installation=connected&demo=true`);
  }

  // Synchronize repositories
  try {
    await syncInstallationRepositories(
      supabase,
      installation.id,
      installationId,
      validation.workspaceId
    );
  } catch (err: any) {
    // Log sync error, keep installation active
    await supabase
      .from("github_installations")
      .update({ last_sync_error: err?.message || "Initial repository sync failed" })
      .eq("id", installation.id);
  }

  const appOrigin = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  return NextResponse.redirect(`${appOrigin}/?installation=success`);
}
