import { NextRequest } from "next/server";
import { getAuthenticatedContext } from "@/lib/supabase/auth";
import { chatStore } from "@/lib/ai/chat-store";
import { apiSuccess, apiError } from "@/lib/api-response";

export const runtime = "nodejs";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ pullRequestId: string }> }
) {
  const { pullRequestId } = await params;
  const auth = await getAuthenticatedContext();
  const workspaceId = auth?.workspaceId || "demo-workspace";

  const messages = chatStore.getMessages(workspaceId, pullRequestId);
  return apiSuccess({ messages });
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ pullRequestId: string }> }
) {
  const { pullRequestId } = await params;
  const auth = await getAuthenticatedContext();
  const workspaceId = auth?.workspaceId || "demo-workspace";

  chatStore.clearMessages(workspaceId, pullRequestId);
  return apiSuccess({ success: true, message: "Chat history cleared." });
}
