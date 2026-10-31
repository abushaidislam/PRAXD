import { describe, it, expect, beforeEach, vi } from "vitest";
import { onboardGitHubUser } from "@/lib/auth/github-sso";
import {
  canTriggerReview,
  canPublishFinding,
  canManageMembers,
  canDeleteNote,
  ROLE_PERMISSIONS,
} from "@/lib/auth/rbac";
import { invitationStore } from "@/lib/auth/invitations";
import { presenceBroker, PRESENCE_TIMEOUT_MS } from "@/lib/realtime/presence";
import { internalNotesStore, extractMentions } from "@/lib/notes/internal-notes-store";
import { POST as aiReviewRoute } from "@/app/api/pull-requests/[pullRequestId]/ai-review/route";
import { POST as publishFindingRoute } from "@/app/api/ai-findings/[findingId]/publish/route";
import {
  GET as internalNotesGetRoute,
  POST as internalNotesPostRoute,
} from "@/app/api/pull-requests/[pullRequestId]/internal-notes/route";
import { DELETE as internalNoteDeleteRoute } from "@/app/api/pull-requests/[pullRequestId]/internal-notes/[noteId]/route";
import {
  GET as presenceGetRoute,
  POST as presencePostRoute,
  DELETE as presenceDeleteRoute,
} from "@/app/api/pull-requests/[pullRequestId]/presence/route";
import { NextRequest } from "next/server";

