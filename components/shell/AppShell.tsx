"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  BookOpenText,
  ChartNoAxesCombined,
  ChevronLeft,
  ChevronRight,
  CircleAlert,
  Clock3,
  LayoutDashboard,
  LogOut,
  MoreHorizontal,
  NotebookTabs,
  RefreshCw,
  Settings2,
  Sparkles,
  SlidersHorizontal,
  Palette,
  X,
} from "lucide-react";
import { GettingStarted } from "@/components/onboarding/GettingStarted";
import { TrackerViews } from "@/components/tracker/TrackerViews";
import { BrandMark } from "@/components/ui/BrandMark";
import { getSupabaseClient } from "@/lib/supabase/client";
import { syncRecoveryMode } from "@/lib/syncMode";
import type {
  AppSection,
  TrackerData,
  WorkspaceSummary,
} from "@/lib/types";

type AppShellProps = {
  userId: string;
  workspace: WorkspaceSummary | null;
  trackerData: TrackerData | null;
  setupError: string;
  refreshedAt: string | null;
};

const sections: Array<{
  id: AppSection;
  label: string;
  icon: typeof LayoutDashboard;
}> = [
  { id: "summary", label: "Overview", icon: LayoutDashboard },
  { id: "insights", label: "Insights", icon: Sparkles },
  { id: "holdings", label: "Holdings", icon: SlidersHorizontal },
  { id: "account-book", label: "Account Book", icon: BookOpenText },
  { id: "ledger", label: "Ledger", icon: NotebookTabs },
  { id: "history", label: "History", icon: Clock3 },
  { id: "setup", label: "Settings", icon: Settings2 },
];

const sectionCopy: Record<AppSection, { title: string; description: string }> = {
  summary: {
    title: "Overview",
    description: "Your net worth and asset position, month by month.",
  },
  insights: {
    title: "Insights",
    description: "Clear observations from your portfolio, with optional privacy-safe AI.",
  },
  holdings: {
    title: "Holdings",
    description: "Update the month-end value of your assets and liabilities.",
  },
  "account-book": {
    title: "Account Book",
    description: "Record money in, money out and quantity movements.",
  },
  ledger: {
    title: "Ledger",
    description: "Review monthly balances across your accounts.",
  },
  history: {
    title: "History",
    description: "Follow the changes behind your net-worth trend.",
  },
  setup: {
    title: "Settings",
    description: "Create and organise the accounts used by your tracker.",
  },
};

const sectionIds = new Set<AppSection>(sections.map((section) => section.id));
const mobilePrimarySections = sections.filter(({ id }) =>
  ["summary", "insights", "holdings", "account-book"].includes(id),
);
const mobileSecondarySections = sections.filter(({ id }) =>
  ["ledger", "history", "setup"].includes(id),
);

function sectionFromLocation(): AppSection {
  if (typeof window === "undefined") return "summary";
  const value = window.location.hash.replace("#", "") as AppSection;
  return sectionIds.has(value) ? value : "summary";
}

