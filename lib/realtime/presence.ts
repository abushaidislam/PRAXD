export interface PresenceUser {
  userId: string;
  username: string;
  avatarUrl?: string;
  role?: string;
  activeView: "summary" | "code";
  activeFile?: string | null;
  activeLine?: number | null;
  lastSeen: number;
}

export const PRESENCE_TIMEOUT_MS = 15000; // 15 seconds stale timeout

class PresenceBroker {
  // Map of pullRequestId -> Map of userId -> PresenceUser
  private sessions = new Map<string, Map<string, PresenceUser>>();

  /**
   * Records or updates a user's presence heartbeat on a pull request.
   * Automatically prunes stale reviewers who haven't sent a heartbeat within PRESENCE_TIMEOUT_MS.
   */
  heartbeat(pullRequestId: string, user: Omit<PresenceUser, "lastSeen">): PresenceUser[] {
    if (!this.sessions.has(pullRequestId)) {
      this.sessions.set(pullRequestId, new Map());
    }

    const prSessions = this.sessions.get(pullRequestId)!;
    const now = Date.now();

    // 1. Update current user presence
    prSessions.set(user.userId, {
      ...user,
      lastSeen: now,
    });

    // 2. Prune stale presence
    this.pruneStale(pullRequestId, now);

    return Array.from(prSessions.values());
  }

  /**
   * Returns all active reviewers currently on a pull request.
   */
  getActiveReviewers(pullRequestId: string): PresenceUser[] {
    const prSessions = this.sessions.get(pullRequestId);
    if (!prSessions) return [];

    this.pruneStale(pullRequestId, Date.now());
    return Array.from(prSessions.values());
  }

  /**
   * Explicitly removes a user from a pull request's presence (e.g. when unmounting or navigating away).
   */
  leave(pullRequestId: string, userId: string): void {
    const prSessions = this.sessions.get(pullRequestId);
    if (prSessions) {
      prSessions.delete(userId);
      if (prSessions.size === 0) {
        this.sessions.delete(pullRequestId);
      }
    }
  }

  /**
   * Prunes inactive users whose last heartbeat exceeded timeout.
   */
  private pruneStale(pullRequestId: string, now: number): void {
    const prSessions = this.sessions.get(pullRequestId);
    if (!prSessions) return;

    for (const [userId, user] of prSessions.entries()) {
      if (now - user.lastSeen > PRESENCE_TIMEOUT_MS) {
        prSessions.delete(userId);
      }
    }
  }

  resetAll(): void {
    this.sessions.clear();
  }
}

export const presenceBroker = new PresenceBroker();
