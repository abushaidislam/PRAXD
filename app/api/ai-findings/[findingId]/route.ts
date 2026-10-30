import { NextRequest } from "next/server";
import { getAuthenticatedContext } from "@/lib/supabase/auth";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { FindingStatusEnum } from "@/types/ai-review";
import { apiSuccess, apiError } from "@/lib/api-response";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ findingId: string }> }
) {
  const { findingId } = await params;
  const auth = await getAuthenticatedContext();
  if (!auth) {
    return apiError("UNAUTHORIZED", "Authentication required.", 401);
  }

  let body: any = {};
  try {
    body = await req.json();
  } catch {
    return apiError("INVALID_JSON", "Request body must be valid JSON.", 400);
  }

  const parsedStatus = FindingStatusEnum.safeParse(body.status);
  if (!parsedStatus.success) {
    return apiError(
      "INVALID_STATUS",
      `Invalid finding status. Allowed: ${FindingStatusEnum.options.join(", ")}`,
      400
    );
  }

  const supabase = createServiceRoleClient();

  const { data: updated, error } = await supabase
    .from("ai_findings")
    .update({
      status: parsedStatus.data,
      updated_at: new Date().toISOString(),
    })
    .eq("id", findingId)
    .eq("workspace_id", auth.workspaceId)
    .select("*")
    .single();

  if (error || !updated) {
    return apiError("NOT_FOUND", "Finding not found or access denied.", 404);
  }

  return apiSuccess({ finding: updated });
}