export function AppShell({
  userId,
  workspace,
  trackerData,
  setupError,
  refreshedAt,
}: AppShellProps) {
  const router = useRouter();
  const [refreshing, startRefresh] = useTransition();
  const [activeSection, setActiveSection] =
    useState<AppSection>(sectionFromLocation);
  const [currentData, setCurrentData] = useState(trackerData);
  const [selectedMonth, setSelectedMonth] = useState("");
  const [theme, setTheme] = useState("montaire");
  const [showsMore, setShowsMore] = useState(false);
  const copy = sectionCopy[activeSection];
  const isNewWorkspace =
    (currentData?.accounts.length ?? workspace?.accountCount ?? 0) === 0;
  const activeMonth = selectedMonth || currentLocalMonth();
  const usesMonthlyView = [
    "summary",
    "insights",
    "holdings",
    "account-book",
  ].includes(activeSection);

  useEffect(() => {
    setCurrentData(trackerData);
  }, [trackerData]);

  useEffect(() => {
    const syncSection = () => setActiveSection(sectionFromLocation());
    window.addEventListener("hashchange", syncSection);
    window.addEventListener("popstate", syncSection);
    return () => {
      window.removeEventListener("hashchange", syncSection);
      window.removeEventListener("popstate", syncSection);
    };
  }, []);

  useEffect(() => {
    const saved = window.localStorage.getItem("networth-theme");
    if (saved) setTheme(saved);
  }, []);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    window.localStorage.setItem("networth-theme", theme);
  }, [theme]);

  const navigateSection = (section: AppSection) => {
    setActiveSection(section);
    setShowsMore(false);
    window.history.pushState(null, "", `#${section}`);
  };

  const signOut = async () => {
    await getSupabaseClient()?.auth.signOut();
    router.replace("/");
    router.refresh();
  };

  const refreshFromCloud = () => {
    startRefresh(() => router.refresh());
  };

  const moveMonth = (amount: number) => {
    const date = new Date(`${activeMonth}-01T00:00:00Z`);
    date.setUTCMonth(date.getUTCMonth() + amount);
    setSelectedMonth(date.toISOString().slice(0, 7));
  };

  const nav = (className: string) => (
    <nav className={className} aria-label="Tracker sections">
      {sections.map(({ id, label, icon: Icon }) => (
        <button
          className={activeSection === id ? "active" : ""}
          key={id}
          onClick={() => navigateSection(id)}
          aria-current={activeSection === id ? "page" : undefined}
          type="button"
        >
          <Icon size={17} />
          <span>{label}</span>
        </button>
      ))}
    </nav>
  );

  return (
    <div className="app-layout">
      <aside className="sidebar">
        <BrandMark />
        <p className="workspace-label">Portfolio</p>
        <p className="workspace-name">{workspace?.name ?? "My Net Worth"}</p>
        {nav("sidebar-nav")}

        <div className="sidebar-bottom">
          <div className="user-chip">
            <span className="user-avatar" aria-hidden="true">AT</span>
            <span className="user-copy">
              <strong>Cloud connected</strong>
              <span>Personal portfolio</span>
            </span>
          </div>
          <button className="sign-out" onClick={signOut} type="button">
            <LogOut size={15} /> Sign out
          </button>
        </div>
      </aside>

      <main className="main-area">
        <header className="mobile-header">
          <BrandMark />
          <button className="secondary-button" onClick={signOut} type="button">
            <LogOut size={15} />
            <span>Sign out</span>
          </button>
        </header>
        <header className="page-header">
          <div>
            <h1>{copy.title}</h1>
            <p>{copy.description}</p>
          </div>
          <div className="header-actions">
            <label className="theme-picker">
              <Palette size={15} />
              <span className="sr-only">Theme</span>
              <select aria-label="Theme" onChange={(event) => setTheme(event.target.value)} value={theme}>
                <option value="montaire">Ivory</option>
                <option value="obsidian">Dark</option>
                <option value="sapphire">Sapphire</option>
                <option value="bali">Veranda</option>
              </select>
            </label>
            {usesMonthlyView && (
              <div className="month-navigator" aria-label="Selected month">
                <button
                  aria-label="Previous month"
                  onClick={() => moveMonth(-1)}
                  type="button"
                >
                  <ChevronLeft size={18} />
                </button>
                <strong>{formatLongMonth(activeMonth)}</strong>
                <button
                  aria-label="Next month"
                  onClick={() => moveMonth(1)}
                  type="button"
                >
                  <ChevronRight size={18} />
                </button>
              </div>
            )}
            <button
              className="secondary-button"
              disabled={refreshing}
              onClick={refreshFromCloud}
              type="button"
            >
              <RefreshCw
                className={refreshing ? "spin" : undefined}
                size={16}
              />
              <span>{refreshing ? "Refreshing…" : "Refresh data"}</span>
            </button>
            <span
              className="status-pill"
              title={
                refreshedAt
                  ? `Data refreshed ${new Date(refreshedAt).toLocaleString("en-IN")}`
                  : undefined
              }
            >
              <span className="status-dot" />{" "}
              {syncRecoveryMode
                ? "Read-only recovery"
                : refreshedAt
                  ? `Refreshed ${formatRelativeRefresh(new Date(refreshedAt))}`
                  : "Cloud connected"}
            </span>
          </div>
        </header>

        {setupError && (
          <div className="error-banner" role="alert">
            <CircleAlert size={18} />
            <span>{setupError}</span>
          </div>
        )}

        {activeSection === "summary" && isNewWorkspace ? (
          <GettingStarted />
        ) : currentData && workspace ? (
          <TrackerViews
            section={activeSection}
            userId={userId}
            workspaceId={workspace.id}
            data={currentData}
            selectedMonth={activeMonth}
            refreshedAt={refreshedAt ? new Date(refreshedAt) : null}
            onDataChange={setCurrentData}
          />
        ) : (
          <section className="empty-view">
            <div>
              <span className="empty-view-icon">
                <ChartNoAxesCombined size={23} />
              </span>
              <h2>
                {isNewWorkspace
                  ? `${copy.title} will be ready after setup`
                  : `${copy.title} is connected`}
              </h2>
              <p>
                {isNewWorkspace
                  ? "Add your first account in Settings. Nothing is pre-filled, so this portfolio stays entirely yours."
                  : "Your synced data could not be loaded. Refresh the page or review the message above."}
              </p>
            </div>
          </section>
        )}

        <nav className="mobile-bottom-nav" aria-label="Primary destinations">
          {mobilePrimarySections.map(({ id, label, icon: Icon }) => (
            <button
              className={activeSection === id ? "active" : ""}
              key={id}
              onClick={() => navigateSection(id)}
              aria-current={activeSection === id ? "page" : undefined}
              type="button"
            >
              <Icon size={18} />
              <span>{id === "account-book" ? "Book" : label}</span>
            </button>
          ))}
          <button
            aria-expanded={showsMore}
            className={
              mobileSecondarySections.some(({ id }) => id === activeSection)
                ? "active"
                : ""
            }
            onClick={() => setShowsMore((visible) => !visible)}
            type="button"
          >
            <MoreHorizontal size={19} />
            <span>More</span>
          </button>
        </nav>

        {showsMore && (
          <div
            className="more-sheet-backdrop"
            onMouseDown={() => setShowsMore(false)}
            role="presentation"
          >
            <section
              aria-label="More destinations"
              aria-modal="true"
              className="more-sheet"
              onMouseDown={(event) => event.stopPropagation()}
              role="dialog"
            >
              <header>
                <strong>More</strong>
                <button
                  aria-label="Close more destinations"
                  onClick={() => setShowsMore(false)}
                  type="button"
                >
                  <X size={18} />
                </button>
              </header>
              {mobileSecondarySections.map(({ id, label, icon: Icon }) => (
                <button
                  className={activeSection === id ? "active" : ""}
                  key={id}
                  onClick={() => navigateSection(id)}
                  type="button"
                >
                  <Icon size={18} />
                  <span>{label}</span>
                </button>
              ))}
            </section>
          </div>
        )}
      </main>
    </div>
  );
}

function formatLongMonth(month: string) {
  return new Intl.DateTimeFormat("en-IN", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${month}-01T00:00:00Z`));
}

function currentLocalMonth() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

function formatRelativeRefresh(date: Date) {
  const minutes = Math.max(
    0,
    Math.round((Date.now() - date.getTime()) / 60_000),
  );
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  return date.toLocaleTimeString("en-IN", {
    hour: "numeric",
    minute: "2-digit",
  });
}