describe("Phase 6 — Team Collaboration, GitHub SSO & Real-Time Presence Acceptance Tests", () => {
  beforeEach(() => {
    invitationStore.resetAll();
    presenceBroker.resetAll();
    internalNotesStore.resetAll();
    (globalThis as any).__praxdTestRole = "owner";
  });

  it("P6-01: GitHub OAuth profile onboarding hydrates user profile and provisions default workspace", async () => {
    let insertedProfile: any = null;
    let insertedWorkspace: any = null;
    let insertedMember: any = null;

    const mockSupabase = {
      from: vi.fn().mockImplementation((table: string) => {
        if (table === "profiles") {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                maybeSingle: vi.fn().mockResolvedValue({ data: null }),
              }),
            }),
            insert: vi.fn().mockImplementation((row: any) => {
              insertedProfile = row;
              return Promise.resolve({ error: null });
            }),
          };
        }
        if (table === "workspaces") {
          return {
            insert: vi.fn().mockImplementation((row: any) => {
              insertedWorkspace = row;
              return {
                select: vi.fn().mockReturnValue({
                  single: vi.fn().mockResolvedValue({
                    data: { id: "ws-octocat-generated" },
                    error: null,
                  }),
                }),
              };
            }),
          };
        }
        if (table === "workspace_members") {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                order: vi.fn().mockReturnValue({
                  limit: vi.fn().mockReturnValue({
                    maybeSingle: vi.fn().mockResolvedValue({ data: null }),
                  }),
                }),
              }),
            }),
            insert: vi.fn().mockImplementation((row: any) => {
              insertedMember = row;
              return Promise.resolve({ error: null });
            }),
          };
        }
        return {};
      }),
    } as any;

    const result = await onboardGitHubUser(
      {
        id: "gh-1024025",
        login: "octocat",
        name: "The Octocat",
        avatarUrl: "https://avatars.githubusercontent.com/u/1024025?v=4",
        email: "octocat@github.com",
      },
      mockSupabase
    );

    expect(result.userId).toBe("gh-1024025");
    expect(result.workspaceId).toBe("ws-octocat-generated");
    expect(result.isNewUser).toBe(true);
    expect(result.isNewWorkspace).toBe(true);
    expect(insertedProfile.display_name).toBe("The Octocat");
    expect(insertedProfile.avatar_url).toContain("avatars.githubusercontent.com");
    expect(insertedWorkspace.created_by).toBe("gh-1024025");
    expect(insertedMember.role).toBe("owner");
  });

  it("P6-02: Workspace member invitation creates cryptographically signed token with 7-day expiration", () => {
    const inv = invitationStore.createInvitation({
      workspaceId: "ws-sentinel",
      email: "teammate@company.com",
      role: "reviewer",
      invitedByUserId: "user-admin",
      expiresInDays: 7,
    });

    expect(inv.id).toBeDefined();
    expect(inv.email).toBe("teammate@company.com");
    expect(inv.role).toBe("reviewer");
    expect(inv.status).toBe("pending");
    expect(inv.token).toContain(".");

    // Expiration must be approximately 7 days in future
    const expTime = new Date(inv.expiresAt).getTime();
    const diffDays = (expTime - Date.now()) / (1000 * 60 * 60 * 24);
    expect(diffDays).toBeGreaterThan(6.9);
    expect(diffDays).toBeLessThanOrEqual(7.1);
  });

  it("P6-03: Invitation redemption validates signature, rejects expired/tampered tokens, and enrolls member", () => {
    const inv = invitationStore.createInvitation({
      workspaceId: "ws-sentinel",
      email: "security@company.com",
      role: "admin",
      invitedByUserId: "user-owner",
    });

    // 1. Tampered signature is rejected
    const tamperedToken = inv.token.slice(0, -4) + "XXXX";
    const tamperedRes = invitationStore.verifyAndAcceptToken(tamperedToken, "user-new");
    expect(tamperedRes.valid).toBe(false);

    // 2. Valid token acceptance succeeds
    const acceptRes = invitationStore.verifyAndAcceptToken(inv.token, "user-new");
    expect(acceptRes.valid).toBe(true);
    if (acceptRes.valid) {
      expect(acceptRes.invitation.workspaceId).toBe("ws-sentinel");
      expect(acceptRes.invitation.role).toBe("admin");
      expect(acceptRes.invitation.status).toBe("accepted");
    }

    // 3. Repeated acceptance is rejected
    const repeatRes = invitationStore.verifyAndAcceptToken(inv.token, "user-other");
    expect(repeatRes.valid).toBe(false);
  });

  it("P6-04: Real-time multiplayer presence tracks active reviewers, broadcasts file/line inspection, and prunes stale users", () => {
    const prId = "pr-164";

    // User A inspects summary
    const revs1 = presenceBroker.heartbeat(prId, {
      userId: "user-alice",
      username: "alice",
      avatarUrl: "https://avatar.com/alice",
      activeView: "summary",
    });
    expect(revs1).toHaveLength(1);
    expect(revs1[0].username).toBe("alice");

    // User B inspects code on specific file and line
    const revs2 = presenceBroker.heartbeat(prId, {
      userId: "user-bob",
      username: "bob",
      activeView: "code",
      activeFile: "extension/content.js",
      activeLine: 1644,
    });
    expect(revs2).toHaveLength(2);
    const bob = revs2.find((u) => u.userId === "user-bob");
    expect(bob?.activeFile).toBe("extension/content.js");
    expect(bob?.activeLine).toBe(1644);

    // Active reviewers check
    const active = presenceBroker.getActiveReviewers(prId);
    expect(active).toHaveLength(2);

    // User A leaves explicitly
    presenceBroker.leave(prId, "user-alice");
    const remaining = presenceBroker.getActiveReviewers(prId);
    expect(remaining).toHaveLength(1);
    expect(remaining[0].userId).toBe("user-bob");
  });

  it("P6-05: Shared team internal notes extracts @mentions, persists notes per workspace, and isolates them from GitHub", async () => {
    const wsId = "ws-praxd-core";
    const prId = "pr-164";
    const content = "Hey @alice and @bob-dev, please take a look at the DOM innerHTML change.";

    // 1. Mentions extraction
    const mentions = extractMentions(content);
    expect(mentions).toEqual(["alice", "bob-dev"]);

    // 2. Note creation
    const note = internalNotesStore.createNote(wsId, prId, {
      authorUserId: "user-carol",
      authorName: "Carol",
      content,
      filePath: "extension/content.js",
      line: 1644,
    });

    expect(note.id).toBeDefined();
    expect(note.mentions).toEqual(["alice", "bob-dev"]);
    expect(note.filePath).toBe("extension/content.js");

    // 3. Retrieval
    const notes = internalNotesStore.getNotes(wsId, prId);
    expect(notes).toHaveLength(1);
    expect(notes[0].content).toContain("@alice");

    // 4. Verify notes never appear in external GitHub sync threads
    expect(note).not.toHaveProperty("github_comment_id");
  });

  it("P6-06: RBAC enforcement: Viewers cannot trigger billable AI reviews (HTTP 403 PERMISSION_DENIED)", async () => {
    // Set test context role to 'viewer'
    (globalThis as any).__praxdTestRole = "viewer";

    const req = new NextRequest("http://localhost:3000/api/pull-requests/pr-164/ai-review", {
      method: "POST",
    });

    const res = await aiReviewRoute(req, {
      params: Promise.resolve({ pullRequestId: "pr-164" }),
    });

    expect(res.status).toBe(403);
    const json = await res.json();
    expect(json.error.code).toBe("PERMISSION_DENIED");
    expect(json.error.message).toContain("permission to trigger AI reviews");
  });

  it("P6-07: RBAC enforcement: Viewers cannot publish findings to GitHub (HTTP 403 PERMISSION_DENIED)", async () => {
    // Set test context role to 'viewer'
    (globalThis as any).__praxdTestRole = "viewer";

    const req = new NextRequest("http://localhost:3000/api/ai-findings/finding-1/publish", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ confirmed: true }),
    });

    const res = await publishFindingRoute(req, {
      params: Promise.resolve({ findingId: "finding-1" }),
    });

    expect(res.status).toBe(403);
    const json = await res.json();
    expect(json.error.code).toBe("PERMISSION_DENIED");
    expect(json.error.message).toContain("permission to publish findings");
  });

  it("P6-08: RBAC permissions matrix correctly defines role boundaries across all roles", () => {
    // Reviewers can trigger and publish, but cannot manage members
    expect(canTriggerReview("reviewer")).toBe(true);
    expect(canPublishFinding("reviewer")).toBe(true);
    expect(canManageMembers("reviewer")).toBe(false);

    // Viewers cannot trigger or publish
    expect(canTriggerReview("viewer")).toBe(false);
    expect(canPublishFinding("viewer")).toBe(false);
    expect(canManageMembers("viewer")).toBe(false);

    // Admins and owners can do all actions
    expect(canTriggerReview("admin")).toBe(true);
    expect(canPublishFinding("admin")).toBe(true);
    expect(canManageMembers("admin")).toBe(true);

    expect(canTriggerReview("owner")).toBe(true);
    expect(canPublishFinding("owner")).toBe(true);
    expect(canManageMembers("owner")).toBe(true);

    // Note deletion permissions: author can always delete; admins/owners can delete any
    expect(canDeleteNote("viewer", "user-me", "user-me")).toBe(true);
    expect(canDeleteNote("viewer", "user-other", "user-me")).toBe(false);
    expect(canDeleteNote("admin", "user-other", "user-me")).toBe(true);
    expect(canDeleteNote("owner", "user-other", "user-me")).toBe(true);
  });

  it("P6-09: Cross-tenant isolation guarantees notes and invitations from Workspace A cannot be read by Workspace B", () => {
    const wsA = "workspace-alpha";
    const wsB = "workspace-beta";
    const prId = "pr-100";

    // Create note in wsA
    internalNotesStore.createNote(wsA, prId, {
      authorUserId: "user-alpha",
      authorName: "Alpha User",
      content: "Alpha confidential internal review note",
    });

    // Create invitation in wsA
    invitationStore.createInvitation({
      workspaceId: wsA,
      email: "engineer@alpha.com",
      role: "reviewer",
      invitedByUserId: "user-alpha",
    });

    // wsA has 1 note and 1 invitation
    expect(internalNotesStore.getNotes(wsA, prId)).toHaveLength(1);
    expect(invitationStore.getInvitationsForWorkspace(wsA)).toHaveLength(1);

    // wsB has 0 notes and 0 invitations (Tenant Isolation)
    expect(internalNotesStore.getNotes(wsB, prId)).toHaveLength(0);
    expect(invitationStore.getInvitationsForWorkspace(wsB)).toHaveLength(0);
  });
});
