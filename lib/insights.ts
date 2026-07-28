import {
  buildMonthlyRows,
  classLabels,
  classOrder,
  formatINR,
  formatMonth,
} from "@/lib/tracker";
import type {
  FinancialInsight,
  InsightTone,
  TrackerData,
} from "@/lib/types";

export type InsightRange = 1 | 3 | 12;

export type InsightBriefing = {
  monthId: string;
  periodLabel: string;
  netWorth: number;
  change: number;
  changePercent: number | null;
  dataThrough: string | null;
  insights: FinancialInsight[];
};

const signedCurrency = (value: number) =>
  `${value >= 0 ? "+" : "−"}${formatINR(Math.abs(value))}`;

const percent = (value: number) =>
  `${Math.abs(value).toLocaleString("en-IN", {
    maximumFractionDigits: 1,
  })}%`;

function insight(
  value: FinancialInsight,
  enabled = true,
): FinancialInsight | null {
  return enabled ? value : null;
}

export function buildInsightBriefing(
  data: TrackerData,
  selectedMonth: string,
  range: InsightRange,
): InsightBriefing | null {
  const rows = buildMonthlyRows(data);
  const currentIndex = rows.findIndex((row) => row.monthId === selectedMonth);
  if (currentIndex < 0) return null;

  const current = rows[currentIndex];
  const comparisonIndex = Math.max(0, currentIndex - range);
  const comparison = rows[comparisonIndex];
  const previous = currentIndex > 0 ? rows[currentIndex - 1] : undefined;
  const periodChange = current.netWorth - comparison.netWorth;
  const changePercent =
    comparison.netWorth !== 0
      ? (periodChange / Math.abs(comparison.netWorth)) * 100
      : null;
  const assets = Math.max(current.assets, 1);

  const classChanges = classOrder
    .map((assetClass) => ({
      assetClass,
      change:
        current.byClass[assetClass] -
        (comparison.byClass[assetClass] ?? 0),
    }))
    .sort((a, b) => Math.abs(b.change) - Math.abs(a.change));
  const primaryDriver = classChanges.find((item) => item.change !== 0);

  const holdings = Object.entries(current.byAccount)
    .map(([accountId, value]) => ({
      account: data.accounts.find((item) => item.id === accountId),
      value,
    }))
    .filter(
      (
        item,
      ): item is {
        account: NonNullable<typeof item.account>;
        value: number;
      } =>
        item.account !== undefined &&
        item.value > 0 &&
        item.account.class_raw !== "liability",
    )
    .sort((a, b) => b.value - a.value);
  const largest = holdings[0];
  const concentration = largest ? (largest.value / assets) * 100 : 0;
  const liquidValue =
    current.byClass.cash + current.byClass.bank + current.byClass.liquid;
  const liquidShare = (liquidValue / assets) * 100;
  const debtShare = (current.liabilities / assets) * 100;
  const debtChange =
    current.liabilities - (comparison.byClass.liability ?? 0);

  const currentAccountIds = new Set(Object.keys(current.byAccount));
  const missingAccounts = data.accounts.filter(
    (account) =>
      !currentAccountIds.has(account.id) && account.class_raw !== "liquid",
  );
  const recordedSnapshots = data.snapshots
    .map((item) => item.captured_on)
    .sort();
  const dataThrough = recordedSnapshots.at(-1) ?? null;
  const periodLabel =
    range === 1
      ? `since ${formatMonth(comparison.monthId)}`
      : `over ${Math.min(range, currentIndex)} months`;

  const cards = [
    insight({
      id: "net-worth-movement",
      tone: periodChange >= 0 ? "progress" : "attention",
      eyebrow: "What changed",
      title:
        periodChange >= 0
          ? `Net worth increased ${changePercent === null ? "" : percent(changePercent)}`
          : `Net worth decreased ${changePercent === null ? "" : percent(changePercent)}`,
      summary: `${formatINR(current.netWorth)} as of ${formatMonth(current.monthId)}, ${periodLabel}.`,
      impact: signedCurrency(periodChange),
      why: "This compares the selected month’s total assets minus liabilities with the comparison period.",
      source: `${formatMonth(comparison.monthId)} and ${formatMonth(current.monthId)} monthly totals`,
      question: `Explain why my net worth changed ${periodLabel}.`,
    }, currentIndex > 0),
    insight(
      {
        id: "primary-driver",
        tone: (primaryDriver?.change ?? 0) >= 0 ? "change" : "attention",
        eyebrow: "Biggest driver",
        title: `${primaryDriver ? classLabels[primaryDriver.assetClass] : "Holdings"} had the largest movement`,
        summary: `This category contributed the biggest absolute change ${periodLabel}.`,
        impact: signedCurrency(primaryDriver?.change ?? 0),
        why: "Category closing values were compared across the selected period and ranked by absolute movement.",
        source: `${classLabels[primaryDriver?.assetClass ?? "cash"]} monthly closing values`,
        question: `Break down the movement in ${classLabels[primaryDriver?.assetClass ?? "cash"]}.`,
      },
      Boolean(primaryDriver),
    ),
    insight(
      {
        id: "concentration",
        tone: concentration >= 35 ? "attention" : "opportunity",
        eyebrow: concentration >= 35 ? "Needs attention" : "Allocation",
        title: largest
          ? `${largest.account.name} is ${percent(concentration)} of assets`
          : "No holding concentration detected",
        summary:
          concentration >= 35
            ? "A single holding has a large influence on total asset movement."
            : "Your largest recorded holding is below the high-concentration threshold.",
        impact: largest ? formatINR(largest.value) : formatINR(0),
        why: "The largest non-liability account is divided by total assets for the selected month.",
        source: `${largest?.account.name ?? "Largest holding"} and total assets`,
        question: `Review the concentration risk in ${largest?.account.name ?? "my largest holding"}.`,
      },
      Boolean(largest),
    ),
    insight({
      id: "liquidity",
      tone: liquidShare < 10 ? "attention" : "opportunity",
      eyebrow: "Liquidity",
      title: `${percent(liquidShare)} of assets are in cash or bank accounts`,
      summary:
        liquidShare < 10
          ? "Your immediately visible liquidity is a relatively small part of recorded assets."
          : "This is your readily visible share before considering investment liquidity or expenses.",
      impact: formatINR(liquidValue),
      why: "Cash, bank, and legacy liquid balances are compared with total assets. This is not an emergency-fund runway estimate.",
      source: `Cash, bank, liquid, and total asset balances for ${formatMonth(current.monthId)}`,
      question: "Help me understand my current liquidity position.",
    }),
    insight(
      {
        id: "debt",
        tone: debtShare >= 30 || debtChange > 0 ? "attention" : "progress",
        eyebrow: "Liabilities",
        title:
          current.liabilities === 0
            ? "No liabilities are recorded"
            : `Liabilities are ${percent(debtShare)} of assets`,
        summary:
          debtChange === 0
            ? "Recorded liabilities were unchanged across the comparison period."
            : `Recorded debt ${debtChange > 0 ? "increased" : "decreased"} ${periodLabel}.`,
        impact: formatINR(current.liabilities),
        why: "Recorded liabilities are compared with total assets and with the selected comparison month.",
        source: `Liability balances for ${formatMonth(comparison.monthId)} and ${formatMonth(current.monthId)}`,
        question: "Analyze the change in my liabilities.",
      },
      current.liabilities !== 0 || (comparison.byClass.liability ?? 0) !== 0,
    ),
    insight(
      {
        id: "coverage",
        tone: "attention" as InsightTone,
        eyebrow: "Data quality",
        title: `${missingAccounts.length} account${missingAccounts.length === 1 ? "" : "s"} have no value this month`,
        summary:
          "Insights may understate totals until these accounts have a snapshot or account-book movement.",
        impact: `${currentAccountIds.size} of ${data.accounts.length} accounts represented`,
        why: "The selected month has no closing snapshot or calculated movement for these accounts.",
        source: `${formatMonth(current.monthId)} account coverage`,
        question: "Which accounts are missing from this month’s analysis?",
      },
      missingAccounts.length > 0,
    ),
  ].filter((item): item is FinancialInsight => item !== null);

  return {
    monthId: current.monthId,
    periodLabel,
    netWorth: current.netWorth,
    change: previous ? current.netWorth - previous.netWorth : 0,
    changePercent,
    dataThrough,
    insights: cards,
  };
}
