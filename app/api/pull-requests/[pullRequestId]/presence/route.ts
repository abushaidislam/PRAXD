import { NextRequest } from "next/server";
import { getAuthenticatedContext } from "@/lib/supabase/auth";
import { presenceBroker, PresenceUser } from "@/lib/realtime/presence";
import { apiSuccess, apiError } from "@/lib/api-response";

export const runtime = "nodejs";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ pullRequestId: string }> }
) {
  const { pullRequestId } = await params;
  const reviewers = presenceBroker.getActiveReviewers(pullRequestId);
  return apiSuccess({ reviewers });
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ pullRequestId: string }> }
) {
  const { pullRequestId } = await params;
  const auth = await getAuthenticatedContext();
  const userId = auth?.userId || "dev-user-0000-0000-000000000001";

  let body: any = {};
  try {
    body = await req.json();
  } catch {
    // Body optional
  }

  const username = body.username || (auth?.isDemo ? "Developer" : "Reviewer");
  const avatarUrl = body.avatarUrl || "https://avatars.githubusercontent.com/u/1024025?v=4";
  const activeView = body.activeView === "summary" ? "summary" : "code";
  const activeFile = body.activeFile || null;
  const activeLine = body.activeLine || null;

  const reviewers = presenceBroker.heartbeat(pullRequestId, {
    userId,
    username,
    avatarUrl,
    role: auth?.role || "owner",
    activeView,
    activeFile,
    activeLine,
  });

  return apiSuccess({ reviewers });
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ pullRequestId: string }> }
) {
  const { pullRequestId } = await params;
  const auth = await getAuthenticatedContext();
  const userId = auth?.userId || "dev-user-0000-0000-000000000001";

  presenceBroker.leave(pullRequestId, userId);
  return apiSuccess({ success: true });
}
