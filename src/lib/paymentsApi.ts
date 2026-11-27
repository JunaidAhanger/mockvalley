import { supabase } from "./supabase";
import type { ActivePassSummary, PlanItem } from "./types";

declare global {
  interface Window {
    Razorpay?: new (options: Record<string, unknown>) => {
      open: () => void;
      on: (event: string, handler: (resp: { error?: { description?: string } }) => void) => void;
    };
  }
}

export interface CreateOrderResponse {
  order_id: string;
  amount_paise: number;
  currency: string;
  key_id: string;
  plan_id: string;
  plan_name: string;
  user_email: string;
}

export async function fetchPlans(): Promise<PlanItem[]> {
  if (!supabase) throw new Error("Supabase is not configured.");

  const { data, error } = await supabase
    .from("plans")
    .select("id, name, description, amount_paise, duration_days, display_order")
    .eq("active", true)
    .order("display_order", { ascending: true });

  if (error) {
    throw new Error(`Could not load plans: ${error.message}`);
  }

  return (data ?? []) as PlanItem[];
}

export async function fetchCurrentPass(): Promise<ActivePassSummary | null> {
  if (!supabase) return null;

  const { data, error } = await supabase
    .from("passes")
    .select("id, plan_id, starts_at, expires_at, status, razorpay_payment_id")
    .eq("status", "active")
    .gt("expires_at", new Date().toISOString())
    .order("expires_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(`Could not load active pass: ${error.message}`);
  }

  return (data as ActivePassSummary | null) ?? null;
}

export async function createRazorpayOrder(planId: string): Promise<CreateOrderResponse> {
  if (!supabase) throw new Error("Supabase is not configured.");

  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session?.access_token) {
    throw new Error("Please sign in first.");
  }

  const { data, error } = await supabase.functions.invoke("create_order", {
    body: { plan_id: planId },
  });

  if (error) {
    throw new Error(error.message || "Could not start payment order.");
  }

  if (!data?.order_id || !data?.key_id) {
    throw new Error("Invalid order response from server.");
  }

  return data as CreateOrderResponse;
}

export function launchRazorpayCheckout(
  order: CreateOrderResponse,
  onSubmittedToRazorpay: () => void,
  onDismissedOrFailed: (reason: string) => void
): void {
  if (!window.Razorpay) {
    onDismissedOrFailed("Razorpay checkout script did not load. Check your connection.");
    return;
  }

  // Note: We do NOT unlock access inside `handler`.
  // Payment completion is only confirmed by the server webhook + polling passes/is_paid().
  const rzp = new window.Razorpay({
    key: order.key_id,
    amount: order.amount_paise,
    currency: order.currency || "INR",
    name: "MockValley",
    description: order.plan_name,
    order_id: order.order_id,
    prefill: {
      email: order.user_email || undefined,
    },
    method: {
      upi: true,
      card: true,
      netbanking: true,
    },
    theme: {
      color: "#0f766e",
    },
    handler: () => {
      onSubmittedToRazorpay();
    },
    modal: {
      ondismiss: () => {
        onDismissedOrFailed("Payment window was closed before completion.");
      },
    },
  });

  rzp.on("payment.failed", (resp) => {
    onDismissedOrFailed(resp?.error?.description || "Payment failed. Please try again.");
  });

  rzp.open();
}

export async function waitForPassActivation(
  previousExpiresAt: string | null,
  maxAttempts = 12,
  intervalMs = 2000
): Promise<ActivePassSummary | null> {
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const activePass = await fetchCurrentPass().catch(() => null);
    if (activePass) {
      if (!previousExpiresAt || activePass.expires_at !== previousExpiresAt) {
        return activePass;
      }
    }
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
  return await fetchCurrentPass().catch(() => null);
}