import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedContext } from "@/lib/supabase/auth";
import { createInstallState } from "@/lib/github/state";
import { apiError } from "@/lib/api-response";

export async function GET(req: NextRequest) {
  const auth = await getAuthenticatedContext();
  if (!auth) {
    return apiError("UNAUTHORIZED", "Authentication required to initiate installation.", 401);
  }

  const appSlug = process.env.GITHUB_APP_SLUG || "praxd";
  const state = createInstallState(auth.userId, auth.workspaceId);

  const githubInstallUrl = `https://github.com/apps/${appSlug}/installations/new?state=${encodeURIComponent(
    state
  )}`;

  return NextResponse.redirect(githubInstallUrl);
}
