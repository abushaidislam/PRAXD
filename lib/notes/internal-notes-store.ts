export interface InternalNote {
  id: string;
  pullRequestId: string;
  workspaceId: string;
  authorUserId: string;
  authorName: string;
  authorAvatarUrl?: string;
  content: string;
  mentions: string[];
  filePath?: string | null;
  line?: number | null;
  createdAt: string;
  updatedAt: string;
}

/**
 * Extracts @mentions from markdown text (e.g. `@alice`, `@bob-dev`).
 */
export function extractMentions(text: string): string[] {
  const matches = text.match(/@([a-zA-Z0-9_\-]+)/g);
  if (!matches) return [];
  const unique = new Set(matches.map((m) => m.slice(1)));
  return Array.from(unique);
}

class InternalNotesStore {
  // Map of workspaceId:pullRequestId -> InternalNote[]
  private store = new Map<string, InternalNote[]>();

  private getKey(workspaceId: string, pullRequestId: string): string {
    return `${workspaceId}:${pullRequestId}`;
  }

  getNotes(workspaceId: string, pullRequestId: string): InternalNote[] {
    const key = this.getKey(workspaceId, pullRequestId);
    return this.store.get(key) || [];
  }

  createNote(
    workspaceId: string,
    pullRequestId: string,
    params: {
      authorUserId: string;
      authorName: string;
      authorAvatarUrl?: string;
      content: string;
      filePath?: string | null;
      line?: number | null;
    }
  ): InternalNote {
    const key = this.getKey(workspaceId, pullRequestId);
    const existing = this.store.get(key) || [];
    const now = new Date().toISOString();

    const note: InternalNote = {
      id: `note-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      pullRequestId,
      workspaceId,
      authorUserId: params.authorUserId,
      authorName: params.authorName,
      authorAvatarUrl: params.authorAvatarUrl,
      content: params.content,
      mentions: extractMentions(params.content),
      filePath: params.filePath || null,
      line: params.line || null,
      createdAt: now,
      updatedAt: now,
    };

    this.store.set(key, [...existing, note]);
    return note;
  }

  deleteNote(workspaceId: string, pullRequestId: string, noteId: string): boolean {
    const key = this.getKey(workspaceId, pullRequestId);
    const existing = this.store.get(key) || [];
    const filtered = existing.filter((n) => n.id !== noteId);
    if (filtered.length === existing.length) return false;

    this.store.set(key, filtered);
    return true;
  }

  resetAll(): void {
    this.store.clear();
  }
}

export const internalNotesStore = new InternalNotesStore();
