"use client";

import { useEffect, useState } from "react";
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
  const [setupError, setSetupError] = useState("");

  useEffect(() => {
    const supabase = getSupabaseClient();

    if (!supabase) {
      return;
    }

    let active = true;
    let requestSequence = 0;

    const prepareWorkspace = async (nextSession: Session | null) => {
      if (!active) return;
      const requestID = ++requestSequence;

      setSession(nextSession);
      setWorkspace(null);
      setTrackerData(null);
      setSetupError("");

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
              "id, name, class_raw, notes, ticker_symbol, broker_name, sort_order",
              { count: "exact" },
            )
            .eq("workspace_id", workspaceId)
            .eq("is_archived", false)
            .order("sort_order"),
          supabase
            .from("nw_account_snapshots")
            .select(
              "id, account_id, captured_on, value_paise, quantity, unit_price_paise, usd_to_inr, source, note",
            )
            .eq("workspace_id", workspaceId)
            .order("captured_on"),
          supabase
            .from("nw_account_entries")
            .select(
              "id, account_id, entry_date, description, comment, direction, amount_paise, quantity, unit_price_paise, usd_to_inr",
            )
            .eq("workspace_id", workspaceId)
            .order("entry_date"),
          supabase
            .from("nw_monthly_notes")
            .select("month_start, note")
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
      }

      setLoading(false);
    };

    supabase.auth.getSession().then(({ data }) => {
      void prepareWorkspace(data.session);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      window.setTimeout(() => void prepareWorkspace(nextSession), 0);
    });

    const refreshFromCloud = () => {
      if (document.visibilityState !== "visible") return;
      void supabase.auth.getSession().then(({ data }) => {
        void prepareWorkspace(data.session);
      });
    };

    window.addEventListener("focus", refreshFromCloud);
    document.addEventListener("visibilitychange", refreshFromCloud);

    return () => {
      active = false;
      subscription.unsubscribe();
      window.removeEventListener("focus", refreshFromCloud);
      document.removeEventListener("visibilitychange", refreshFromCloud);
    };
  }, []);

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
      session={session}
      workspace={workspace}
      trackerData={trackerData}
      setupError={setupError}
    />
  );
}
