"use client";

import { useMemo, useState } from "react";
import { CheckCircle2, Plus, Save, Trash2 } from "lucide-react";
import { buildMonthlyRows, classLabels, classOrder, formatINR, formatMonth } from "@/lib/tracker";
import { getSupabaseClient } from "@/lib/supabase/client";
import type {
  AssetClass,
  CloudEntry,
  CloudMonthlyNote,
  CloudSnapshot,
  TrackerData,
} from "@/lib/types";

type MarketDraft = {
  quantity: string;
  unitPrice: string;
  usdRate: string;
};

export function DirectHoldingsEntry({
  workspaceId,
  data,
  onDataChange,
}: {
  workspaceId: string;
  data: TrackerData;
  onDataChange: (data: TrackerData) => void;
}) {
  const availableClasses = classOrder.filter((assetClass) =>
    data.accounts.some((account) => account.class_raw === assetClass),
  );
  const latestMonth =
    buildMonthlyRows(data).at(-1)?.monthId ?? new Date().toISOString().slice(0, 7);
  const [month, setMonth] = useState(latestMonth);
  const [assetClass, setAssetClass] = useState<AssetClass>(
    availableClasses[0] ?? "cash",
  );
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [marketDrafts, setMarketDrafts] = useState<Record<string, MarketDraft>>({});
  const [remark, setRemark] = useState(
    data.notes.find((note) => note.month_start.slice(0, 7) === latestMonth)?.note ??
      "",
  );
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  const accounts = data.accounts.filter(
    (account) => account.class_raw === assetClass,
  );

  const exactSnapshot = (accountId: string) =>
    data.snapshots
      .filter(
        (snapshot) =>
          snapshot.account_id === accountId &&
          snapshot.captured_on.slice(0, 7) === month,
      )
      .sort(preferredSnapshotOrder)[0];

  const carriedSnapshot = (accountId: string) =>
    data.snapshots
      .filter(
        (snapshot) =>
          snapshot.account_id === accountId &&
          snapshot.captured_on.slice(0, 7) === month,
      )
      .sort(preferredSnapshotOrder)[0];

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

  const selectMonth = (nextMonth: string) => {
    setMonth(nextMonth);
    setDrafts({});
    setMarketDrafts({});
    setRemark(
      data.notes.find((note) => note.month_start.slice(0, 7) === nextMonth)?.note ??
        "",
    );
    setMessage("");
  };

  const saveMonth = async () => {
    const supabase = getSupabaseClient();
    if (!supabase) return;
    const changed = Object.entries(drafts).filter(
      ([, value]) => value.trim() !== "",
    );
    if (!changed.length && remark.trim() === "") {
      setMessage("Enter at least one value or a monthly note.");
      return;
    }

    setSaving(true);
    setMessage("");
    try {
      const savedSnapshots: CloudSnapshot[] = [];
      for (const [accountId, value] of changed) {
        const closingPaise = Math.round(Number(value) * 100);
        if (!Number.isFinite(closingPaise)) continue;
        const rawValue = closingPaise;
        const existing = exactSnapshot(accountId);
        const market = marketDraft(accountId);
        const payload = {
          workspace_id: workspaceId,
          account_id: accountId,
          captured_on: `${month}-15`,
          value_paise: rawValue,
          quantity: Number(market.quantity) || 0,
          unit_price_paise: Math.round(Number(market.unitPrice) * 100) || 0,
          usd_to_inr: Number(market.usdRate) || 0,
          source: "manual",
          note: "Web monthly value",
        };
        const query = existing
          ? supabase
              .from("nw_account_snapshots")
              .update(payload)
              .eq("id", existing.id)
          : supabase.from("nw_account_snapshots").insert(payload);
        const { data: row, error } = await query
          .select(
            "id,account_id,captured_on,value_paise,quantity,unit_price_paise,usd_to_inr,source,note",
          )
          .single();
        if (error || !row) throw new Error(error?.message ?? "A holding was not saved.");
        savedSnapshots.push(row as CloudSnapshot);
      }

      let savedNote: CloudMonthlyNote | null = null;
      const existingNote = data.notes.find(
        (note) => note.month_start.slice(0, 7) === month,
      );
      if (remark.trim() !== "" || existingNote) {
        const { data: row, error } = await supabase
          .from("nw_monthly_notes")
          .upsert(
            {
              workspace_id: workspaceId,
              month_start: `${month}-01`,
              note: remark.trim(),
            },
            { onConflict: "workspace_id,month_start" },
          )
          .select("month_start,note")
          .single();
        if (error || !row) throw new Error(error?.message ?? "The note was not saved.");
        savedNote = row as CloudMonthlyNote;
      }

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
      setMessage("Month saved to the cloud.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Values could not be saved.");
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
          <p>Type balances directly, just like the Mac tracker.</p>
        </div>
        <label className="month-control">
          <span>Month</span>
          <input
            type="month"
            value={month}
            onChange={(event) => selectMonth(event.target.value)}
          />
        </label>
      </section>

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

        <div className={`direct-holding-list ${assetClass === "companyStock" ? "market-holdings" : ""}`}>
          <div className="direct-row-heading">
            <span>Holding</span>
            {assetClass === "companyStock" && <span>Shares</span>}
            {assetClass === "companyStock" && <span>USD price</span>}
            {assetClass === "companyStock" && <span>USD to INR</span>}
            <span>Closing balance</span>
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
              <span className="currency-input">
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

        <label className="direct-remark">
          <span>Monthly remarks</span>
          <textarea
            placeholder="Optional note for this month"
            value={remark}
            onChange={(event) => setRemark(event.target.value)}
          />
        </label>

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
  onDataChange,
}: {
  workspaceId: string;
  data: TrackerData;
  onDataChange: (data: TrackerData) => void;
}) {
  const [accountId, setAccountId] = useState(data.accounts[0]?.id ?? "");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [drafts, setDrafts] = useState<EntryDraft[]>([newDraft()]);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const selectedAccount = data.accounts.find((account) => account.id === accountId);
  const usesUnits =
    selectedAccount?.class_raw === "companyStock" ||
    selectedAccount?.class_raw === "gold";
  const selectedMonth = date.slice(0, 7);
  const openingSnapshot = preferredSnapshotForMonth(
    data.snapshots,
    accountId,
    shiftMonth(selectedMonth, -1),
  );
  const openingBalance = Number(openingSnapshot?.value_paise ?? 0);
  const monthMovement = data.entries
    .filter(
      (entry) =>
        entry.account_id === accountId && entry.entry_date.slice(0, 7) === selectedMonth,
    )
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

  const saveOnAmountBlur = (draft: EntryDraft) => {
    if (
      draft.description.trim() &&
      calculatedAmount(draft, selectedAccount?.class_raw) > 0
    ) {
      void saveRows();
    }
  };

  const saveRows = async () => {
    const valid = drafts.filter(
      (draft) => draft.description.trim() && calculatedAmount(draft, selectedAccount?.class_raw) > 0,
    );
    if (!accountId || !valid.length) {
      setMessage("Select an account and complete at least one row.");
      return;
    }
    const supabase = getSupabaseClient();
    if (!supabase) return;
    setSaving(true);
    setMessage("");
    try {
      const payload = valid.map((draft) => ({
        workspace_id: workspaceId,
        account_id: accountId,
        entry_date: date,
        description: draft.description.trim(),
        comment: draft.comment.trim(),
        direction: draft.direction,
        amount_paise: calculatedAmount(draft, selectedAccount?.class_raw),
        quantity: number(draft.quantity),
        unit_price_paise: Math.round(number(draft.unitPrice) * 100),
        usd_to_inr: number(draft.usdRate),
      }));
      const { data: rows, error } = await supabase
        .from("nw_account_entries")
        .insert(payload)
        .select(
          "id,account_id,entry_date,description,comment,direction,amount_paise,quantity,unit_price_paise,usd_to_inr",
        );
      if (error || !rows) throw new Error(error?.message ?? "Entries were not saved.");
      const savedEntries = rows as CloudEntry[];
      const month = date.slice(0, 7);
      const previousMonth = shiftMonth(month, -1);
      const opening = preferredSnapshotForMonth(data.snapshots, accountId, previousMonth);
      const currentEntries = [...data.entries, ...savedEntries].filter(
        (entry) =>
          entry.account_id === accountId && entry.entry_date.slice(0, 7) === month,
      );
      const direction = (entry: CloudEntry) => entry.direction === "increase" ? 1 : -1;
      const closingPaise = Number(opening?.value_paise ?? 0) + currentEntries.reduce(
        (total, entry) => total + direction(entry) * Number(entry.amount_paise),
        0,
      );
      const closingQuantity = Number(opening?.quantity ?? 0) + currentEntries.reduce(
        (total, entry) => total + direction(entry) * Number(entry.quantity),
        0,
      );
      const currentSnapshot = preferredSnapshotForMonth(data.snapshots, accountId, month);
      const snapshotPayload = {
        workspace_id: workspaceId,
        account_id: accountId,
        captured_on: `${month}-15`,
        value_paise: closingPaise,
        quantity: closingQuantity,
        unit_price_paise: currentSnapshot?.unit_price_paise ?? opening?.unit_price_paise ?? 0,
        usd_to_inr: currentSnapshot?.usd_to_inr ?? opening?.usd_to_inr ?? 0,
        source: "manual",
        note: "Account Book calculated",
      };
      const snapshotQuery = currentSnapshot
        ? supabase.from("nw_account_snapshots").update(snapshotPayload).eq("id", currentSnapshot.id)
        : supabase.from("nw_account_snapshots").insert(snapshotPayload);
      const { data: snapshotRow, error: snapshotError } = await snapshotQuery
        .select("id,account_id,captured_on,value_paise,quantity,unit_price_paise,usd_to_inr,source,note")
        .single();
      if (snapshotError || !snapshotRow) {
        throw new Error(snapshotError?.message ?? "The closing holding was not saved.");
      }
      const savedSnapshot = snapshotRow as CloudSnapshot;
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
      setMessage(`${rows.length} ${rows.length === 1 ? "entry" : "entries"} saved.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Entries could not be saved.");
    } finally {
      setSaving(false);
    }
  };

  const recentEntries = useMemo(
    () =>
      [...data.entries]
        .sort((a, b) => b.entry_date.localeCompare(a.entry_date))
        .slice(0, 20),
    [data.entries],
  );
  const accountNames = new Map(
    data.accounts.map((account) => [account.id, account.name]),
  );

  return (
    <div className="tracker-stack">
      <section className="direct-entry-header account-book-heading">
        <div>
          <p className="eyebrow">Account Book</p>
          <h2>Write entries directly</h2>
          <p>Select an account, add one or more rows, then save them together.</p>
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
            <input type="date" value={date} onChange={(event) => setDate(event.target.value)} />
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
                    onBlur={() => saveOnAmountBlur(draft)}
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
                <span>{accountNames.get(entry.account_id)} · {entry.entry_date}</span>
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

function preferredSnapshotForMonth(
  snapshots: CloudSnapshot[],
  accountId: string,
  month: string,
) {
  return snapshots
    .filter(
      (snapshot) =>
        snapshot.account_id === accountId && snapshot.captured_on.slice(0, 7) === month,
    )
    .sort(preferredSnapshotOrder)[0];
}

function preferredSnapshotOrder(a: CloudSnapshot, b: CloudSnapshot) {
  const aIsCalculated = a.note === "Account Book calculated";
  const bIsCalculated = b.note === "Account Book calculated";
  if (aIsCalculated !== bIsCalculated) return aIsCalculated ? 1 : -1;
  return b.captured_on.localeCompare(a.captured_on);
}

function shiftMonth(month: string, amount: number) {
  const date = new Date(`${month}-01T00:00:00Z`);
  date.setUTCMonth(date.getUTCMonth() + amount);
  return date.toISOString().slice(0, 7);
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
