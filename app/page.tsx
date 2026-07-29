"use client";

import { useEffect, useRef, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { AuthPanel } from "@/components/auth/AuthPanel";
import { AppShell } from "@/components/shell/AppShell";
import { BrandMark } from "@/components/ui/BrandMark";
import {
  getSupabaseClient,
  isSupabaseConfigured,
} from "@/lib/supabase/client";
import type {
  CloudAccount,
  CloudEntry,
  CloudMonthlyNote,
  CloudSnapshot,
  TrackerData,
  WorkspaceSummary,
} from "@/lib/types";

export default function Home() {
  const [session, setSession] = useState<Session | null>(null);
  const [workspace, setWorkspace] = useState<WorkspaceSummary | null>(null);
  const [trackerData, setTrackerData] = useState<TrackerData | null>(null);
  const [loading, setLoading] = useState(isSupabaseConfigured);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshedAt, setRefreshedAt] = useState<Date | null>(null);
  const [setupError, setSetupError] = useState("");
  const refreshWorkspaceRef = useRef<(() => Promise<void>) | null>(null);

  useEffect(() => {
    const supabase = getSupabaseClient();

    if (!supabase) {
      return;
    }

    let active = true;
    let requestSequence = 0;
    let loadedUserId: string | null = null;

    const prepareWorkspace = async (
      nextSession: Session | null,
      resetView: boolean,
    ) => {
      if (!active) return;
      const requestID = ++requestSequence;

      setSession(nextSession);
      setSetupError("");
      if (resetView) {
        setWorkspace(null);
        setTrackerData(null);
      }

      if (!nextSession) {
        setLoading(false);
        return;
      }

      setLoading(true);
      const { data: workspaceId, error: workspaceError } = await supabase.rpc(
        "nw_ensure_personal_workspace",
        { requested_name: "My Net Worth" },
      );

      if (workspaceError || !workspaceId) {
        if (active) {
          setSetupError(
            workspaceError?.message ?? "Your workspace could not be prepared.",
          );
          setLoading(false);
        }
        return;
      }

      const [
        { data: workspaceRow, error: detailsError },
        accountResult,
        snapshotResult,
        entryResult,
        noteResult,
      ] =
        await Promise.all([
          supabase
            .from("nw_workspaces")
            .select("id, name")
            .eq("id", workspaceId)
            .single(),
          supabase
            .from("nw_accounts")
            .select(
              "id, name, class_raw, notes, ticker_symbol, broker_name, sort_order, revision",
              { count: "exact" },
            )
            .eq("workspace_id", workspaceId)
            .eq("is_archived", false)
            .order("sort_order"),
          supabase
            .from("nw_account_snapshots")
            .select(
              "id, account_id, captured_on, value_paise, quantity, unit_price_paise, usd_to_inr, source, note, revision",
            )
            .eq("workspace_id", workspaceId)
            .order("captured_on"),
          supabase
            .from("nw_account_entries")
            .select(
              "id, account_id, entry_date, description, comment, direction, amount_paise, quantity, unit_price_paise, usd_to_inr, revision",
            )
            .eq("workspace_id", workspaceId)
            .order("entry_date"),
          supabase
            .from("nw_monthly_notes")
            .select("month_start, note, revision")
            .eq("workspace_id", workspaceId)
            .order("month_start"),
        ]);

      if (!active || requestID !== requestSequence) return;

      const dataError =
        accountResult.error ??
        snapshotResult.error ??
        entryResult.error ??
        noteResult.error;

      if (detailsError || !workspaceRow || dataError) {
        setSetupError(
          detailsError?.message ??
            dataError?.message ??
            "Your workspace details could not be loaded.",
        );
      } else {
        setWorkspace({
          id: workspaceRow.id,
          name: workspaceRow.name,
          accountCount: accountResult.count ?? 0,
        });
        setTrackerData({
          accounts: (accountResult.data ?? []) as CloudAccount[],
          snapshots: (snapshotResult.data ?? []) as CloudSnapshot[],
          entries: (entryResult.data ?? []) as CloudEntry[],
          notes: (noteResult.data ?? []) as CloudMonthlyNote[],
        });
        setRefreshedAt(new Date());
      }

      setLoading(false);
    };

    refreshWorkspaceRef.current = async () => {
      const { data, error } = await supabase.auth.getSession();
      if (error) {
        setSetupError(error.message);
        return;
      }
      await prepareWorkspace(data.session, false);
    };

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, nextSession) => {
      const nextUserId = nextSession?.user.id ?? null;
      const userChanged = loadedUserId !== nextUserId;
      if (userChanged) {
        // Invalidate any in-flight request and remove the previous user's
        // workspace before rendering the new session.
        requestSequence += 1;
        loadedUserId = nextUserId;
        setWorkspace(null);
        setTrackerData(null);
        setRefreshedAt(null);
        setSetupError("");
        setLoading(Boolean(nextSession));
      }
      setSession(nextSession);

      if (event === "INITIAL_SESSION") {
        window.setTimeout(
          () => void prepareWorkspace(nextSession, true),
          0,
        );
        return;
      }

      if (event === "SIGNED_OUT") {
        window.setTimeout(() => void prepareWorkspace(null, true), 0);
        return;
      }

      if (
        event === "SIGNED_IN" &&
        nextSession &&
        userChanged
      ) {
        window.setTimeout(
          () => void prepareWorkspace(nextSession, true),
          0,
        );
      }
    });

    return () => {
      active = false;
      refreshWorkspaceRef.current = null;
      subscription.unsubscribe();
    };
  }, []);

  const refreshFromCloud = async () => {
    if (!refreshWorkspaceRef.current || refreshing) return;
    setRefreshing(true);
    try {
      await refreshWorkspaceRef.current();
    } finally {
      setRefreshing(false);
    }
  };

  if (loading) {
    return (
      <main className="loading-screen" aria-live="polite">
        <BrandMark size="large" />
        <div className="loading-line" />
        <p>Preparing your private workspace…</p>
      </main>
    );
  }

  if (!isSupabaseConfigured) {
    return (
      <main className="configuration-screen">
        <BrandMark size="large" />
        <section className="configuration-card">
          <p className="eyebrow">Configuration needed</p>
          <h1>Connect your Supabase project</h1>
          <p>
            Add the public Supabase URL and publishable key to{" "}
            <code>.env.local</code>, then restart the development server.
          </p>
        </section>
      </main>
    );
  }

  if (!session) {
    return <AuthPanel />;
  }

  return (
    <AppShell
      key={session.user.id}
      session={session}
      workspace={workspace}
      trackerData={trackerData}
      setupError={setupError}
      refreshing={refreshing}
      refreshedAt={refreshedAt}
      onRefresh={refreshFromCloud}
    />
  );
}
