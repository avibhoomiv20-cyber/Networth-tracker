import {
  buildMonthlyRows,
  classOrder,
  preferredSnapshotOrder,
  type MonthlyRow,
} from "@/lib/tracker";
import type {
  AssetClass,
  CloudAccount,
  CloudEntry,
  CloudSnapshot,
  TrackerData,
} from "@/lib/types";

const accountMonthKey = (accountId: string, month: string) =>
  `${accountId}|${month}`;

export type PortfolioReadModel = {
  monthlyRows: MonthlyRow[];
  accountsByClass: Map<AssetClass, CloudAccount[]>;
  accountsById: Map<string, CloudAccount>;
  preferredSnapshots: Map<string, CloudSnapshot>;
  entriesByAccountMonth: Map<string, CloudEntry[]>;
  sortedSnapshots: CloudSnapshot[];
  sortedEntries: CloudEntry[];
  snapshotFor: (accountId: string, month: string) => CloudSnapshot | undefined;
  entriesFor: (accountId: string, month: string) => CloudEntry[];
};

export function buildPortfolioReadModel(data: TrackerData): PortfolioReadModel {
  const indexedClasses: AssetClass[] = [...classOrder, "liquid"];
  const accountsByClass = new Map<AssetClass, CloudAccount[]>(
    indexedClasses.map(
      (assetClass): [AssetClass, CloudAccount[]] => [assetClass, []],
    ),
  );
  const accountsById = new Map<string, CloudAccount>();
  for (const account of data.accounts) {
    accountsById.set(account.id, account);
    accountsByClass.get(account.class_raw)?.push(account);
  }

  const preferredSnapshots = new Map<string, CloudSnapshot>();
  for (const snapshot of data.snapshots) {
    const month = snapshot.captured_on.slice(0, 7);
    const key = accountMonthKey(snapshot.account_id, month);
    const existing = preferredSnapshots.get(key);
    if (!existing || preferredSnapshotOrder(snapshot, existing) < 0) {
      preferredSnapshots.set(key, snapshot);
    }
  }

  const entriesByAccountMonth = new Map<string, CloudEntry[]>();
  for (const entry of data.entries) {
    const month = entry.entry_date.slice(0, 7);
    const key = accountMonthKey(entry.account_id, month);
    const entries = entriesByAccountMonth.get(key) ?? [];
    entries.push(entry);
    entriesByAccountMonth.set(key, entries);
  }

  return {
    monthlyRows: buildMonthlyRows(data),
    accountsByClass,
    accountsById,
    preferredSnapshots,
    entriesByAccountMonth,
    sortedSnapshots: [...data.snapshots].sort((a, b) =>
      b.captured_on.localeCompare(a.captured_on),
    ),
    sortedEntries: [...data.entries].sort((a, b) =>
      b.entry_date.localeCompare(a.entry_date),
    ),
    snapshotFor(accountId, month) {
      return preferredSnapshots.get(accountMonthKey(accountId, month));
    },
    entriesFor(accountId, month) {
      return entriesByAccountMonth.get(accountMonthKey(accountId, month)) ?? [];
    },
  };
}
