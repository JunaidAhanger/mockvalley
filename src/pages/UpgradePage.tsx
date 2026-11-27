interface UpgradePageProps {
  onBackToPractice: () => void;
  onOpenProfile: () => void;
  onOpenMyPlan: () => void;
}

export function UpgradePage({
  onBackToPractice,
  onOpenProfile,
  onOpenMyPlan,
}: UpgradePageProps) {
  return (
    <main className="page-container">
      <section className="upgrade-screen-card">
        <p className="eyebrow">All-Access Pass</p>
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
          <li>Choose a 1-month or 3-month pass on the next screen</li>
        </ul>

        <button
          type="button"
          className="step-btn primary-step"
          style={{ width: "100%", marginBottom: 10 }}
          onClick={onOpenMyPlan}
        >
          Choose a Pass (My Plan)
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