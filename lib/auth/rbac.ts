export type WorkspaceRole = "owner" | "admin" | "reviewer" | "viewer" | "member";

export interface RolePermissions {
  canViewPR: boolean;
  canTriggerAIReview: boolean;
  canPublishFindings: boolean;
  canCreateInternalNotes: boolean;
  canDeleteInternalNotes: boolean;
  canManageMembers: boolean;
  canManageIntegrations: boolean;
}

export const ROLE_PERMISSIONS: Record<WorkspaceRole, RolePermissions> = {
  owner: {
    canViewPR: true,
    canTriggerAIReview: true,
    canPublishFindings: true,
    canCreateInternalNotes: true,
    canDeleteInternalNotes: true,
    canManageMembers: true,
    canManageIntegrations: true,
  },
  admin: {
    canViewPR: true,
    canTriggerAIReview: true,
    canPublishFindings: true,
    canCreateInternalNotes: true,
    canDeleteInternalNotes: true,
    canManageMembers: true,
    canManageIntegrations: true,
  },
  reviewer: {
    canViewPR: true,
    canTriggerAIReview: true,
    canPublishFindings: true,
    canCreateInternalNotes: true,
    canDeleteInternalNotes: false,
    canManageMembers: false,
    canManageIntegrations: false,
  },
  member: {
    canViewPR: true,
    canTriggerAIReview: true,
    canPublishFindings: true,
    canCreateInternalNotes: true,
    canDeleteInternalNotes: false,
    canManageMembers: false,
    canManageIntegrations: false,
  },
  viewer: {
    canViewPR: true,
    canTriggerAIReview: false,
    canPublishFindings: false,
    canCreateInternalNotes: true, // Viewers can participate in internal team discussion
    canDeleteInternalNotes: false,
    canManageMembers: false,
    canManageIntegrations: false,
  },
};

/**
 * Checks if a given workspace role has permission to trigger billable AI reviews.
 */
export function canTriggerReview(role: WorkspaceRole): boolean {
  return ROLE_PERMISSIONS[role]?.canTriggerAIReview ?? false;
}

/**
 * Checks if a given workspace role has permission to publish findings to GitHub.
 */
export function canPublishFinding(role: WorkspaceRole): boolean {
  return ROLE_PERMISSIONS[role]?.canPublishFindings ?? false;
}

/**
 * Checks if a given workspace role has permission to invite or manage members.
 */
export function canManageMembers(role: WorkspaceRole): boolean {
  return ROLE_PERMISSIONS[role]?.canManageMembers ?? false;
}

/**
 * Checks if a given workspace role has permission to configure repository policies and CI/CD bot mode.
 */
export function canManagePolicy(role: WorkspaceRole): boolean {
  return ROLE_PERMISSIONS[role]?.canManageIntegrations ?? false;
}

/**
 * Checks if a given workspace role has permission to delete an internal note.
 */
export function canDeleteNote(
  role: WorkspaceRole,
  noteAuthorUserId: string,
  currentUserId: string
): boolean {
  // Author can always delete their own note; admins and owners can moderate any note
  if (noteAuthorUserId === currentUserId) return true;
  return role === "owner" || role === "admin";
}
