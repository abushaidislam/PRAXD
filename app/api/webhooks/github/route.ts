import { NextRequest, NextResponse } from "next/server";
import {
  readRawBodyWithLimit,
  verifyGitHubWebhookSignature,
  computePayloadSha256,
  MAX_WEBHOOK_BYTES,
} from "@/lib/github/webhook-verify";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { processWebhookEvent } from "@/lib/github/webhook-handlers";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const signature = req.headers.get("x-hub-signature-256");
  const deliveryId = req.headers.get("x-github-delivery");
  const eventName = req.headers.get("x-github-event");
  const contentType = req.headers.get("content-type")?.toLowerCase() ?? "";
  const contentLengthHeader = req.headers.get("content-length");
  const contentLength = contentLengthHeader === null ? null : Number(contentLengthHeader);

  // 1. Enforce required headers and content-type
  if (!deliveryId || !eventName || !contentType.startsWith("application/json")) {
    return new NextResponse("Missing required headers or unsupported content type", {
      status: 400,
    });
  }

  // 2. Validate payload length bounds
  if (contentLength !== null && (!Number.isSafeInteger(contentLength) || contentLength < 0)) {
    return new NextResponse("Invalid content length", { status: 400 });
  }
  if (contentLength !== null && contentLength > MAX_WEBHOOK_BYTES) {
    return new NextResponse("Payload too large", { status: 413 });
  }

  // 3. Read body exactly once as raw bytes
  let rawBody: Buffer;
  try {
    rawBody = await readRawBodyWithLimit(req as unknown as Request);
  } catch (error: any) {
    if (error?.message === "WEBHOOK_PAYLOAD_TOO_LARGE") {
      return new NextResponse("Payload too large", { status: 413 });
    }
    return new NextResponse("Could not read request body", { status: 400 });
  }

  // 4. Verify webhook HMAC signature
  const secret = process.env.GITHUB_WEBHOOK_SECRET;
  if (!secret) {
    return new NextResponse("Webhook verification unavailable: GITHUB_WEBHOOK_SECRET is not configured", {
      status: 503,
    });
  }

  if (!verifyGitHubWebhookSignature(rawBody, signature, secret)) {
    return new NextResponse("Invalid signature", { status: 401 });
  }

  // 5. Parse JSON envelope
  let payload: any;
  try {
    const utf8 = new TextDecoder("utf-8", { fatal: true }).decode(rawBody);
    payload = JSON.parse(utf8);
  } catch {
    return new NextResponse("Invalid UTF-8 JSON", { status: 400 });
  }

  const payloadHash = computePayloadSha256(rawBody);
  const actionName = typeof payload.action === "string" ? payload.action : null;
  const installationIdNum = payload.installation?.id;

  const supabase = createServiceRoleClient();

  // Find local installation UUID if present
  let localInstallationIdUuid: string | null = null;
  if (installationIdNum) {
    const { data: inst } = await supabase
      .from("github_installations")
      .select("id")
      .eq("installation_id", installationIdNum)
      .maybeSingle();
    localInstallationIdUuid = inst?.id || null;
  }

  // 6. Deduplication check in webhook_deliveries (Requirement P2-04)
  const { data: existingDelivery } = await supabase
    .from("webhook_deliveries")
    .select("id, status")
    .eq("delivery_id", deliveryId)
    .maybeSingle();

  if (existingDelivery) {
    // Acknowledge receipt idempotently without re-executing duplicate domain work
    return NextResponse.json({ acknowledged: true, duplicate: true }, { status: 200 });
  }

  // 7. Insert durable delivery row (status: 'received')
  const { data: delivery, error: insertError } = await supabase
    .from("webhook_deliveries")
    .insert({
      delivery_id: deliveryId,
      installation_id: localInstallationIdUuid,
      event_name: eventName,
      action_name: actionName,
      status: "received",
      payload_sha256: payloadHash,
      attempts: 1,
    })
    .select("id")
    .single();

  if (insertError) {
    // If running in development without a live PostgreSQL table, still process event
  }

  // 8. Process domain logic asynchronously or directly
  try {
    const result = await processWebhookEvent(supabase, eventName, payload);

    if (delivery?.id) {
      await supabase
        .from("webhook_deliveries")
        .update({
          status: result.status,
          processed_at: new Date().toISOString(),
          safe_error_code: result.safeErrorCode || null,
        })
        .eq("id", delivery.id);
    }

    return NextResponse.json(
      { acknowledged: true, deliveryId, status: result.status },
      { status: 202 }
    );
  } catch (err: any) {
    if (delivery?.id) {
      await supabase
        .from("webhook_deliveries")
        .update({
          status: "failed",
          safe_error_code: "PROCESSING_EXCEPTION",
        })
        .eq("id", delivery.id);
    }

    return NextResponse.json(
      { acknowledged: true, deliveryId, status: "failed" },
      { status: 202 }
    );
  }
}
