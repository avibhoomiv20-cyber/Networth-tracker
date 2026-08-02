"use client";

import { useState } from "react";
import { CheckCircle2, Plus, Save, Trash2 } from "lucide-react";
import {
  classLabels,
  classOrder,
  formatINR,
  formatMonth,
} from "@/lib/tracker";
import { encodeMonthlyRemarks, parseMonthlyRemarks } from "@/lib/monthlyRemarks";
import {
  appliedRows,
  applySyncBatch,
  syncErrorMessage,
  type SyncOperation,
} from "@/lib/syncMutations";
import type {
  AssetClass,
  CloudEntry,
  CloudMonthlyNote,
  CloudSnapshot,
  TrackerData,
} from "@/lib/types";
import type { PortfolioReadModel } from "@/lib/portfolio/readModel";

type MarketDraft = {
  quantity: string;
  unitPrice: string;
  usdRate: string;
};

export function DirectHoldingsEntry({
  workspaceId,
  data,
  readModel,
  selectedMonth,
  onDataChange,
}: {
  workspaceId: string;
  data: TrackerData;
  readModel: PortfolioReadModel;
  selectedMonth: string;
  onDataChange: (data: TrackerData) => void;
}) {
  const availableClasses = classOrder.filter(
    (item) => (readModel.accountsByClass.get(item)?.length ?? 0) > 0,
  );
  const month = selectedMonth;
  const [assetClass, setAssetClass] = useState<AssetClass>(
    availableClasses[0] ?? "cash",
  );
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [marketDrafts, setMarketDrafts] = useState<Record<string, MarketDraft>>({});
  const [categoryRemarks, setCategoryRemarks] = useState<Record<string, string>>(
    () =>
      parseMonthlyRemarks(
        data.notes.find((note) => note.month_start.slice(0, 7) === selectedMonth)?.note ??
          "",
      ).categories,
  );
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [copiesPreviousMonth, setCopiesPreviousMonth] = useState(false);
  const [copiedAccountIds, setCopiedAccountIds] = useState<string[]>([]);
  const [showCopyChoice, setShowCopyChoice] = useState(false);
  const previousMonth = shiftMonth(month, -1);
  const hasSavedValuesForMonth = data.snapshots.some(
    (snapshot) => snapshot.captured_on.slice(0, 7) === month,
  );
  const hasValuesToCopy = data.snapshots.some(
    (snapshot) => snapshot.captured_on.slice(0, 7) === previousMonth,
  );
  const hasManualDraftValues =
    Object.values(drafts).some((value) => value.trim() !== "") ||
    Object.values(marketDrafts).some((market) =>
      Object.values(market).some((value) => value.trim() !== ""),
    );

  const accounts = readModel.accountsByClass.get(assetClass) ?? [];

  const exactSnapshot = (accountId: string) =>
    readModel.snapshotFor(accountId, month);

  const carriedSnapshot = exactSnapshot;

  const marketDraft = (accountId: string): MarketDraft => {
    const carried = carriedSnapshot(accountId);
    return marketDrafts[accountId] ?? {
      quantity: carried?.quantity ? String(carried.quantity) : "",
      unitPrice: carried?.unit_price_paise
        ? String(Number(carried.unit_price_paise) / 100)
        : "",
      usdRate: carried?.usd_to_inr ? String(carried.usd_to_inr) : "",
    };
  };

  const updateMarketDraft = (accountId: string, change: Partial<MarketDraft>) => {
    const next = { ...marketDraft(accountId), ...change };
    setMarketDrafts((current) => ({ ...current, [accountId]: next }));
    const closing = Number(next.quantity) * Number(next.unitPrice) * Number(next.usdRate);
    if (Number.isFinite(closing) && closing > 0) {
      setDrafts((current) => ({ ...current, [accountId]: String(closing) }));
    }
  };

  const displayedValue = (accountId: string) => {
    if (drafts[accountId] !== undefined) return drafts[accountId];
    const snapshot = exactSnapshot(accountId);
    return snapshot ? String(Number(snapshot.value_paise) / 100) : "";
  };

  const applyPreviousMonthCopy = (overwriteManualValues: boolean) => {
    setCopiesPreviousMonth(true);
    setMessage("");
    const copiedValues = overwriteManualValues ? {} : { ...drafts };
    const copiedMarkets = overwriteManualValues ? {} : { ...marketDrafts };
    const copiedIds: string[] = [];
    for (const account of data.accounts) {
      if (
        !overwriteManualValues &&
        (copiedValues[account.id]?.trim() || exactSnapshot(account.id))
      ) {
        continue;
      }
      const snapshot = readModel.snapshotFor(account.id, previousMonth);
      if (!snapshot) continue;
      copiedValues[account.id] = String(Number(snapshot.value_paise) / 100);
      copiedIds.push(account.id);
      if (account.class_raw === "companyStock" || account.class_raw === "gold") {
        copiedMarkets[account.id] = {
          quantity: snapshot.quantity ? String(snapshot.quantity) : "",
          unitPrice: snapshot.unit_price_paise
            ? String(Number(snapshot.unit_price_paise) / 100)
            : "",
          usdRate: snapshot.usd_to_inr ? String(snapshot.usd_to_inr) : "",
        };
      }
    }
    setDrafts(copiedValues);
    setMarketDrafts(copiedMarkets);
    setCopiedAccountIds(copiedIds);
    setMessage(
      copiedIds.length
        ? overwriteManualValues
          ? `Replaced this month with ${copiedIds.length} balance${copiedIds.length === 1 ? "" : "s"} from ${formatMonth(previousMonth)}. Save to confirm.`
          : `Copied ${copiedIds.length} balance${copiedIds.length === 1 ? "" : "s"} from ${formatMonth(previousMonth)}. Your current values were kept.`
        : "Your current values were kept. There were no blank balances to copy.",
    );
  };

  const requestPreviousMonthCopy = (enabled: boolean) => {
    if (!enabled) {
      const copied = new Set(copiedAccountIds);
      setCopiesPreviousMonth(false);
      setDrafts((current) =>
        Object.fromEntries(
          Object.entries(current).filter(([accountId]) => !copied.has(accountId)),
        ),
      );
      setMarketDrafts((current) =>
        Object.fromEntries(
          Object.entries(current).filter(([accountId]) => !copied.has(accountId)),
        ),
      );
      setCopiedAccountIds([]);
      return;
    }
    if (hasManualDraftValues || hasSavedValuesForMonth) {
      setShowCopyChoice(true);
    } else {
      applyPreviousMonthCopy(false);
    }
  };

  const saveMonth = async () => {
    const existingNote = data.notes.find(
      (note) => note.month_start.slice(0, 7) === month,
    );
    const existingRemarks = parseMonthlyRemarks(existingNote?.note ?? "");
    const encodedRemarks = encodeMonthlyRemarks({
      ...existingRemarks,
      categories: categoryRemarks,
    });
    const noteChanged = encodedRemarks !== (existingNote?.note ?? "");
    const changed = Object.entries(drafts).filter(
      ([, value]) => value.trim() !== "",
    );
    if (!changed.length && !noteChanged) {
      setMessage("Enter a holding value or a comment before saving.");
      return;
    }

    setSaving(true);
    setMessage("");
    try {
      const operations: SyncOperation[] = [];
      for (const [accountId, value] of changed) {
        const closingPaise = Math.round(Number(value) * 100);
        if (!Number.isFinite(closingPaise)) continue;
        const existing = exactSnapshot(accountId);
        const market = marketDraft(accountId);
        operations.push({
          entity: "snapshot",
          action: "upsert",
          key: existing?.id ?? crypto.randomUUID(),
          base_revision: existing?.revision ?? 0,
          row: {
            account_id: accountId,
            captured_on: `${month}-15`,
            value_paise: closingPaise,
            quantity: Number(market.quantity) || 0,
            unit_price_paise: Math.round(Number(market.unitPrice) * 100) || 0,
            usd_to_inr: Number(market.usdRate) || 0,
            source: "manual",
            note: "Web monthly value",
          },
        });
      }

      if (noteChanged || existingNote) {
        operations.push({
          entity: "note",
          action: "upsert",
          key: `${month}-01`,
          base_revision: existingNote?.revision ?? 0,
          row: { note: encodedRemarks },
        });
      }
      const response = await applySyncBatch(workspaceId, operations);
      const savedSnapshots = appliedRows<CloudSnapshot>(response, "snapshot");
      const savedNote =
        appliedRows<CloudMonthlyNote>(response, "note")[0] ?? null;

      const savedIds = new Set(savedSnapshots.map((item) => item.id));
      const savedAccounts = new Set(savedSnapshots.map((item) => item.account_id));
      onDataChange({
        ...data,
        snapshots: [
          ...data.snapshots.filter(
            (item) =>
              !savedIds.has(item.id) &&
              !(
                savedAccounts.has(item.account_id) &&
                item.captured_on.slice(0, 7) === month
              ),
          ),
          ...savedSnapshots,
        ],
        notes: savedNote
          ? [
              ...data.notes.filter(
                (item) => item.month_start !== savedNote?.month_start,
              ),
              savedNote,
            ]
          : data.notes,
      });
      setDrafts({});
      setCopiesPreviousMonth(false);
      setCopiedAccountIds([]);
      setMessage("Month saved to the cloud.");
    } catch (error) {
      setMessage(syncErrorMessage(error, "Values could not be saved."));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="tracker-stack">
      <section className="direct-entry-header">
        <div>
          <p className="eyebrow">Enter monthly holdings</p>
          <h2>{formatMonth(month)}</h2>
          <p>Type the closing value for the selected month, just like the Mac tracker.</p>
        </div>
      </section>

      <label className="carry-forward-toggle">
          <input
            checked={copiesPreviousMonth}
            disabled={!hasValuesToCopy}
            onChange={(event) => requestPreviousMonthCopy(event.target.checked)}
            type="checkbox"
          />
          <span>
            <strong>Copy previous month balances</strong>
            <small>
              {hasValuesToCopy
                ? `Prefills ${formatMonth(previousMonth)} values. Nothing is saved until you save this month.`
                : `No saved balances are available for ${formatMonth(previousMonth)}.`}
            </small>
          </span>
      </label>

      {showCopyChoice && (
        <div
          className="copy-choice-backdrop"
          role="presentation"
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 1000,
            display: "grid",
            placeItems: "center",
            padding: "1.25rem",
            background: "rgba(18, 45, 49, 0.36)",
            backdropFilter: "blur(3px)",
          }}
        >
          <section
            aria-labelledby="copy-choice-title"
            aria-modal="true"
            className="copy-choice-dialog"
            role="dialog"
            style={{
              width: "min(31rem, 100%)",
              padding: "1.5rem",
              border: "1px solid #c9dbd5",
              borderRadius: "1.1rem",
              background: "#ffffff",
              boxShadow: "0 24px 56px rgba(18, 45, 49, 0.24)",
            }}
          >
            <p className="eyebrow" style={{ marginBottom: "0.45rem" }}>
              {hasSavedValuesForMonth ? "Saved values detected" : "Unsaved values detected"}
            </p>
            <h2 id="copy-choice-title" style={{ margin: "0 0 0.55rem" }}>Copy previous month balances?</h2>
            <p style={{ margin: "0 0 1.25rem" }}>
              {hasSavedValuesForMonth
                ? `This month already has saved values. Keep them and fill only empty accounts, or replace them with ${formatMonth(previousMonth)} balances.`
                : `Keep what you entered and fill only empty accounts, or replace your unsaved values with ${formatMonth(previousMonth)} balances.`}
            </p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "0.65rem", alignItems: "center" }}>
              <button
                className="secondary-button"
                onClick={() => {
                  setShowCopyChoice(false);
                  applyPreviousMonthCopy(false);
                }}
                type="button"
              >
                Fill empty only
              </button>
              <button
                className="small-primary-button"
                onClick={() => {
                  setShowCopyChoice(false);
                  applyPreviousMonthCopy(true);
                }}
                style={{ background: "#c45050" }}
                type="button"
              >
                Replace my entries
              </button>
              <button
                className="text-button"
                onClick={() => setShowCopyChoice(false)}
                type="button"
              >
                Cancel
              </button>
            </div>
          </section>
        </div>
      )}

      <section className="section-card">
        <div className="direct-class-tabs">
          {availableClasses.map((item) => (
            <button
              className={assetClass === item ? "active" : ""}
              key={item}
              onClick={() => setAssetClass(item)}
              type="button"
            >
              {classLabels[item]}
            </button>
          ))}
        </div>
        <label className="class-remark">
          <span>{classLabels[assetClass]} comment</span>
          <input
            placeholder={`Add one comment for all ${classLabels[assetClass].toLowerCase()} holdings`}
            value={categoryRemarks[assetClass] ?? ""}
            onChange={(event) =>
              setCategoryRemarks((current) => ({
                ...current,
                [assetClass]: event.target.value,
              }))
            }
          />
        </label>

        <div className={`direct-holding-list ${assetClass === "companyStock" ? "market-holdings" : ""}`}>
          <div className="direct-row-heading">
            <span>Holding</span>
            {assetClass === "companyStock" && <span>Shares</span>}
            {assetClass === "companyStock" && <span>USD price</span>}
            {assetClass === "companyStock" && <span>USD to INR</span>}
            <span>Total</span>
          </div>
          {accounts.map((account) => (
            <label className="direct-holding-row" key={account.id}>
              <span>
                <strong>{account.name}</strong>
                <small>{account.broker_name || classLabels[account.class_raw]}</small>
              </span>
              {assetClass === "companyStock" && (
                <input
                  className="direct-market-input"
                  inputMode="decimal"
                  placeholder="Shares"
                  value={marketDraft(account.id).quantity}
                  onChange={(event) => updateMarketDraft(account.id, { quantity: event.target.value })}
                />
              )}
              {assetClass === "companyStock" && (
                <input
                  className="direct-market-input"
                  inputMode="decimal"
                  placeholder="USD"
                  value={marketDraft(account.id).unitPrice}
                  onChange={(event) => updateMarketDraft(account.id, { unitPrice: event.target.value })}
                />
              )}
              {assetClass === "companyStock" && (
                <input
                  className="direct-market-input"
                  inputMode="decimal"
                  placeholder="Rate"
                  value={marketDraft(account.id).usdRate}
                  onChange={(event) => updateMarketDraft(account.id, { usdRate: event.target.value })}
                />
              )}
              <span className="currency-input quiet-value-input">
                <b>₹</b>
                <input
                  inputMode="decimal"
                  placeholder="Enter value"
                  value={displayedValue(account.id)}
                  onChange={(event) =>
                    setDrafts((current) => ({
                      ...current,
                      [account.id]: event.target.value,
                    }))
                  }
                />
              </span>
            </label>
          ))}
        </div>

        <div className="direct-save-bar">
          {message && (
            <span className={message.includes("saved") ? "success" : ""}>
              {message.includes("saved") && <CheckCircle2 size={14} />}
              {message}
            </span>
          )}
          <button
            className="small-primary-button"
            disabled={saving}
            onClick={() => void saveMonth()}
            type="button"
          >
            <Save size={15} /> {saving ? "Saving…" : "Save month"}
          </button>
        </div>
      </section>
    </div>
  );
}

