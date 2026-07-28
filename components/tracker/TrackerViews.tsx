"use client";

import { useMemo, useState } from "react";
import type { ReactNode } from "react";
import {
  ArrowDownRight,
  ArrowUpRight,
  TrendingUp,
} from "lucide-react";
import { InsightsView } from "@/components/insights/InsightsView";
import { CloudDataManager } from "@/components/tracker/CloudDataManager";
import {
  DirectAccountBookEntry,
  DirectHoldingsEntry,
} from "@/components/tracker/DirectEntryViews";
import {
  buildMonthlyRows,
  classLabels,
  classOrder,
  formatINR,
  formatMonth,
} from "@/lib/tracker";
import { parseMonthlyRemarks } from "@/lib/monthlyRemarks";
import { encodeMonthlyRemarks } from "@/lib/monthlyRemarks";
import {
  appliedRows,
  applySyncBatch,
  syncErrorMessage,
} from "@/lib/syncMutations";
import { syncRecoveryMode } from "@/lib/syncMode";
import type {
  AppSection,
  AssetClass,
  CloudMonthlyNote,
  TrackerData,
} from "@/lib/types";

type TrackerViewsProps = {
  section: AppSection;
  workspaceId: string;
  data: TrackerData;
  selectedMonth: string;
  refreshedAt: Date | null;
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
  selectedMonth,
  refreshedAt,
  onDataChange,
}: TrackerViewsProps) {
  const rows = useMemo(() => buildMonthlyRows(data), [data]);
  let content: ReactNode;

  switch (section) {
    case "summary":
      content = (
        <SummaryView
          workspaceId={workspaceId}
          data={data}
          onDataChange={onDataChange}
          rows={rows}
          selectedMonth={selectedMonth}
        />
      );
      break;
    case "insights":
      content = (
        <InsightsView
          workspaceId={workspaceId}
          data={data}
          selectedMonth={selectedMonth}
          refreshedAt={refreshedAt}
        />
      );
      break;
    case "holdings":
      content = (
        <DirectHoldingsEntry
          key={selectedMonth}
          workspaceId={workspaceId}
          data={data}
          selectedMonth={selectedMonth}
          onDataChange={onDataChange}
        />
      );
      break;
    case "account-book":
      content = (
        <DirectAccountBookEntry
          key={selectedMonth}
          workspaceId={workspaceId}
          data={data}
          selectedMonth={selectedMonth}
          onDataChange={onDataChange}
        />
      );
      break;
    case "ledger":
      content = <LedgerView rows={rows} />;
      break;
    case "history":
      content = <HistoryView data={data} />;
      break;
    case "setup":
      content = (
        <CloudDataManager
          workspaceId={workspaceId}
          data={data}
          onDataChange={onDataChange}
        />
      );
      break;
  }

  return (
    <div className="tracker-stack">
      {syncRecoveryMode && (
        <section className="sync-recovery-banner" role="status">
          <strong>Recovery protection is on</strong>
          <span>
            The latest data remains on the Mac. Web editing is temporarily
            locked until the safety backup, local audit, and atomic cloud
            replacement are verified.
          </span>
        </section>
      )}
      <fieldset className="sync-recovery-content" disabled={syncRecoveryMode}>
        {content}
      </fieldset>
    </div>
  );
}

