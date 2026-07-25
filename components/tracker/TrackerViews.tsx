"use client";

import { useMemo } from "react";
import {
  ArrowDownRight,
  ArrowUpRight,
  BookOpenText,
  Landmark,
  TrendingUp,
} from "lucide-react";
import { CloudDataManager } from "@/components/tracker/CloudDataManager";
import {
  accountsByClass,
  buildMonthlyRows,
  classLabels,
  classOrder,
  formatINR,
  formatMonth,
} from "@/lib/tracker";
import type {
  AppSection,
  AssetClass,
  TrackerData,
} from "@/lib/types";

type TrackerViewsProps = {
  section: AppSection;
  workspaceId: string;
  data: TrackerData;
  onDataChange: (data: TrackerData) => void;
};

const cardClasses: AssetClass[] = [
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

export function TrackerViews({
  section,
  workspaceId,
  data,
  onDataChange,
}: TrackerViewsProps) {
  const rows = useMemo(() => buildMonthlyRows(data), [data]);

  switch (section) {
    case "summary":
      return <SummaryView rows={rows} />;
    case "holdings":
      return <HoldingsView data={data} rows={rows} />;
    case "account-book":
      return <AccountBookView data={data} />;
    case "ledger":
      return <LedgerView rows={rows} />;
    case "history":
      return <HistoryView data={data} />;
    case "setup":
      return (
        <CloudDataManager
          workspaceId={workspaceId}
          data={data}
          onDataChange={onDataChange}
        />
      );
  }
}

function SummaryView({
  rows,
}: {
  rows: ReturnType<typeof buildMonthlyRows>;
}) {
  const current = rows.at(-1);
  const previous = rows.at(-2);
  if (!current) return <SyncedEmptyState />;

  const change = current.netWorth - (previous?.netWorth ?? current.netWorth);
  const ratio =
    current.assets > 0 ? Math.round((current.netWorth / current.assets) * 100) : 0;
  const trendRows = rows.slice(-12);
  const trendValues = trendRows.map((row) => row.netWorth);
  const min = Math.min(...trendValues);
  const max = Math.max(...trendValues);
  const range = Math.max(max - min, 1);

  return (
    <div className="tracker-stack">
      <section className="hero-summary">
        <div>
          <p className="eyebrow">Net worth · {formatMonth(current.monthId)}</p>
          <h2>{formatINR(current.netWorth)}</h2>
          <span className={change >= 0 ? "movement positive" : "movement negative"}>
            {change >= 0 ? <ArrowUpRight size={15} /> : <ArrowDownRight size={15} />}
            {formatINR(Math.abs(change))} from previous month
          </span>
        </div>
        <div className="hero-metrics">
          <Metric label="Total assets" value={formatINR(current.assets)} />
          <Metric
            label="Liabilities"
            value={formatINR(current.liabilities)}
            tone="danger"
          />
          <Metric label="Equity ratio" value={`${ratio}%`} tone="blue" />
        </div>
        {current.note && <p className="month-note">{current.note}</p>}
      </section>

      <section className="section-card">
        <div className="card-heading">
          <div>
            <p className="eyebrow">Current composition</p>
            <h3>Everything in one view</h3>
          </div>
          <span>{formatMonth(current.monthId)}</span>
        </div>
        <div className="asset-card-grid">
          {cardClasses.map((assetClass) => (
            <article className={`asset-card tone-${assetClass}`} key={assetClass}>
              <span>{classLabels[assetClass]}</span>
              <strong>{formatINR(current.byClass[assetClass])}</strong>
            </article>
          ))}
        </div>
      </section>

      <section className="section-card trend-card">
        <div className="card-heading">
          <div>
            <p className="eyebrow">Net-worth trend</p>
            <h3>Last {trendRows.length} months</h3>
          </div>
          <TrendingUp size={20} />
        </div>
        <div className="trend-bars" role="img" aria-label="Monthly net-worth trend">
          {trendRows.map((row) => {
            const height = 24 + ((row.netWorth - min) / range) * 76;
            return (
              <div className="trend-column" key={row.monthId}>
                <span className="trend-value">{formatINR(row.netWorth, true)}</span>
                <div className="trend-track">
                  <span style={{ height: `${height}%` }} />
                </div>
                <span>{formatMonth(row.monthId).split(" ")[0]}</span>
              </div>
            );
          })}
        </div>
      </section>

      <MonthlyTable rows={rows} />
    </div>
  );
}

function Metric({
  label,
  value,
  tone = "positive",
}: {
  label: string;
  value: string;
  tone?: "positive" | "danger" | "blue";
}) {
  return (
    <div className={`hero-metric ${tone}`}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function HoldingsView({
  data,
  rows,
}: {
  data: TrackerData;
  rows: ReturnType<typeof buildMonthlyRows>;
}) {
  const latest = rows.at(-1);
  const groups = accountsByClass(data.accounts);

  return (
    <div className="tracker-stack">
      {groups.map(({ assetClass, accounts }) => (
        <section className="section-card holding-group" key={assetClass}>
          <div className="card-heading">
            <div>
              <p className="eyebrow">{accounts.length} accounts</p>
              <h3>{classLabels[assetClass]}</h3>
            </div>
            <strong>{formatINR(latest?.byClass[assetClass] ?? 0)}</strong>
          </div>
          <div className="holding-list">
            {accounts.map((account) => (
              <article key={account.id}>
                <div className="account-symbol">
                  <Landmark size={17} />
                </div>
                <div>
                  <strong>{account.name}</strong>
                  <span>
                    {[account.broker_name, account.ticker_symbol]
                      .filter(Boolean)
                      .join(" · ") || classLabels[account.class_raw]}
                  </span>
                </div>
                <strong>{formatINR(latest?.byAccount[account.id] ?? 0)}</strong>
              </article>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

function AccountBookView({ data }: { data: TrackerData }) {
  const accountNames = new Map(
    data.accounts.map((account) => [account.id, account.name]),
  );
  const entries = [...data.entries].sort((a, b) =>
    b.entry_date.localeCompare(a.entry_date),
  );

  if (entries.length === 0) {
    return (
      <InfoEmptyState
        icon={<BookOpenText size={22} />}
        title="No Account Book entries yet"
        copy="Entries added on your Mac will appear here after the next cloud sync."
      />
    );
  }

  return (
    <section className="section-card">
      <div className="card-heading">
        <div>
          <p className="eyebrow">Synced activity</p>
          <h3>{entries.length} Account Book entries</h3>
        </div>
      </div>
      <div className="responsive-table">
        <table className="activity-table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Account</th>
              <th>Description</th>
              <th>Comment</th>
              <th>Movement</th>
              <th>Amount / units</th>
            </tr>
          </thead>
          <tbody>
            {entries.map((entry) => {
              const account = data.accounts.find(
                (item) => item.id === entry.account_id,
              );
              const isUnits = account?.class_raw === "companyStock";
              return (
                <tr key={entry.id}>
                  <td>{formatDate(entry.entry_date)}</td>
                  <td><strong>{accountNames.get(entry.account_id) ?? "Account"}</strong></td>
                  <td>{entry.description}</td>
                  <td className="muted-cell">{entry.comment || "—"}</td>
                  <td>
                    <span
                      className={
                        entry.direction === "increase"
                          ? "entry-direction in"
                          : "entry-direction out"
                      }
                    >
                      {entry.direction === "increase" ? "In" : "Out"}
                    </span>
                  </td>
                  <td className="amount-cell">
                    {isUnits && entry.quantity > 0
                      ? `${Number(entry.quantity).toLocaleString("en-IN")} units`
                      : formatINR(entry.amount_paise)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function LedgerView({
  rows,
}: {
  rows: ReturnType<typeof buildMonthlyRows>;
}) {
  if (!rows.length) return <SyncedEmptyState />;
  return <MonthlyTable rows={rows} expanded />;
}

function MonthlyTable({
  rows,
  expanded = false,
}: {
  rows: ReturnType<typeof buildMonthlyRows>;
  expanded?: boolean;
}) {
  const visible = expanded ? [...rows].reverse() : [...rows].reverse().slice(0, 12);
  return (
    <section className="section-card">
      <div className="card-heading">
        <div>
          <p className="eyebrow">Monthly ledger</p>
          <h3>{expanded ? "Complete history" : "Recent summary"}</h3>
        </div>
        <span>{rows.length} months</span>
      </div>
      <div className="responsive-table">
        <table className="ledger-table">
          <thead>
            <tr>
              <th>Month</th>
              {classOrder.map((assetClass) => (
                <th key={assetClass}>{classLabels[assetClass]}</th>
              ))}
              <th>Net worth</th>
            </tr>
          </thead>
          <tbody>
            {visible.map((row) => (
              <tr key={row.monthId}>
                <td><strong>{formatMonth(row.monthId)}</strong></td>
                {classOrder.map((assetClass) => (
                  <td
                    className={assetClass === "liability" ? "debt-cell" : ""}
                    key={assetClass}
                  >
                    {formatINR(row.byClass[assetClass])}
                  </td>
                ))}
                <td className="networth-cell">{formatINR(row.netWorth)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function HistoryView({ data }: { data: TrackerData }) {
  const accountNames = new Map(
    data.accounts.map((account) => [account.id, account.name]),
  );
  const snapshots = [...data.snapshots].sort((a, b) =>
    b.captured_on.localeCompare(a.captured_on),
  );

  return (
    <section className="section-card">
      <div className="card-heading">
        <div>
          <p className="eyebrow">Snapshot history</p>
          <h3>{snapshots.length} saved values</h3>
        </div>
      </div>
      <div className="responsive-table">
        <table className="activity-table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Holding</th>
              <th>Source</th>
              <th>Note</th>
              <th>Quantity</th>
              <th>Value</th>
            </tr>
          </thead>
          <tbody>
            {snapshots.map((snapshot) => (
              <tr key={snapshot.id}>
                <td>{formatDate(snapshot.captured_on)}</td>
                <td><strong>{accountNames.get(snapshot.account_id) ?? "Holding"}</strong></td>
                <td>{snapshot.source}</td>
                <td className="muted-cell">{snapshot.note || "—"}</td>
                <td>{Number(snapshot.quantity) > 0 ? Number(snapshot.quantity).toLocaleString("en-IN") : "—"}</td>
                <td className="amount-cell">{formatINR(snapshot.value_paise)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function SyncedEmptyState() {
  return (
    <InfoEmptyState
      icon={<TrendingUp size={22} />}
      title="No monthly values found"
      copy="Accounts are connected, but no holdings history was returned. Sync the Mac app again and refresh this page."
    />
  );
}

function InfoEmptyState({
  icon,
  title,
  copy,
}: {
  icon: React.ReactNode;
  title: string;
  copy: string;
}) {
  return (
    <section className="empty-view">
      <div>
        <span className="empty-view-icon">{icon}</span>
        <h2>{title}</h2>
        <p>{copy}</p>
      </div>
    </section>
  );
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${value.slice(0, 10)}T00:00:00Z`));
}
