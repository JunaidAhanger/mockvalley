import { useState } from "react";
import { BottomNav, type NavTab } from "./components/BottomNav";
import { isSupabaseConfigured } from "./lib/supabase";
import { HomePage } from "./pages/HomePage";
import { PracticePage } from "./pages/PracticePage";

export function App() {
  const [activeTab, setActiveTab] = useState<NavTab>("home");
  const [placeholderNote, setPlaceholderNote] = useState<string | null>(null);

  const handleOpenSection = (tab: NavTab) => {
    setActiveTab(tab);
    if (tab === "home" || tab === "practice") {
      setPlaceholderNote(null);
      return;
    }

    const labels: Record<"current-affairs" | "exam", string> = {
      "current-affairs": "Current Affairs month picker will be built in a later step.",
      exam: "Timed Exam Mode will be built in a later step.",
    };
    setPlaceholderNote(labels[tab]);
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

      {activeTab === "practice" ? (
        <PracticePage />
      ) : (
        <HomePage onOpenSection={handleOpenSection} statusMessage={placeholderNote} />
      )}

      <BottomNav activeTab={activeTab} onSelectTab={handleOpenSection} />
    </div>
  );
}

export default App;