type EntryDraft = {
  id: string;
  description: string;
  comment: string;
  direction: "increase" | "decrease";
  amount: string;
  quantity: string;
  unitPrice: string;
  usdRate: string;
};

const newDraft = (): EntryDraft => ({
  id: crypto.randomUUID(),
  description: "",
  comment: "",
  direction: "increase",
  amount: "",
  quantity: "",
  unitPrice: "",
  usdRate: "",
});

export function DirectAccountBookEntry({
  workspaceId,
  data,
  readModel,
  selectedMonth,
  onDataChange,
}: {
  workspaceId: string;
  data: TrackerData;
  readModel: PortfolioReadModel;
  selectedMonth: string;
  onDataChange: (data: TrackerData) => void;
}) {
  const [accountId, setAccountId] = useState(data.accounts[0]?.id ?? "");
  const [date, setDate] = useState(`${selectedMonth}-01`);
  const [drafts, setDrafts] = useState<EntryDraft[]>([newDraft()]);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const selectedAccount = data.accounts.find((account) => account.id === accountId);
  const usesUnits =
    selectedAccount?.class_raw === "companyStock" ||
    selectedAccount?.class_raw === "gold";
  const openingSnapshot = readModel.snapshotFor(
    accountId,
    shiftMonth(selectedMonth, -1),
  );
  const openingBalance = Number(openingSnapshot?.value_paise ?? 0);
  const monthMovement = readModel.entriesFor(accountId, selectedMonth)
    .reduce(
      (total, entry) =>
        total + Number(entry.amount_paise) * (entry.direction === "increase" ? 1 : -1),
      0,
    );
  const currentClosing = openingBalance + monthMovement;

  const update = (id: string, change: Partial<EntryDraft>) =>
    setDrafts((current) =>
      current.map((draft) => (draft.id === id ? { ...draft, ...change } : draft)),
    );

  const saveRows = async () => {
    const valid = drafts.filter(
      (draft) => draft.description.trim() && calculatedAmount(draft, selectedAccount?.class_raw) > 0,
    );
    if (!accountId || !valid.length) {
      setMessage("Select an account and complete at least one row.");
      return;
    }
    setSaving(true);
    setMessage("");
    try {
      const month = date.slice(0, 7);
      const previousMonth = shiftMonth(month, -1);
      const opening = readModel.snapshotFor(accountId, previousMonth);
      const currentEntries = readModel.entriesFor(accountId, month);
      const direction = (entry: CloudEntry) => entry.direction === "increase" ? 1 : -1;
      const draftDirection = (draft: EntryDraft) =>
        draft.direction === "increase" ? 1 : -1;
      const closingPaise =
        Number(opening?.value_paise ?? 0) +
        currentEntries.reduce(
          (total, entry) => total + direction(entry) * Number(entry.amount_paise),
          0,
        ) +
        valid.reduce(
          (total, draft) =>
            total +
            draftDirection(draft) *
              calculatedAmount(draft, selectedAccount?.class_raw),
          0,
        );
      const closingQuantity =
        Number(opening?.quantity ?? 0) +
        currentEntries.reduce(
          (total, entry) => total + direction(entry) * Number(entry.quantity),
          0,
        ) +
        valid.reduce(
          (total, draft) =>
            total + draftDirection(draft) * number(draft.quantity),
          0,
        );
      const currentSnapshot = readModel.snapshotFor(accountId, month);
      const entryOperations: SyncOperation[] = valid.map((draft) => ({
        entity: "entry",
        action: "upsert",
        key: crypto.randomUUID(),
        base_revision: 0,
        row: {
          account_id: accountId,
          entry_date: date,
          description: draft.description.trim(),
          comment: draft.comment.trim(),
          direction: draft.direction,
          amount_paise: calculatedAmount(draft, selectedAccount?.class_raw),
          quantity: number(draft.quantity),
          unit_price_paise: Math.round(number(draft.unitPrice) * 100),
          usd_to_inr: number(draft.usdRate),
        },
      }));
      const response = await applySyncBatch(workspaceId, [
        ...entryOperations,
        {
          entity: "snapshot",
          action: "upsert",
          key: currentSnapshot?.id ?? crypto.randomUUID(),
          base_revision: currentSnapshot?.revision ?? 0,
          row: {
            account_id: accountId,
            captured_on: `${month}-15`,
            value_paise: closingPaise,
            quantity: closingQuantity,
            unit_price_paise:
              currentSnapshot?.unit_price_paise ??
              opening?.unit_price_paise ??
              0,
            usd_to_inr:
              currentSnapshot?.usd_to_inr ?? opening?.usd_to_inr ?? 0,
            source: "manual",
            note: "Account Book calculated",
          },
        },
      ]);
      const savedEntries = appliedRows<CloudEntry>(response, "entry");
      const savedSnapshot = appliedRows<CloudSnapshot>(response, "snapshot")[0];
      if (!savedSnapshot) throw new Error("The closing holding was not saved.");
      onDataChange({
        ...data,
        entries: [...data.entries, ...savedEntries],
        snapshots: [
          ...data.snapshots.filter(
            (snapshot) =>
              snapshot.id !== savedSnapshot.id &&
              !(snapshot.account_id === accountId && snapshot.captured_on.slice(0, 7) === month),
          ),
          savedSnapshot,
        ],
      });
      setDrafts([newDraft()]);
      setMessage(
        `${savedEntries.length} ${savedEntries.length === 1 ? "entry" : "entries"} saved.`,
      );
    } catch (error) {
      setMessage(syncErrorMessage(error, "Entries could not be saved."));
    } finally {
      setSaving(false);
    }
  };

  const recentEntries = readModel.sortedEntries.slice(0, 20);

  return (
    <div className="tracker-stack">
      <section className="direct-entry-header account-book-heading">
        <div>
            <p className="eyebrow">Account Book</p>
          <h2>{formatMonth(selectedMonth)}</h2>
          <p>Start from last month’s closing, then record this month’s movement.</p>
        </div>
        <div className="book-controls">
          <label>
            <span>Account</span>
            <select value={accountId} onChange={(event) => setAccountId(event.target.value)}>
              {data.accounts.map((account) => (
                <option key={account.id} value={account.id}>{account.name}</option>
              ))}
            </select>
          </label>
          <label>
            <span>Entry date</span>
            <input
              type="date"
              min={`${selectedMonth}-01`}
              max={monthEnd(selectedMonth)}
              value={date}
              onChange={(event) => setDate(event.target.value)}
            />
          </label>
        </div>
      </section>

      {selectedAccount && (
        <section className="book-balance-strip" aria-label="Account Book balance summary">
          <div>
            <span>Last month closing</span>
            <strong>{formatINR(openingBalance)}</strong>
          </div>
          <div className={monthMovement < 0 ? "movement-out" : "movement-in"}>
            <span>{monthMovement < 0 ? "This month out" : "This month in"}</span>
            <strong>{formatINR(Math.abs(monthMovement))}</strong>
          </div>
          <div className="closing-balance">
            <span>Current month closing</span>
            <strong>{formatINR(currentClosing)}</strong>
          </div>
        </section>
      )}

      <section className="section-card">
        <div className="book-entry-grid book-entry-labels">
          <span>Description</span>
          <span>Movement and amount</span>
          <span>Comments</span>
        </div>
        <div className="book-draft-list">
          {drafts.map((draft) => (
            <div className="book-entry-grid book-draft-row" key={draft.id}>
              <div className="draft-description">
                <input
                  placeholder="Write description"
                  value={draft.description}
                  onChange={(event) => update(draft.id, { description: event.target.value })}
                />
                {usesUnits && (
                  <div className="market-inputs">
                    <input placeholder={selectedAccount?.class_raw === "gold" ? "Grams" : "Units"} value={draft.quantity} onChange={(event) => update(draft.id, { quantity: event.target.value })} />
                    <input placeholder="Unit price" value={draft.unitPrice} onChange={(event) => update(draft.id, { unitPrice: event.target.value })} />
                    {selectedAccount?.class_raw === "companyStock" && (
                      <input placeholder="USD rate" value={draft.usdRate} onChange={(event) => update(draft.id, { usdRate: event.target.value })} />
                    )}
                  </div>
                )}
              </div>
              <div className="draft-movement">
                <select value={draft.direction} onChange={(event) => update(draft.id, { direction: event.target.value as EntryDraft["direction"] })}>
                  <option value="increase">
                    {selectedAccount?.class_raw === "companyStock"
                      ? "Units Vested"
                      : selectedAccount?.class_raw === "gold"
                        ? "Bought"
                        : "₹ In"}
                  </option>
                  <option value="decrease">
                    {selectedAccount?.class_raw === "companyStock"
                      ? "Units Sold"
                      : selectedAccount?.class_raw === "gold"
                        ? "Sold"
                        : "₹ Out"}
                  </option>
                </select>
                <span className="currency-input">
                  <b>₹</b>
                  <input
                    placeholder="Amount"
                    value={draft.amount}
                    onChange={(event) => update(draft.id, { amount: event.target.value })}
                  />
                </span>
              </div>
              <div className="draft-comment">
                <textarea placeholder="Optional comment" value={draft.comment} onChange={(event) => update(draft.id, { comment: event.target.value })} />
                {drafts.length > 1 && (
                  <button aria-label="Remove row" onClick={() => setDrafts((current) => current.filter((item) => item.id !== draft.id))} type="button">
                    <Trash2 size={15} />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
        <button className="add-direct-row" onClick={() => setDrafts((current) => [...current, newDraft()])} type="button">
          <Plus size={15} /> Add another row
        </button>
        <div className="direct-save-bar">
          {message && <span className={message.includes("saved") ? "success" : ""}>{message}</span>}
          <button className="small-primary-button" disabled={saving} onClick={() => void saveRows()} type="button">
            <Save size={15} /> {saving ? "Saving…" : "Save entries"}
          </button>
        </div>
      </section>

      <section className="section-card">
        <div className="card-heading">
          <div>
            <p className="eyebrow">Recent activity</p>
            <h3>Last {recentEntries.length} entries</h3>
          </div>
        </div>
        <div className="recent-book-list">
          {recentEntries.map((entry) => (
            <article key={entry.id}>
              <div>
                <strong>{entry.description}</strong>
                <span>{readModel.accountsById.get(entry.account_id)?.name} · {entry.entry_date}</span>
              </div>
              <strong className={entry.direction === "increase" ? "in" : "out"}>
                {entry.direction === "increase" ? "+" : "−"} {formatINR(Number(entry.amount_paise))}
              </strong>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}

function shiftMonth(month: string, amount: number) {
  const date = new Date(`${month}-01T00:00:00Z`);
  date.setUTCMonth(date.getUTCMonth() + amount);
  return date.toISOString().slice(0, 7);
}

function monthEnd(month: string) {
  const nextMonth = new Date(`${month}-01T00:00:00Z`);
  nextMonth.setUTCMonth(nextMonth.getUTCMonth() + 1);
  nextMonth.setUTCDate(0);
  return nextMonth.toISOString().slice(0, 10);
}

function calculatedAmount(draft: EntryDraft, assetClass?: AssetClass) {
  const direct = Math.round(number(draft.amount) * 100);
  if (direct > 0) return direct;
  const quantity = number(draft.quantity);
  const unitPricePaise = number(draft.unitPrice) * 100;
  const rate = assetClass === "companyStock" ? number(draft.usdRate) : 1;
  return Math.round(quantity * unitPricePaise * rate);
}

function number(value: string) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}
