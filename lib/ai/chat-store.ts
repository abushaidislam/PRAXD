import { ChatMessage } from "@/types/chat";

/**
 * In-memory storage for PR chat sessions scoped by workspace and pull request ID.
 * Follows the pattern established by liveReviewsStore in lib/ai/lifecycle.ts.
 */
class ChatStore {
  private store = new Map<string, ChatMessage[]>();

  private getKey(workspaceId: string, pullRequestId: string): string {
    return `${workspaceId}:${pullRequestId}`;
  }

  getMessages(workspaceId: string, pullRequestId: string): ChatMessage[] {
    const key = this.getKey(workspaceId, pullRequestId);
    return this.store.get(key) || [];
  }

  appendMessage(workspaceId: string, pullRequestId: string, message: ChatMessage): ChatMessage {
    const key = this.getKey(workspaceId, pullRequestId);
    const existing = this.store.get(key) || [];
    const updated = [...existing, message];
    this.store.set(key, updated);
    return message;
  }

  updateMessage(
    workspaceId: string,
    pullRequestId: string,
    messageId: string,
    updates: Partial<ChatMessage>
  ): ChatMessage | null {
    const key = this.getKey(workspaceId, pullRequestId);
    const existing = this.store.get(key) || [];
    const idx = existing.findIndex((m) => m.id === messageId);
    if (idx === -1) return null;

    const updatedMsg = { ...existing[idx], ...updates };
    existing[idx] = updatedMsg;
    this.store.set(key, existing);
    return updatedMsg;
  }

  clearMessages(workspaceId: string, pullRequestId: string): void {
    const key = this.getKey(workspaceId, pullRequestId);
    this.store.delete(key);
  }

  resetAll(): void {
    this.store.clear();
  }
}

export const chatStore = new ChatStore();
