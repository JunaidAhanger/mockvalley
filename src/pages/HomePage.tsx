import type { NavTab } from "../components/BottomNav";

interface HomePageProps {
  onOpenSection: (tab: NavTab) => void;
  statusMessage: string | null;
}

export function HomePage({ onOpenSection, statusMessage }: HomePageProps) {
  return (
    <main className="page-container">
      <header className="hero-card">
        <p className="eyebrow">JKSSB Exam Prep • English</p>
        <h1 className="app-title">MockValley</h1>
        <p className="subtitle">
          Practice J&K General Knowledge and Current Affairs at your own pace.
        </p>
      </header>

      {statusMessage && (
        <div className="notice-banner" role="status">
          {statusMessage}
        </div>
      )}

      <section className="mode-grid" aria-label="Study modes">
        <button
          type="button"
          className="big-mode-btn primary-mode"
          onClick={() => onOpenSection("practice")}
        >
          <span className="mode-title">Practice by Topic</span>
          <span className="mode-desc">
            Pick a J&K or Indian GK topic and filter by difficulty.
          </span>
        </button>

        <button
          type="button"
          className="big-mode-btn"
          onClick={() => onOpenSection("current-affairs")}
        >
          <span className="mode-title">Current Affairs</span>
          <span className="mode-desc">
            Monthly MCQs starting June 2026 for paid members.
          </span>
        </button>

        <button
          type="button"
          className="big-mode-btn"
          onClick={() => onOpenSection("exam")}
        >
          <span className="mode-title">Exam Mode</span>
          <span className="mode-desc">
            Timed test practice with full answer review at the end.
          </span>
        </button>
      </section>
    </main>
  );
}