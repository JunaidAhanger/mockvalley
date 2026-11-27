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
import { MyPlanPage } from "./pages/MyPlanPage";
import { PracticePage } from "./pages/PracticePage";
import { ProfilePage } from "./pages/ProfilePage";
import { UpgradePage } from "./pages/UpgradePage";

type ScreenMode = "nav" | "upgrade" | "plan";

export function App() {
  const [activeTab, setActiveTab] = useState<NavTab>("home");
  const [screenMode, setScreenMode] = useState<ScreenMode>("nav");
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [isPaid, setIsPaid] = useState(false);
  const [placeholderNote, setPlaceholderNote] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    getCurrentSession()
      .then(async (session) => {
        if (!active) return;
        const currentUser = session?.user ?? null;
        setUser(currentUser);
        if (currentUser) {
          await ensureUserProfile().catch(() => {});
          const paid = await checkIsPaid().catch(() => false);
          if (active) setIsPaid(paid);
        }
      })
      .finally(() => {
        if (active) setAuthLoading(false);
      });

    const unsubscribe = onAuthStateChange(async (nextUser) => {
      if (!active) return;
      setUser(nextUser);
      if (nextUser) {
        await ensureUserProfile().catch(() => {});
        const paid = await checkIsPaid().catch(() => false);
        if (active) setIsPaid(paid);
      } else {
        setIsPaid(false);
        setScreenMode("nav");
      }
    });

    return () => {
      active = false;
      unsubscribe();
    };
  }, []);

  const handleSelectTab = (tab: NavTab) => {
    setScreenMode("nav");
    setActiveTab(tab);

    if (tab === "home" || tab === "practice" || tab === "profile") {
      setPlaceholderNote(null);
      return;
    }

    const labels: Record<"current-affairs" | "exam", string> = {
      "current-affairs": "Current Affairs month picker will be built in a later step.",
      exam: "Timed Exam Mode will be built in a later step.",
    };
    setPlaceholderNote(labels[tab]);
  };

  const renderScreen = () => {
    if (authLoading) {
      return (
        <main className="page-container">
          <div className="state-card" role="status">
            Checking session...
          </div>
        </main>
      );
    }

    if (screenMode === "plan") {
      if (!user) {
        return <LoginPage reasonMessage="Sign in with Google to view or buy a pass." />;
      }
      return (
        <MyPlanPage
          isPaid={isPaid}
          onPassStateChanged={setIsPaid}
          onBackToPractice={() => {
            setScreenMode("nav");
            setActiveTab("practice");
          }}
        />
      );
    }

    if (screenMode === "upgrade") {
      if (!user) {
        return <LoginPage reasonMessage="Sign in with Google before viewing pass options." />;
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
          onOpenMyPlan={() => setScreenMode("plan")}
        />
      );
    }

    if (activeTab === "practice") {
      if (!user) {
        return (
          <LoginPage reasonMessage="Sign in with Google to start practicing by topic." />
        );
      }
      return <PracticePage onOpenUpgrade={() => setScreenMode("upgrade")} />;
    }

    if (activeTab === "profile") {
      if (!user) {
        return <LoginPage reasonMessage="Sign in with Google to view your profile." />;
      }
      return (
        <ProfilePage
          email={user.email ?? null}
          isPaid={isPaid}
          onOpenUpgrade={() => setScreenMode("plan")}
        />
      );
    }

    return <HomePage onOpenSection={handleSelectTab} statusMessage={placeholderNote} />;
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

      {renderScreen()}

      <BottomNav
        activeTab={screenMode === "nav" ? activeTab : "profile"}
        onSelectTab={handleSelectTab}
      />
    </div>
  );
}

export default App;