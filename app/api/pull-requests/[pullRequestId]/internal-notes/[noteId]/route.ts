import { NextRequest } from "next/server";
import { getAuthenticatedContext } from "@/lib/supabase/auth";
import { canDeleteNote } from "@/lib/auth/rbac";
import { internalNotesStore } from "@/lib/notes/internal-notes-store";
import { apiSuccess, apiError } from "@/lib/api-response";

export const runtime = "nodejs";

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ pullRequestId: string; noteId: string }> }
) {
  const { pullRequestId, noteId } = await params;
  const auth = await getAuthenticatedContext();
  if (!auth) {
    return apiError("UNAUTHORIZED", "Authentication required.", 401);
  }

  const notes = internalNotesStore.getNotes(auth.workspaceId, pullRequestId);
  const targetNote = notes.find((n) => n.id === noteId);

  if (!targetNote) {
    return apiError("NOT_FOUND", "Internal note not found.", 404);
  }

  if (!canDeleteNote(auth.role, targetNote.authorUserId, auth.userId)) {
    return apiError("PERMISSION_DENIED", "You do not have permission to delete this internal note.", 403);
  }

  internalNotesStore.deleteNote(auth.workspaceId, pullRequestId, noteId);
  return apiSuccess({ success: true, message: "Internal note deleted." });
}
