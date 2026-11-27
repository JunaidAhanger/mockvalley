import { useState } from "react";
import { signOutUser } from "../lib/practiceApi";

interface ProfilePageProps {
  email: string | null;
  isPaid: boolean;
  onOpenUpgrade: () => void;
}

export function ProfilePage({ email, isPaid, onOpenUpgrade }: ProfilePageProps) {
  const [signingOut, setSigningOut] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLogout = async () => {
    setSigningOut(true);
    setError(null);
    try {
      await signOutUser();
    } catch (err) {
      setError((err as Error).message);
      setSigningOut(false);
    }
  };

  return (
    <main className="page-container">
      <section className="profile-card">
        <p className="eyebrow">Account</p>
        <h1 className="app-title">Your Profile</h1>

        <div className="profile-row">
          <span className="profile-label">Email</span>
          <strong className="profile-value">{email || "Signed-in Google User"}</strong>
        </div>

        <div className="profile-row">
          <span className="profile-label">Plan Status</span>
          <span className={`plan-pill ${isPaid ? "is-paid" : "is-free"}`}>
            {isPaid ? "Paid (Active 3-Month Pass)" : "Free Plan (10 questions / topic)"}
          </span>
        </div>

        {!isPaid && (
          <button
            type="button"
            className="step-btn primary-step"
            style={{ width: "100%", marginTop: 14 }}
            onClick={onOpenUpgrade}
          >
            View 3-Month Pass Details
          </button>
        )}

        {error && (
          <div className="error-card" role="alert" style={{ marginTop: 12 }}>
            <p style={{ margin: 0 }}>{error}</p>
          </div>
        )}

        <button
          type="button"
          className="logout-btn"
          disabled={signingOut}
          onClick={handleLogout}
        >
          {signingOut ? "Signing out..." : "Log Out"}
        </button>
      </section>
    </main>
  );
}