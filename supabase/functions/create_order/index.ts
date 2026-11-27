import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const razorpayKeyId = Deno.env.get("RAZORPAY_KEY_ID");
    const razorpayKeySecret = Deno.env.get("RAZORPAY_KEY_SECRET");

    if (
      !supabaseUrl ||
      !supabaseAnonKey ||
      !supabaseServiceKey ||
      !razorpayKeyId ||
      !razorpayKeySecret
    ) {
      return jsonResponse({ error: "Server payment configuration is incomplete" }, 500);
    }

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return jsonResponse({ error: "Missing authorization header" }, 401);
    }

    // Verify signed-in user via Supabase Auth
    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const {
      data: { user },
      error: authError,
    } = await userClient.auth.getUser();

    if (authError || !user) {
      return jsonResponse({ error: "Unauthorized user" }, 401);
    }

    // Read ONLY plan_id from request body; ignore any amount sent by client
    const body = (await req.json().catch(() => ({}))) as { plan_id?: unknown };
    const planId = typeof body.plan_id === "string" ? body.plan_id.trim() : "";

    if (!planId) {
      return jsonResponse({ error: "plan_id is required" }, 400);
    }

    const adminClient = createClient(supabaseUrl, supabaseServiceKey);
    const { data: plan, error: planError } = await adminClient
      .from("plans")
      .select("id, name, amount_paise, duration_days, active")
      .eq("id", planId)
      .eq("active", true)
      .single();

    if (planError || !plan) {
      return jsonResponse({ error: "Selected plan is not available" }, 404);
    }

    // Create Razorpay order with server-decided amount_paise
    const basicAuth = btoa(`${razorpayKeyId}:${razorpayKeySecret}`);
    const receipt = `mv_${user.id.slice(0, 8)}_${Date.now()}`;

    const rzpRes = await fetch("https://api.razorpay.com/v1/orders", {
      method: "POST",
      headers: {
        Authorization: `Basic ${basicAuth}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        amount: plan.amount_paise,
        currency: "INR",
        receipt,
        notes: {
          user_id: user.id,
          plan_id: plan.id,
          duration_days: String(plan.duration_days),
        },
      }),
    });

    const rzpData = await rzpRes.json();
    if (!rzpRes.ok || !rzpData?.id) {
      return jsonResponse(
        { error: rzpData?.error?.description || "Failed to create Razorpay order" },
        502
      );
    }

    return jsonResponse({
      order_id: rzpData.id,
      amount_paise: plan.amount_paise,
      currency: "INR",
      key_id: razorpayKeyId,
      plan_id: plan.id,
      plan_name: plan.name,
      user_email: user.email ?? "",
    });
  } catch (err) {
    return jsonResponse({ error: (err as Error).message || "Unexpected error" }, 500);
  }
});