function SummaryView({
  workspaceId,
  data,
  onDataChange,
  rows,
  selectedMonth,
}: {
  workspaceId: string;
  data: TrackerData;
  onDataChange: (data: TrackerData) => void;
  rows: ReturnType<typeof buildMonthlyRows>;
  selectedMonth: string;
}) {
  const [showEmptyClasses, setShowEmptyClasses] = useState(false);
  const currentIndex = rows.findIndex((row) => row.monthId === selectedMonth);
  const current = rows[currentIndex];
  const previous = currentIndex > 0 ? rows[currentIndex - 1] : undefined;
  if (!current) {
    return (
      <InfoEmptyState
        icon={<TrendingUp size={22} />}
        title={`No values for ${formatMonth(selectedMonth)}`}
        copy="Choose a recorded month or add the month’s holdings in the Holdings tab."
      />
    );
  }

  const change = current.netWorth - (previous?.netWorth ?? current.netWorth);
  const ratio =
    current.assets > 0 ? Math.round((current.netWorth / current.assets) * 100) : 0;
  const trendRows = rows.slice(-12);
  const trendValues = trendRows.map((row) => row.netWorth);
  const min = Math.min(...trendValues);
  const max = Math.max(...trendValues);
  const range = Math.max(max - min, 1);
  const visibleCardClasses = showEmptyClasses
    ? cardClasses
    : cardClasses.filter((assetClass) => current.byClass[assetClass] !== 0);

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
        {current.note && <p className="month-note">{parseMonthlyRemarks(current.note).overall}</p>}
      </section>

      <section className="section-card">
        <div className="card-heading">
          <div>
            <p className="eyebrow">Current composition</p>
            <h3>Everything in one view</h3>
          </div>
          <button
            className="text-button"
            onClick={() => setShowEmptyClasses((value) => !value)}
            type="button"
          >
            {showEmptyClasses ? "Hide empty categories" : "View all categories"}
          </button>
        </div>
        <div className="asset-card-grid">
          {visibleCardClasses.map((assetClass) => (
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

      <SummaryRemarksEditor
        key={`${selectedMonth}-${data.notes.find((note) => note.month_start.slice(0, 7) === selectedMonth)?.note ?? ""}`}
        workspaceId={workspaceId}
        data={data}
        selectedMonth={selectedMonth}
        onDataChange={onDataChange}
      />
    </div>
  );
}

function SummaryRemarksEditor({
  workspaceId,
  data,
  selectedMonth,
  onDataChange,
}: {
  workspaceId: string;
  data: TrackerData;
  selectedMonth: string;
  onDataChange: (data: TrackerData) => void;
}) {
  const sourceNote = data.notes.find(
    (note) => note.month_start.slice(0, 7) === selectedMonth,
  );
  const overall = parseMonthlyRemarks(sourceNote?.note ?? "").overall;
  const [remark, setRemark] = useState(overall);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  const save = async () => {
    const note = encodeMonthlyRemarks({
      ...parseMonthlyRemarks(sourceNote?.note ?? ""),
      overall: remark,
    });
    if (note === (sourceNote?.note ?? "")) return;

    setSaving(true);
    setMessage("");
    try {
      const monthStart = `${selectedMonth}-01`;
      const response = await applySyncBatch(workspaceId, [
        {
          entity: "note",
          action: "upsert",
          key: monthStart,
          base_revision: sourceNote?.revision ?? 0,
          row: { note },
        },
      ]);
      const row = appliedRows<CloudMonthlyNote>(response, "note")[0];
      if (!row) throw new Error("Remarks could not be saved.");
      onDataChange({
        ...data,
        notes: [
          ...data.notes.filter((item) => item.month_start !== row.month_start),
          row,
        ],
      });
      setMessage("Remarks saved.");
    } catch (error) {
      setMessage(syncErrorMessage(error, "Remarks could not be saved."));
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="section-card summary-remarks">
      <div className="card-heading">
        <div>
          <p className="eyebrow">Overall monthly remarks</p>
          <h3>{formatMonth(selectedMonth)}</h3>
        </div>
        {message && <span className={message === "Remarks saved." ? "success" : ""}>{message}</span>}
      </div>
      <p>Use this for the month-wide summary. Category comments belong in Holdings.</p>
      <textarea
        placeholder="Add an overall comment for this month"
        value={remark}
        onChange={(event) => setRemark(event.target.value)}
      />
      <div className="summary-remarks-actions">
        <button
          className="small-primary-button"
          disabled={saving || remark === overall}
          onClick={() => void save()}
          type="button"
        >
          {saving ? "Saving…" : "Save remarks"}
        </button>
      </div>
    </section>
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
