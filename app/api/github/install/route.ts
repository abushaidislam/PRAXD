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

  const response = NextResponse.redirect(githubInstallUrl);
  // Store signed state in an HTTP-only cookie so that when GitHub redirects to Setup URL (which drops ?state=),
  // the callback can securely verify the initiating user and workspace.
  response.cookies.set("praxd_install_state", state, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 10 * 60, // 10 minutes
    secure: process.env.NODE_ENV === "production",
  });

  return response;
}
