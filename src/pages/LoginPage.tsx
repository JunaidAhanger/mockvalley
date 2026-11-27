import { useState } from "react";
import { signInWithGoogle } from "../lib/practiceApi";

interface LoginPageProps {
  reasonMessage?: string | null;
}

export function LoginPage({ reasonMessage }: LoginPageProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleGoogleLogin = async () => {
    setLoading(true);
    setError(null);
    try {
      await signInWithGoogle();
    } catch (err) {
      setError((err as Error).message);
      setLoading(false);
    }
  };

  return (
    <main className="page-container">
      <section className="auth-card">
        <p className="eyebrow">MockValley • JKSSB Prep</p>
        <h1 className="app-title">Sign in to continue</h1>
        <p className="subtitle">
          {reasonMessage ||
            "Sign in with Google to track your free topic practice, retry attempted questions, and manage your pass."}
        </p>

        {error && (
          <div className="error-card" role="alert" style={{ marginTop: 14 }}>
            <p style={{ margin: 0 }}>{error}</p>
          </div>
        )}

        <button
          type="button"
          className="google-btn"
          disabled={loading}
          onClick={handleGoogleLogin}
        >
          {loading ? "Redirecting to Google..." : "Continue with Google"}
        </button>
      </section>
    </main>
  );
}