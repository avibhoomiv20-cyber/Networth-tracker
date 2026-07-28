"use client";

import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import {
  BookOpenText,
  ChartNoAxesCombined,
  ChevronLeft,
  ChevronRight,
  CircleAlert,
  Clock3,
  LayoutDashboard,
  LogOut,
  NotebookTabs,
  RefreshCw,
  Settings2,
  Sparkles,
  SlidersHorizontal,
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
  session: Session;
  workspace: WorkspaceSummary | null;
  trackerData: TrackerData | null;
  setupError: string;
  refreshing: boolean;
  refreshedAt: Date | null;
  onRefresh: () => void;
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
    description: "Your complete financial picture, month by month.",
  },
  insights: {
    title: "Insights",
    description: "Understand what changed and explore your live financial data.",
  },
  holdings: {
    title: "Holdings",
    description: "Accounts and current values, grouped your way.",
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

function sectionFromLocation(): AppSection {
  if (typeof window === "undefined") return "summary";
  const value = window.location.hash.replace("#", "") as AppSection;
  return sectionIds.has(value) ? value : "summary";
}

export function AppShell({
  session,
  workspace,
  trackerData,
  setupError,
  refreshing,
  refreshedAt,
  onRefresh,
}: AppShellProps) {
  const [activeSection, setActiveSection] =
    useState<AppSection>(sectionFromLocation);
  const [currentData, setCurrentData] = useState(trackerData);
  const [selectedMonth, setSelectedMonth] = useState("");
  const email = session.user.email ?? "Signed-in user";
  const initials = email.slice(0, 2).toUpperCase();
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

  const navigateSection = (section: AppSection) => {
    setActiveSection(section);
    window.history.pushState(null, "", `#${section}`);
  };

  const signOut = async () => {
    await getSupabaseClient()?.auth.signOut();
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
        <p className="workspace-label">Workspace</p>
        <p className="workspace-name">{workspace?.name ?? "My Net Worth"}</p>
        {nav("sidebar-nav")}

        <div className="sidebar-bottom">
          <div className="user-chip">
            <span className="user-avatar">{initials}</span>
            <span className="user-copy">
              <strong>Private account</strong>
              <span>{email}</span>
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
        {nav("mobile-nav")}

        <header className="page-header">
          <div>
            <h1>{copy.title}</h1>
            <p>{copy.description}</p>
          </div>
          <div className="header-actions">
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
              onClick={onRefresh}
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
                  ? `Data refreshed ${refreshedAt.toLocaleString("en-IN")}`
                  : undefined
              }
            >
              <span className="status-dot" />{" "}
              {syncRecoveryMode
                ? "Read-only recovery"
                : refreshedAt
                  ? `Refreshed ${formatRelativeRefresh(refreshedAt)}`
                  : "Synced workspace"}
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
            workspaceId={workspace.id}
            data={currentData}
            selectedMonth={activeMonth}
            refreshedAt={refreshedAt}
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
                  ? "Add your first account in the next setup step. Nothing is pre-filled, so this workspace stays entirely yours."
                  : "Your synced data could not be loaded. Refresh the page or review the message above."}
              </p>
            </div>
          </section>
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
