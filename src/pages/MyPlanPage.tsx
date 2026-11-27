import { useCallback, useEffect, useState } from "react";
import {
  createRazorpayOrder,
  fetchCurrentPass,
  fetchPlans,
  launchRazorpayCheckout,
  waitForPassActivation,
} from "../lib/paymentsApi";
import type { ActivePassSummary, PlanItem } from "../lib/types";

interface MyPlanPageProps {
  isPaid?: boolean;
  onPassStateChanged?: (isPaid: boolean) => void;
  onBackToPractice?: () => void;
}

type CheckoutBanner =
  | { type: "verifying"; message: string }
  | { type: "success"; message: string }
  | { type: "error"; message: string }
  | null;

export function MyPlanPage({
  isPaid,
  onPassStateChanged,
  onBackToPractice,
}: MyPlanPageProps) {
  const [plans, setPlans] = useState<PlanItem[]>([]);
  const [currentPass, setCurrentPass] = useState<ActivePassSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [busyPlanId, setBusyPlanId] = useState<string | null>(null);
  const [banner, setBanner] = useState<CheckoutBanner>(null);

  const loadPlanState = useCallback(async () => {
    setLoadError(null);
    const [planList, activePass] = await Promise.all([fetchPlans(), fetchCurrentPass()]);
    setPlans(planList);
    setCurrentPass(activePass);
    onPassStateChanged?.(Boolean(activePass));
  }, [onPassStateChanged]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    loadPlanState()
      .catch((err) => {
        if (!cancelled) setLoadError((err as Error).message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [loadPlanState]);

  const handleBuyOrRenew = async (plan: PlanItem) => {
    setBusyPlanId(plan.id);
    setBanner(null);

    try {
      const order = await createRazorpayOrder(plan.id);
      const previousExpiry = currentPass?.expires_at ?? null;

      launchRazorpayCheckout(
        order,
        async () => {
          setBanner({
            type: "verifying",
            message:
              "Payment received by Razorpay. Confirming with our server webhook so your pass activates safely...",
          });

          const activated = await waitForPassActivation(previousExpiry);
          if (activated) {
            setCurrentPass(activated);
            onPassStateChanged?.(true);
            setBanner({
              type: "success",
              message: `Pass active! Valid until ${new Date(activated.expires_at).toLocaleString(
                "en-IN"
              )}.`,
            });
          } else {
            setBanner({
              type: "verifying",
              message:
                "Still confirming webhook activation. Tap Refresh Status in a few seconds if it hasn't updated yet.",
            });
          }
          setBusyPlanId(null);
        },
        (reason) => {
          setBusyPlanId(null);
          setBanner({
            type: "error",
            message: reason,
          });
        }
      );
    } catch (err) {
      setBusyPlanId(null);
      setBanner({
        type: "error",
        message: (err as Error).message,
      });
    }
  };

  if (loading) {
    return (
      <main className="page-container">
        <div className="state-card" role="status">
          Loading plans...
        </div>
      </main>
    );
  }

  if (loadError) {
    return (
      <main className="page-container">
        <div className="error-card" role="alert">
          <strong>Could not load plan details</strong>
          <p>{loadError}</p>
        </div>
      </main>
    );
  }

  const activePlanObj = currentPass
    ? plans.find((p) => p.id === currentPass.plan_id) ?? null
    : null;
  const hasActivePass = Boolean(currentPass) || Boolean(isPaid);

  return (
    <main className="page-container">
      <section className="plan-status-card" aria-label="Current plan status">
        <p className="eyebrow">My Plan</p>
        <h1 className="app-title">
          {currentPass
            ? activePlanObj?.name || currentPass.plan_id
            : isPaid
              ? "Active Pass"
              : "Free Plan"}
        </h1>

        {currentPass ? (
          <>
            <p className="subtitle">
              Your pass is <strong>active</strong>. Buying a pass again automatically extends your
              expiry date from your current expiry.
            </p>
            <div className="profile-row" style={{ borderBottom: 0, paddingBottom: 0 }}>
              <span className="profile-label">Expiry Date</span>
              <strong className="profile-value">
                {new Date(currentPass.expires_at).toLocaleString("en-IN")}
              </strong>
            </div>
          </>
        ) : isPaid ? (
          <p className="subtitle">
            Your pass is <strong>active</strong>. Tap Refresh Status to view your latest expiry
            details.
          </p>
        ) : (
          <p className="subtitle">
            You do not have an active pass right now. Choose a 1-month or 3-month pass below to
            unlock full topics, Current Affairs, and Exam Mode.
          </p>
        )}

        <button
          type="button"
          className="sheet-close-btn"
          style={{ marginTop: 12 }}
          onClick={() => {
            setBanner(null);
            loadPlanState().catch((err) => setLoadError((err as Error).message));
          }}
        >
          Refresh Status
        </button>

        {onBackToPractice && (
          <button
            type="button"
            className="sheet-close-btn"
            style={{ marginTop: 12, marginLeft: 8 }}
            onClick={onBackToPractice}
          >
            Back to Practice
          </button>
        )}
      </section>

      {banner && (
        <div
          className={
            banner.type === "error"
              ? "error-card"
              : banner.type === "success"
                ? "feedback-banner is-correct"
                : "notice-banner"
          }
          role={banner.type === "error" ? "alert" : "status"}
          style={{ marginBottom: 14 }}
        >
          <p style={{ margin: 0, fontWeight: 600 }}>{banner.message}</p>
        </div>
      )}

      <section className="plans-list" aria-label="Available passes">
        {plans.map((plan) => {
          const rupees = Math.round(plan.amount_paise / 100);
          const isBusy = busyPlanId === plan.id;

          return (
            <article key={plan.id} className="plan-option-card">
              <div className="plan-card-top">
                <div>
                  <h2 className="plan-card-title">{plan.name}</h2>
                  <p className="plan-duration">{plan.duration_days} days access</p>
                </div>
                <span className="plan-price">₹{rupees}</span>
              </div>

              <p className="plan-card-desc">{plan.description}</p>

              <button
                type="button"
                className="step-btn primary-step"
                style={{ width: "100%", marginTop: 12 }}
                disabled={Boolean(busyPlanId)}
                onClick={() => handleBuyOrRenew(plan)}
              >
                {isBusy
                  ? "Starting Checkout..."
                  : hasActivePass
                    ? `Renew with ${plan.name}`
                    : `Buy ${plan.name} (₹${rupees})`}
              </button>
            </article>
          );
        })}
      </section>
    </main>
  );
}