import { NextRequest } from "next/server";
import { getAuthenticatedContext } from "@/lib/supabase/auth";
import { apiSuccess, apiError } from "@/lib/api-response";
import { getWorkspaceGovernance, setWorkspaceGovernance } from "@/lib/governance/governance-store";
import { canManagePolicy, WorkspaceRole } from "@/lib/auth/rbac";
import { AIProviderType } from "@/types/governance";

export async function GET(req: NextRequest) {
  const auth = await getAuthenticatedContext();
  if (!auth) {
    return apiError("UNAUTHORIZED", "Authentication required.", 401);
  }

  const settings = getWorkspaceGovernance(auth.workspaceId);
  return apiSuccess({ settings });
}

export async function PUT(req: NextRequest) {
  const auth = await getAuthenticatedContext();
  if (!auth) {
    return apiError("UNAUTHORIZED", "Authentication required.", 401);
  }

  const role = (auth.role as WorkspaceRole) || "member";
  if (!canManagePolicy(role)) {
    return apiError(
      "PERMISSION_DENIED",
      "Only workspace owners and admins can configure enterprise governance and model settings.",
      403
    );
  }

  try {
    const body = await req.json();
    const updates: any = {};

    if (
      body.primaryProvider &&
      ["anthropic", "gemini", "openai", "selfhosted", "fallback", "deterministic"].includes(
        body.primaryProvider
      )
    ) {
      updates.primaryProvider = body.primaryProvider as AIProviderType;
    }

    if (typeof body.modelName === "string") {
      updates.modelName = body.modelName.trim();
    }

    if (Array.isArray(body.fallbackProviders)) {
      updates.fallbackProviders = body.fallbackProviders;
    }

    if (typeof body.retentionDays === "number") {
      updates.retentionDays = Math.max(0, Math.min(365, body.retentionDays));
    }

    if (typeof body.zeroDataRetention === "boolean") {
      updates.zeroDataRetention = body.zeroDataRetention;
    }

    if (typeof body.autoPurgeEnabled === "boolean") {
      updates.autoPurgeEnabled = body.autoPurgeEnabled;
    }

    if (body.selfHosted) {
      updates.selfHosted = {
        baseUrl: String(body.selfHosted.baseUrl || "").trim(),
        apiKey: body.selfHosted.apiKey ? String(body.selfHosted.apiKey).trim() : null,
        model: body.selfHosted.model ? String(body.selfHosted.model).trim() : undefined,
        requireTls: body.selfHosted.requireTls !== false,
        customHeaders: body.selfHosted.customHeaders,
      };
    }

    const updated = setWorkspaceGovernance(auth.workspaceId, updates);
    return apiSuccess({ settings: updated });
  } catch (err: any) {
    return apiError("BAD_REQUEST", `Failed to update governance settings: ${err?.message}`, 400);
  }
}
