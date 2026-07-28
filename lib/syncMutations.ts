import { getSupabaseClient } from "@/lib/supabase/client";

export type SyncEntity = "account" | "snapshot" | "entry" | "note";
export type SyncAction = "upsert" | "delete";

export type SyncOperation = {
  entity: SyncEntity;
  action: SyncAction;
  key: string;
  base_revision: number;
  row?: Record<string, unknown>;
};

export type SyncConflict = {
  entity: SyncEntity;
  key: string;
  reason: string;
  base_revision: number;
  cloud_revision: number | null;
  canonical_key?: string;
  cloud_row?: Record<string, unknown> | null;
};

export type SyncBatchResponse = {
  status: "applied" | "conflict";
  batch_id: string;
  high_water: number;
  conflicts: SyncConflict[];
  results: Array<{
    entity: SyncEntity;
    action: SyncAction;
    key: string;
    revision: number;
    row: Record<string, unknown> | null;
  }>;
};

export class SyncConflictError extends Error {
  readonly conflicts: SyncConflict[];

  constructor(conflicts: SyncConflict[]) {
    super(
      "This data changed somewhere else. Review the cloud version before choosing which version to keep.",
    );
    this.name = "SyncConflictError";
    this.conflicts = conflicts;
  }
}

export function syncErrorMessage(error: unknown, fallback: string) {
  if (error instanceof SyncConflictError) {
    return "This record changed on another device. Refresh data, review the latest value, then try again.";
  }
  return error instanceof Error ? error.message : fallback;
}

export function appliedRows<T>(
  response: SyncBatchResponse,
  entity: SyncEntity,
): T[] {
  return response.results
    .filter(
      (result) =>
        result.entity === entity &&
        result.action === "upsert" &&
        result.row !== null,
    )
    .map((result) => result.row as T);
}

/**
 * The only mutation path used after recovery mode is disabled. Supabase
 * validates all base revisions before changing a row, applies the full batch
 * transactionally, and caches the batch ID for safe network retries.
 */
export async function applySyncBatch(
  workspaceId: string,
  operations: SyncOperation[],
  batchId = crypto.randomUUID(),
): Promise<SyncBatchResponse> {
  const supabase = getSupabaseClient();
  if (!supabase) throw new Error("Cloud connection is unavailable.");

  const { data, error } = await supabase.rpc("nw_apply_sync_batch", {
    target_workspace_id: workspaceId,
    batch_id: batchId,
    operations,
  });
  if (error) throw new Error(error.message);

  const response = data as SyncBatchResponse;
  if (response.status === "conflict") {
    throw new SyncConflictError(response.conflicts);
  }
  return response;
}
