import { SupabaseClient } from "@supabase/supabase-js";
import { Database, Json } from "@/types/database";

export interface LogAuditEventParams {
  workspaceId: string;
  actorUserId?: string | null;
  action:
    | "github_installation.connected"
    | "github_installation.disconnected"
    | "github_installation.suspended"
    | "workspace_membership.updated"
    | "ai_review.requested"
    | "ai_review.completed"
    | "ai_review.failed"
    | "ai_review.cancelled"
    | "ai_finding.status_updated"
    | "ai_finding.published_to_github"
    | "ai_finding.autofix_committed"
    | "authorization.failure";
  resourceType?: string | null;
  resourceId?: string | null;
  ipAddress?: string | null;
  userAgent?: string | null;
  metadata?: Record<string, any>;
}

/**
 * Sanitizes audit metadata to prevent logging raw secrets or private source code.
 */
function sanitizeAuditMetadata(metadata?: Record<string, any>): Json {
  if (!metadata) return {};

  const sanitized: Record<string, any> = {};
  for (const [key, val] of Object.entries(metadata)) {
    // Redact suspected credential keys
    if (/token|secret|password|api[-_]?key|private[-_]?key|^key$|auth(orization)?/i.test(key)) {
      sanitized[key] = "[REDACTED]";
    } else if (typeof val === "object" && val !== null) {
      sanitized[key] = sanitizeAuditMetadata(val);
    } else {
      sanitized[key] = val;
    }
  }

  return sanitized as Json;
}

/**
 * Records an immutable audit log event into the PostgreSQL database.
 */
export async function logAuditEvent(
  supabase: SupabaseClient<Database>,
  params: LogAuditEventParams
): Promise<{ success: boolean; logId?: string; error?: string }> {
  try {
    const { data, error } = await supabase
      .from("audit_logs")
      .insert({
        workspace_id: params.workspaceId,
        actor_user_id: params.actorUserId ?? null,
        action: params.action,
        resource_type: params.resourceType ?? null,
        resource_id: params.resourceId ?? null,
        ip_address: params.ipAddress ?? null,
        user_agent: params.userAgent ?? null,
        metadata: sanitizeAuditMetadata(params.metadata),
      })
      .select("id")
      .single();

    if (error) {
      console.error("[AuditLog] Failed to record audit event:", error.message);
      return { success: false, error: error.message };
    }

    return { success: true, logId: data.id };
  } catch (err: any) {
    console.error("[AuditLog] Exception recording audit event:", err.message);
    return { success: false, error: err.message };
  }
}
