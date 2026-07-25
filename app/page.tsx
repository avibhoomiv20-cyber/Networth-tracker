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
import type { WorkspaceSummary } from "@/lib/types";

export default function Home() {
  const [session, setSession] = useState<Session | null>(null);
  const [workspace, setWorkspace] = useState<WorkspaceSummary | null>(null);
  const [loading, setLoading] = useState(isSupabaseConfigured);
  const [setupError, setSetupError] = useState("");

  useEffect(() => {
    const supabase = getSupabaseClient();

    if (!supabase) {
      return;
    }

    let active = true;

    const prepareWorkspace = async (nextSession: Session | null) => {
      if (!active) return;

      setSession(nextSession);
      setWorkspace(null);
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

      const [{ data: workspaceRow, error: detailsError }, accountResult] =
        await Promise.all([
          supabase
            .from("nw_workspaces")
            .select("id, name")
            .eq("id", workspaceId)
            .single(),
          supabase
            .from("nw_accounts")
            .select("id", { count: "exact", head: true })
            .eq("workspace_id", workspaceId)
            .eq("is_archived", false),
        ]);

      if (!active) return;

      if (detailsError || !workspaceRow) {
        setSetupError(
          detailsError?.message ?? "Your workspace details could not be loaded.",
        );
      } else {
        setWorkspace({
          id: workspaceRow.id,
          name: workspaceRow.name,
          accountCount: accountResult.count ?? 0,
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

    return () => {
      active = false;
      subscription.unsubscribe();
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
      setupError={setupError}
    />
  );
}
