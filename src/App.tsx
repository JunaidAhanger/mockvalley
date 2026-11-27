import { useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { BottomNav, type NavTab } from "./components/BottomNav";
import {
  checkIsPaid,
  ensureUserProfile,
  getCurrentSession,
  onAuthStateChange,
} from "./lib/practiceApi";
import { isSupabaseConfigured } from "./lib/supabase";
import { HomePage } from "./pages/HomePage";
import { LoginPage } from "./pages/LoginPage";
import { PracticePage } from "./pages/PracticePage";
import { ProfilePage } from "./pages/ProfilePage";
import { UpgradePage } from "./pages/UpgradePage";

type ScreenMode = "nav" | "upgrade";

export function App() {
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [isPaid, setIsPaid] = useState(false);

  const [activeTab, setActiveTab] = useState<NavTab>("home");
  const [screenMode, setScreenMode] = useState<ScreenMode>("nav");
  const [placeholderNote, setPlaceholderNote] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    getCurrentSession()
      .then(async (session) => {
        if (!mounted) return;
        const currentUser = session?.user ?? null;
        setUser(currentUser);
        if (currentUser) {
          await ensureUserProfile().catch(() => {});
          const paid = await checkIsPaid().catch(() => false);
          if (mounted) setIsPaid(paid);
        }
      })
      .finally(() => {
        if (mounted) setAuthLoading(false);
      });

    const unsubscribe = onAuthStateChange(async (nextUser) => {
      if (!mounted) return;
      setUser(nextUser);
      if (nextUser) {
        await ensureUserProfile().catch(() => {});
        const paid = await checkIsPaid().catch(() => false);
        if (mounted) setIsPaid(paid);
      } else {
        setIsPaid(false);
      }
    });

    return () => {
      mounted = false;
      unsubscribe();
    };
  }, []);

  const handleOpenSection = (tab: NavTab) => {
    setScreenMode("nav");
    setActiveTab(tab);
    if (tab === "home" || tab === "practice" || tab === "profile") {
      setPlaceholderNote(null);
      return;
    }

    if (tab === "current-affairs") {
      setPlaceholderNote("Current Affairs month picker will be built in a later step.");
    } else if (tab === "exam") {
      setPlaceholderNote("Timed Exam Mode will be built in a later step.");
    }
  };

  const renderBody = () => {
    if (authLoading) {
      return (
        <main className="page-container">
          <div className="state-card" role="status">
            Checking session...
          </div>
        </main>
      );
    }

    if (screenMode === "upgrade") {
      if (!user) {
        return <LoginPage reasonMessage="Sign in with Google before viewing pass or upgrade options." />;
      }
      return (
        <UpgradePage
          onBackToPractice={() => {
            setScreenMode("nav");
            setActiveTab("practice");
          }}
          onOpenProfile={() => {
            setScreenMode("nav");
            setActiveTab("profile");
          }}
        />
      );
    }

    if (activeTab === "practice") {
      if (!user) {
        return <LoginPage reasonMessage="Sign in with Google to start practicing questions." />;
      }
      return <PracticePage onOpenUpgrade={() => setScreenMode("upgrade")} />;
    }

    if (activeTab === "profile") {
      if (!user) {
        return <LoginPage reasonMessage="Sign in with Google to view your profile and plan." />;
      }
      return (
        <ProfilePage
          email={user.email ?? null}
          isPaid={isPaid}
          onOpenUpgrade={() => setScreenMode("upgrade")}
        />
      );
    }

    return <HomePage onOpenSection={handleOpenSection} statusMessage={placeholderNote} />;
  };

  return (
    <div className="app-shell">
      {!isSupabaseConfigured && (
        <div className="page-container" style={{ paddingBottom: 0 }}>
          <div className="notice-banner" role="status">
            Supabase keys are not set yet. Copy <strong>.env.example</strong> to{" "}
            <strong>.env</strong> and add your project URL and anon key.
          </div>
        </div>
      )}

      {renderBody()}

      <BottomNav activeTab={activeTab} onSelectTab={handleOpenSection} />
    </div>
  );
}

export default App;