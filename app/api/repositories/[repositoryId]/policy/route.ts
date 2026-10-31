import { NextRequest } from "next/server";
import { getAuthenticatedContext } from "@/lib/supabase/auth";
import { apiSuccess, apiError } from "@/lib/api-response";
import { getRepositoryPolicy, setRepositoryPolicy } from "@/lib/policy/policy-store";
import { canManagePolicy, WorkspaceRole } from "@/lib/auth/rbac";
import { ReviewProfile, NotificationThreshold } from "@/types/policy";
import { sanitizeCustomRule } from "@/lib/policy/policy-engine";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ repositoryId: string }> }
) {
  const auth = await getAuthenticatedContext();
  if (!auth) {
    return apiError("UNAUTHORIZED", "Authentication required.", 401);
  }

  const { repositoryId } = await params;
  if (!repositoryId) {
    return apiError("BAD_REQUEST", "Repository ID is required.", 400);
  }

  const policy = getRepositoryPolicy(repositoryId, auth.workspaceId);
  return apiSuccess({ policy });
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ repositoryId: string }> }
) {
  const auth = await getAuthenticatedContext();
  if (!auth) {
    return apiError("UNAUTHORIZED", "Authentication required.", 401);
  }

  const role = (auth.role as WorkspaceRole) || "member";
  // Only owners and admins can configure CI/CD bot policy
  if (!canManagePolicy(role)) {
    return apiError(
      "PERMISSION_DENIED",
      "Only workspace owners and admins can configure repository policy and CI/CD bot settings.",
      403
    );
  }

  const { repositoryId } = await params;
  if (!repositoryId) {
    return apiError("BAD_REQUEST", "Repository ID is required.", 400);
  }

  try {
    const body = await req.json();

    const updates: any = {};

    if (typeof body.autoReviewEnabled === "boolean") {
      updates.autoReviewEnabled = body.autoReviewEnabled;
    }

    if (Array.isArray(body.branches)) {
      updates.branches = body.branches
        .filter((b: any) => typeof b === "string" && b.trim().length > 0)
        .map((b: string) => b.trim());
    }

    if (Array.isArray(body.paths)) {
      updates.paths = body.paths
        .filter((p: any) => typeof p === "string" && p.trim().length > 0)
        .map((p: string) => p.trim());
    }

    if (Array.isArray(body.ignoredAuthors)) {
      updates.ignoredAuthors = body.ignoredAuthors
        .filter((a: any) => typeof a === "string" && a.trim().length > 0)
        .map((a: string) => a.trim());
    }

    if (
      body.reviewProfile &&
      ["strict_security", "performance", "style", "comprehensive"].includes(body.reviewProfile)
    ) {
      updates.reviewProfile = body.reviewProfile as ReviewProfile;
    }

    if (Array.isArray(body.customRules)) {
      updates.customRules = body.customRules
        .filter((r: any) => typeof r === "string" && r.trim().length > 0)
        .map((r: string) => sanitizeCustomRule(r))
        .filter((r: string) => r.length > 0);
    }

    if (body.slackWebhookUrl !== undefined) {
      updates.slackWebhookUrl = body.slackWebhookUrl ? String(body.slackWebhookUrl).trim() : null;
    }

    if (body.discordWebhookUrl !== undefined) {
      updates.discordWebhookUrl = body.discordWebhookUrl ? String(body.discordWebhookUrl).trim() : null;
    }

    if (
      body.notificationThreshold &&
      ["critical", "high", "medium", "all", "none"].includes(body.notificationThreshold)
    ) {
      updates.notificationThreshold = body.notificationThreshold as NotificationThreshold;
    }

    const updated = setRepositoryPolicy(repositoryId, auth.workspaceId, updates);
    return apiSuccess({ policy: updated });
  } catch (err: any) {
    return apiError("BAD_REQUEST", `Failed to update repository policy: ${err?.message}`, 400);
  }
}
