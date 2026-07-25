import type {
  AssetClass,
  CloudAccount,
  TrackerData,
} from "@/lib/types";

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
    if (!existing || snapshot.captured_on >= existing.captured_on) {
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
    data.notes.map((item) => [item.month_start.slice(0, 7), item.note]),
  );
  const firstEntryMonth = data.entries
    .map((entry) => entry.entry_date.slice(0, 7))
    .sort()[0];
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
    let carriedValue: number | null = null;
    let cumulativeDelta = 0;

    for (const monthId of monthIds) {
      const snapshot = snapshots.get(`${account.id}|${monthId}`);
      if (snapshot) carriedValue = Number(snapshot.value_paise);
      cumulativeDelta += deltas.get(`${account.id}|${monthId}`) ?? 0;

      const ledgerStarted = Boolean(firstEntryMonth && firstEntryMonth <= monthId);
      if (!snapshot && !ledgerStarted) continue;
      if (carriedValue === null && cumulativeDelta === 0) continue;

      const value = (carriedValue ?? 0) + cumulativeDelta;
      const row = byMonth.get(monthId);
      if (!row) continue;
      row.byAccount[account.id] = value;
      row.byClass[account.class_raw] += value;
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
