interface UpgradePageProps {
  onBackToPractice: () => void;
  onOpenProfile: () => void;
}

export function UpgradePage({ onBackToPractice, onOpenProfile }: UpgradePageProps) {
  return (
    <main className="page-container">
      <section className="upgrade-screen-card">
        <p className="eyebrow">3-Month All-Access Pass</p>
        <h1 className="app-title">Unlock Full MockValley Access</h1>
        <p className="subtitle">
          Free accounts include <strong>is_free</strong> questions up to{" "}
          <strong>10 distinct questions per topic</strong> (with unlimited retries on questions you
          already attempted).
        </p>

        <ul className="benefit-list">
          <li>All questions across every active JKSSB topic and difficulty level</li>
          <li>Monthly Current Affairs starting June 2026</li>
          <li>Timed Exam Mode with +1 / -0.25 scoring and full review</li>
          <li>Valid for 3 months per pass</li>
        </ul>

        <div className="notice-banner" role="status">
          Online checkout via Razorpay will be connected in the next task.
        </div>

        <button
          type="button"
          className="step-btn primary-step"
          style={{ width: "100%", marginBottom: 10 }}
          disabled
          aria-disabled="true"
        >
          Upgrade Pass (Coming in Task 6)
        </button>

        <div className="nav-actions-row">
          <button type="button" className="step-btn" onClick={onBackToPractice}>
            Back to Practice
          </button>
          <button type="button" className="step-btn" onClick={onOpenProfile}>
            View Profile
          </button>
        </div>
      </section>
    </main>
  );
}