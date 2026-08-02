import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  CloudAccount,
  CloudEntry,
  CloudMonthlyNote,
  CloudSnapshot,
  TrackerData,
  WorkspaceSummary,
} from "@/lib/types";

export type WorkspaceLoadResult = {
  workspace: WorkspaceSummary | null;
  trackerData: TrackerData | null;
  setupError: string;
};

export async function loadPersonalWorkspace(
  supabase: SupabaseClient,
): Promise<WorkspaceLoadResult> {
  const { data: workspaceId, error: workspaceError } = await supabase.rpc(
    "nw_ensure_personal_workspace",
    { requested_name: "My Net Worth" },
  );

  if (workspaceError || !workspaceId) {
    return {
      workspace: null,
      trackerData: null,
      setupError:
        workspaceError?.message ?? "Your portfolio could not be prepared.",
    };
  }

  const [
    workspaceResult,
    accountResult,
    snapshotResult,
    entryResult,
    noteResult,
  ] = await Promise.all([
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

  const dataError =
    accountResult.error ??
    snapshotResult.error ??
    entryResult.error ??
    noteResult.error;

  if (workspaceResult.error || !workspaceResult.data || dataError) {
    return {
      workspace: null,
      trackerData: null,
      setupError:
        workspaceResult.error?.message ??
        dataError?.message ??
        "Your portfolio could not be loaded.",
    };
  }

  return {
    workspace: {
      id: workspaceResult.data.id,
      name: workspaceResult.data.name,
      accountCount: accountResult.count ?? 0,
    },
    trackerData: {
      accounts: (accountResult.data ?? []) as CloudAccount[],
      snapshots: (snapshotResult.data ?? []) as CloudSnapshot[],
      entries: (entryResult.data ?? []) as CloudEntry[],
      notes: (noteResult.data ?? []) as CloudMonthlyNote[],
    },
    setupError: "",
  };
}
