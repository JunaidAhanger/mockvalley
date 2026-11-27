import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function toHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function timingSafeEqualHex(a: string, b: string): boolean {
  const cleanA = a.trim().toLowerCase();
  const cleanB = b.trim().toLowerCase();
  if (cleanA.length !== cleanB.length || cleanA.length === 0) return false;
  let diff = 0;
  for (let i = 0; i < cleanA.length; i++) {
    diff |= cleanA.charCodeAt(i) ^ cleanB.charCodeAt(i);
  }
  return diff === 0;
}

async function verifyRazorpaySignature(
  rawBody: string,
  signature: string,
  secret: string
): Promise<boolean> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sigBuffer = await crypto.subtle.sign("HMAC", key, encoder.encode(rawBody));
  const expectedHex = toHex(sigBuffer);
  return timingSafeEqualHex(expectedHex, signature);
}

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  try {
    const webhookSecret = Deno.env.get("RAZORPAY_WEBHOOK_SECRET");
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!webhookSecret || !supabaseUrl || !supabaseServiceKey) {
      return jsonResponse({ error: "Webhook server secrets not configured" }, 500);
    }

    const signature = req.headers.get("X-Razorpay-Signature") || "";
    const rawBody = await req.text();

    const validSig = await verifyRazorpaySignature(rawBody, signature, webhookSecret);
    if (!validSig) {
      return jsonResponse({ error: "Invalid webhook signature" }, 401);
    }

    const eventPayload = JSON.parse(rawBody) as {
      event?: string;
      payload?: {
        payment?: {
          entity?: {
            id?: string;
            order_id?: string;
            notes?: Record<string, string>;
          };
        };
        order?: {
          entity?: {
            id?: string;
            notes?: Record<string, string>;
          };
        };
      };
    };

    // Only activate/extend passes on verified payment.captured events
    if (eventPayload.event !== "payment.captured") {
      return jsonResponse({ ok: true, ignored_event: eventPayload.event || "unknown" });
    }

    const paymentEntity = eventPayload.payload?.payment?.entity;
    const orderEntity = eventPayload.payload?.order?.entity;
    const paymentId = paymentEntity?.id;

    if (!paymentId) {
      return jsonResponse({ error: "Missing payment id in webhook payload" }, 400);
    }

    const notes = {
      ...(orderEntity?.notes ?? {}),
      ...(paymentEntity?.notes ?? {}),
    };

    const userId = notes.user_id;
    const planId = notes.plan_id;

    if (!userId || !planId) {
      return jsonResponse(
        { error: "Missing user_id or plan_id in payment notes" },
        400
      );
    }

    const adminClient = createClient(supabaseUrl, supabaseServiceKey);
    const { data, error } = await adminClient.rpc("apply_razorpay_pass", {
      p_user_id: userId,
      p_plan_id: planId,
      p_razorpay_payment_id: paymentId,
    });

    if (error) {
      return jsonResponse({ error: `Failed to apply pass: ${error.message}` }, 500);
    }

    const row = Array.isArray(data) ? data[0] : data;

    return jsonResponse({
      ok: true,
      payment_id: paymentId,
      already_processed: Boolean(row?.already_processed),
      expires_at: row?.expires_at ?? null,
    });
  } catch (err) {
    return jsonResponse({ error: (err as Error).message || "Webhook processing failed" }, 500);
  }
});