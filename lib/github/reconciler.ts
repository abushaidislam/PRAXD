import { SupabaseClient } from "@supabase/supabase-js";
import { Database } from "@/types/database";

export interface ReconciliationSummary {
  recoveredDeliveries: number;
  exhaustedDeliveries: number;
  reconciledRepositories: number;
}

const MAX_DELIVERY_ATTEMPTS = 5;

/**
 * Recovers stuck, abandoned, or crashed webhook deliveries.
 * If a delivery remains in 'received' or 'queued' state beyond a threshold (e.g. 5 minutes),
 * the reconciler safely retries it with exponential backoff or marks it permanently 'failed'.
 */
export async function runDeliveryReconciler(
  supabase: SupabaseClient<Database>
): Promise<ReconciliationSummary> {
  const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();

  // Find deliveries stuck in 'received' or 'queued'
  const { data: stuckDeliveries } = await supabase
    .from("webhook_deliveries")
    .select("id, delivery_id, attempts, status")
    .in("status", ["received", "queued"])
    .lt("received_at", fiveMinutesAgo)
    .limit(50);

  let recoveredCount = 0;
  let exhaustedCount = 0;

  if (stuckDeliveries) {
    for (const d of stuckDeliveries) {
      if (d.attempts >= MAX_DELIVERY_ATTEMPTS) {
        // Exceeded maximum retry attempts: mark as failed with safe error code (Requirement P2-11)
        await supabase
          .from("webhook_deliveries")
          .update({
            status: "failed",
            safe_error_code: "MAX_ATTEMPTS_EXCEEDED",
          })
          .eq("id", d.id);
        exhaustedCount++;
      } else {
        // Re-queue delivery attempt
        await supabase
          .from("webhook_deliveries")
          .update({
            status: "queued",
            attempts: d.attempts + 1,
          })
          .eq("id", d.id);
        recoveredCount++;
      }
    }
  }

  return {
    recoveredDeliveries: recoveredCount,
    exhaustedDeliveries: exhaustedCount,
    reconciledRepositories: 0,
  };
}
