import { NextRequest } from "next/server";
import { getAuthenticatedContext } from "@/lib/supabase/auth";
import { internalNotesStore } from "@/lib/notes/internal-notes-store";
import { apiSuccess, apiError } from "@/lib/api-response";

export const runtime = "nodejs";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ pullRequestId: string }> }
) {
  const { pullRequestId } = await params;
  const auth = await getAuthenticatedContext();
  const workspaceId = auth?.workspaceId || "demo-workspace";

  const notes = internalNotesStore.getNotes(workspaceId, pullRequestId);
  return apiSuccess({ notes });
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ pullRequestId: string }> }
) {
  const { pullRequestId } = await params;
  const auth = await getAuthenticatedContext();
  if (!auth) {
    return apiError("UNAUTHORIZED", "Authentication required.", 401);
  }

  let body: any = {};
  try {
    body = await req.json();
  } catch {
    return apiError("INVALID_JSON", "Request body must be valid JSON.", 400);
  }

  const content = (body.content || "").trim();
  if (!content) {
    return apiError("CONTENT_REQUIRED", "Note content cannot be empty.", 400);
  }

  const note = internalNotesStore.createNote(auth.workspaceId, pullRequestId, {
    authorUserId: auth.userId,
    authorName: body.authorName || "Reviewer",
    authorAvatarUrl: body.authorAvatarUrl,
    content,
    filePath: body.filePath,
    line: body.line,
  });

  return apiSuccess({ note }, 201);
}
