"use client";

import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import {
  BookOpenText,
  ChartNoAxesCombined,
  CircleAlert,
  Clock3,
  LayoutDashboard,
  LogOut,
  NotebookTabs,
  Settings2,
  SlidersHorizontal,
} from "lucide-react";
import { GettingStarted } from "@/components/onboarding/GettingStarted";
import { TrackerViews } from "@/components/tracker/TrackerViews";
import { BrandMark } from "@/components/ui/BrandMark";
import { getSupabaseClient } from "@/lib/supabase/client";
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
};

const sections: Array<{
  id: AppSection;
  label: string;
  icon: typeof LayoutDashboard;
}> = [
  { id: "summary", label: "Summary", icon: LayoutDashboard },
  { id: "holdings", label: "Holdings", icon: SlidersHorizontal },
  { id: "account-book", label: "Account Book", icon: BookOpenText },
  { id: "ledger", label: "Ledger", icon: NotebookTabs },
  { id: "history", label: "History", icon: Clock3 },
  { id: "setup", label: "Account Setup", icon: Settings2 },
];

const sectionCopy: Record<AppSection, { title: string; description: string }> = {
  summary: {
    title: "Summary",
    description: "Your complete financial picture, month by month.",
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
    title: "Account Setup",
    description: "Create and organise the accounts used by your tracker.",
  },
};

export function AppShell({
  session,
  workspace,
  trackerData,
  setupError,
}: AppShellProps) {
  const [activeSection, setActiveSection] = useState<AppSection>("summary");
  const [currentData, setCurrentData] = useState(trackerData);
  const email = session.user.email ?? "Signed-in user";
  const initials = email.slice(0, 2).toUpperCase();
  const copy = sectionCopy[activeSection];
  const isNewWorkspace =
    (currentData?.accounts.length ?? workspace?.accountCount ?? 0) === 0;

  useEffect(() => {
    setCurrentData(trackerData);
  }, [trackerData]);

  const signOut = async () => {
    await getSupabaseClient()?.auth.signOut();
  };

  const nav = (className: string) => (
    <nav className={className} aria-label="Tracker sections">
      {sections.map(({ id, label, icon: Icon }) => (
        <button
          className={activeSection === id ? "active" : ""}
          key={id}
          onClick={() => setActiveSection(id)}
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
            <span className="status-pill">
              <span className="status-dot" /> Synced workspace
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
