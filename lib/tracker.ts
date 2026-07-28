import type {
  AssetClass,
  CloudAccount,
  CloudSnapshot,
  TrackerData,
} from "@/lib/types";
import { parseMonthlyRemarks } from "@/lib/monthlyRemarks";

export const classOrder: AssetClass[] = [
  "cash",
  "bank",
  "investment",
  "retirement",
  "companyStock",
  "physical",
  "gold",
  "personal",
  "liability",
];

export const classLabels: Record<AssetClass, string> = {
  cash: "Cash",
  bank: "In Bank",
  investment: "Investments",
  retirement: "PPF / NPS",
  companyStock: "RSU / US Stock",
  physical: "Physical Assets",
  gold: "Gold",
  personal: "Personal Assets",
  liability: "Liabilities",
  liquid: "Liquid",
};

export type MonthlyRow = {
  monthId: string;
  byClass: Record<AssetClass, number>;
  byAccount: Record<string, number>;
  assets: number;
  liabilities: number;
  netWorth: number;
  note: string;
};

export function preferredSnapshotOrder(a: CloudSnapshot, b: CloudSnapshot) {
  const aIsCalculated = a.note === "Account Book calculated";
  const bIsCalculated = b.note === "Account Book calculated";
  if (aIsCalculated !== bIsCalculated) return aIsCalculated ? 1 : -1;

  const dateOrder = b.captured_on.localeCompare(a.captured_on);
  if (dateOrder !== 0) return dateOrder;

  const aIsWorkbookImport = a.note === "Workbook import";
  const bIsWorkbookImport = b.note === "Workbook import";
  if (aIsWorkbookImport !== bIsWorkbookImport) {
    return aIsWorkbookImport ? 1 : -1;
  }

  return b.revision - a.revision;
}

const emptyTotals = (): Record<AssetClass, number> => ({
  cash: 0,
  bank: 0,
  investment: 0,
  retirement: 0,
  companyStock: 0,
  physical: 0,
  gold: 0,
  personal: 0,
  liability: 0,
  liquid: 0,
});

export function buildMonthlyRows(data: TrackerData): MonthlyRow[] {
  const monthIds = Array.from(
    new Set([
      ...data.snapshots.map((item) => item.captured_on.slice(0, 7)),
      ...data.entries.map((item) => item.entry_date.slice(0, 7)),
      ...data.notes.map((item) => item.month_start.slice(0, 7)),
    ]),
  ).sort();

  const snapshots = new Map<string, (typeof data.snapshots)[number]>();
  for (const snapshot of data.snapshots) {
    const monthId = snapshot.captured_on.slice(0, 7);
    const key = `${snapshot.account_id}|${monthId}`;
    const existing = snapshots.get(key);
    if (!existing || preferredSnapshotOrder(snapshot, existing) < 0) {
      snapshots.set(key, snapshot);
    }
  }

  const deltas = new Map<string, number>();
  for (const entry of data.entries) {
    const monthId = entry.entry_date.slice(0, 7);
    const key = `${entry.account_id}|${monthId}`;
    const direction = entry.direction === "increase" ? 1 : -1;
    deltas.set(key, (deltas.get(key) ?? 0) + direction * entry.amount_paise);
  }

  const notes = new Map(
    data.notes.map((item) => [
      item.month_start.slice(0, 7),
      parseMonthlyRemarks(item.note).overall,
    ]),
  );
  const byMonth = new Map<string, MonthlyRow>();

  for (const monthId of monthIds) {
    byMonth.set(monthId, {
      monthId,
      byClass: emptyTotals(),
      byAccount: {},
      assets: 0,
      liabilities: 0,
      netWorth: 0,
      note: notes.get(monthId) ?? "",
    });
  }

  for (const account of data.accounts) {
    for (const monthId of monthIds) {
      const snapshot = snapshots.get(`${account.id}|${monthId}`);
      const movement = deltas.get(`${account.id}|${monthId}`) ?? 0;
      const row = byMonth.get(monthId);
      if (!row) continue;
      if (snapshot) {
        const value = Number(snapshot.value_paise);
        row.byAccount[account.id] = value;
        row.byClass[account.class_raw] += value;
      } else if (movement !== 0) {
        row.byAccount[account.id] = movement;
        row.byClass[account.class_raw] += movement;
      }
    }
  }

  return monthIds.map((monthId) => {
    const row = byMonth.get(monthId)!;
    row.liabilities = row.byClass.liability;
    row.assets = Object.entries(row.byClass).reduce(
      (total, [assetClass, value]) =>
        assetClass === "liability" ? total : total + value,
      0,
    );
    row.netWorth = row.assets - row.liabilities;
    return row;
  });
}

export function formatINR(paise: number, compact = false): string {
  const rupees = paise / 100;
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
    notation: compact ? "compact" : "standard",
  }).format(rupees);
}

export function formatMonth(monthId: string): string {
  return new Intl.DateTimeFormat("en-IN", {
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${monthId}-01T00:00:00Z`));
}

export function accountsByClass(accounts: CloudAccount[]) {
  return classOrder
    .map((assetClass) => ({
      assetClass,
      accounts: accounts.filter((account) => account.class_raw === assetClass),
    }))
    .filter((group) => group.accounts.length > 0);
}
