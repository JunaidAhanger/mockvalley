export type NavTab = "home" | "practice" | "current-affairs" | "exam";

interface BottomNavProps {
  activeTab: NavTab;
  onSelectTab: (tab: NavTab) => void;
}

const NAV_ITEMS: Array<{ id: NavTab; label: string }> = [
  { id: "home", label: "Home" },
  { id: "practice", label: "Practice" },
  { id: "current-affairs", label: "Current" },
  { id: "exam", label: "Exam" },
];

export function BottomNav({ activeTab, onSelectTab }: BottomNavProps) {
  return (
    <nav className="bottom-nav" aria-label="Primary navigation">
      {NAV_ITEMS.map((item) => {
        const isActive = activeTab === item.id;
        return (
          <button
            key={item.id}
            type="button"
            className={`nav-btn ${isActive ? "is-active" : ""}`}
            onClick={() => onSelectTab(item.id)}
            aria-current={isActive ? "page" : undefined}
          >
            <span>{item.label}</span>
          </button>
        );
      })}
    </nav>
  );
}