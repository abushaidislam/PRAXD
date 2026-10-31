import crypto from "crypto";
import { WorkspaceRole } from "./rbac";

export interface WorkspaceInvitation {
  id: string;
  workspaceId: string;
  email: string;
  role: WorkspaceRole;
  invitedByUserId: string;
  token: string;
  expiresAt: string;
  status: "pending" | "accepted" | "revoked";
  createdAt: string;
}

const INVITATION_SECRET = process.env.PRAXD_INVITATION_SECRET || "praxd-invitation-secret-salt-2026";

class InvitationStore {
  private invitations = new Map<string, WorkspaceInvitation>();

  /**
   * Creates and cryptographically signs a workspace invitation token.
   */
  createInvitation(params: {
    workspaceId: string;
    email: string;
    role: WorkspaceRole;
    invitedByUserId: string;
    expiresInDays?: number;
  }): WorkspaceInvitation {
    const days = params.expiresInDays || 7;
    const expiresAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();
    const id = `inv-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    // Generate tamper-evident invitation token
    const tokenPayload = `${params.workspaceId}:${params.email}:${params.role}:${expiresAt}`;
    const signature = crypto
      .createHmac("sha256", INVITATION_SECRET)
      .update(tokenPayload)
      .digest("hex")
      .slice(0, 32);

    const token = `${Buffer.from(tokenPayload).toString("base64url")}.${signature}`;

    const invitation: WorkspaceInvitation = {
      id,
      workspaceId: params.workspaceId,
      email: params.email.toLowerCase().trim(),
      role: params.role,
      invitedByUserId: params.invitedByUserId,
      token,
      expiresAt,
      status: "pending",
      createdAt: new Date().toISOString(),
    };

    this.invitations.set(token, invitation);
    return invitation;
  }

  /**
   * Verifies and redeems an invitation token.
   */
  verifyAndAcceptToken(
    token: string,
    acceptingUserId: string
  ): { valid: true; invitation: WorkspaceInvitation } | { valid: false; reason: string } {
    const parts = token.split(".");
    if (parts.length !== 2) {
      return { valid: false, reason: "Malformed invitation token" };
    }

    const payload = Buffer.from(parts[0], "base64url").toString("utf-8");
    const expectedSig = crypto
      .createHmac("sha256", INVITATION_SECRET)
      .update(payload)
      .digest("hex")
      .slice(0, 32);

    if (parts[1] !== expectedSig) {
      return { valid: false, reason: "Invalid token signature" };
    }

    const [wsId, email, role, expiresAt] = payload.split(":");
    if (new Date(expiresAt).getTime() < Date.now()) {
      return { valid: false, reason: "Invitation token has expired" };
    }

    const stored = this.invitations.get(token);
    if (stored && stored.status !== "pending") {
      return { valid: false, reason: `Invitation is already ${stored.status}` };
    }

    if (stored) {
      stored.status = "accepted";
    }

    return {
      valid: true,
      invitation: stored || {
        id: `inv-${Date.now()}`,
        workspaceId: wsId,
        email,
        role: role as WorkspaceRole,
        invitedByUserId: "unknown",
        token,
        expiresAt,
        status: "accepted",
        createdAt: new Date().toISOString(),
      },
    };
  }

  getInvitationsForWorkspace(workspaceId: string): WorkspaceInvitation[] {
    return Array.from(this.invitations.values()).filter(
      (inv) => inv.workspaceId === workspaceId && inv.status === "pending"
    );
  }

  resetAll(): void {
    this.invitations.clear();
  }
}

export const invitationStore = new InvitationStore();
