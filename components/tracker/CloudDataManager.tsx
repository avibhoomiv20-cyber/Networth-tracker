"use client";

import { useMemo, useState } from "react";
import {
  BookOpenText,
  CalendarDays,
  Landmark,
  NotebookPen,
  Pencil,
  Plus,
  Save,
  Trash2,
  X,
} from "lucide-react";
import { classLabels, formatINR, formatMonth } from "@/lib/tracker";
import { getSupabaseClient } from "@/lib/supabase/client";
import type {
  AssetClass,
  CloudAccount,
  CloudEntry,
  CloudMonthlyNote,
  CloudSnapshot,
  TrackerData,
} from "@/lib/types";

type ManagerTab = "accounts" | "holdings" | "entries" | "notes";
type Editor =
  | { kind: "account"; value?: CloudAccount }
  | { kind: "snapshot"; value?: CloudSnapshot }
  | { kind: "entry"; value?: CloudEntry }
  | { kind: "note"; value?: CloudMonthlyNote }
  | null;

const accountTypes: AssetClass[] = [
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

export function CloudDataManager({
  workspaceId,
  data,
  onDataChange,
}: {
  workspaceId: string;
  data: TrackerData;
  onDataChange: (data: TrackerData) => void;
}) {
  const [tab, setTab] = useState<ManagerTab>("accounts");
  const [editor, setEditor] = useState<Editor>(null);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const accountNames = useMemo(
    () => new Map(data.accounts.map((account) => [account.id, account.name])),
    [data.accounts],
  );

  const remove = async (
    table: string,
    idColumn: string,
    id: string,
    label: string,
    apply: () => TrackerData,
  ) => {
    if (!window.confirm(`Delete ${label}? This cannot be undone.`)) return;
    setError("");
    const supabase = getSupabaseClient();
    if (!supabase) return;
    const { error: deleteError } = await supabase
      .from(table)
      .delete()
      .eq(idColumn, id)
      .eq("workspace_id", workspaceId);
    if (deleteError) {
      setError(deleteError.message);
      return;
    }
    onDataChange(apply());
  };

  const tabs: Array<{ id: ManagerTab; label: string; icon: typeof Landmark }> = [
    { id: "accounts", label: "Accounts", icon: Landmark },
    { id: "holdings", label: "Holdings", icon: CalendarDays },
    { id: "entries", label: "Account Book", icon: BookOpenText },
    { id: "notes", label: "Monthly notes", icon: NotebookPen },
  ];

  return (
    <div className="tracker-stack">
      <section className="manager-intro">
        <div>
          <p className="eyebrow">Cloud editor</p>
          <h2>Manage your synced tracker</h2>
          <p>
            Changes save directly to your private workspace and will download to
            the Mac app on its next launch or two-way sync.
          </p>
        </div>
        <span className="live-badge">Two-way sync active</span>
      </section>

      <section className="section-card">
        <div className="manager-tabs" role="tablist">
          {tabs.map(({ id, label, icon: Icon }) => (
            <button
              className={tab === id ? "active" : ""}
              key={id}
              onClick={() => setTab(id)}
              role="tab"
              type="button"
            >
              <Icon size={16} />
              {label}
            </button>
          ))}
        </div>

        {error && <p className="manager-error">{error}</p>}

        {tab === "accounts" && (
          <ManagerSection
            title={`${data.accounts.length} accounts`}
            addLabel="Add account"
            add={() => setEditor({ kind: "account" })}
          >
            {data.accounts.map((account) => (
              <ManagerRow
                key={account.id}
                title={account.name}
                subtitle={[
                  classLabels[account.class_raw],
                  account.broker_name,
                  account.ticker_symbol,
                ]
                  .filter(Boolean)
                  .join(" · ")}
                edit={() => setEditor({ kind: "account", value: account })}
                remove={() =>
                  void remove(
                    "nw_accounts",
                    "id",
                    account.id,
                    account.name,
                    () => ({
                      ...data,
                      accounts: data.accounts.filter((item) => item.id !== account.id),
                      snapshots: data.snapshots.filter(
                        (item) => item.account_id !== account.id,
                      ),
                      entries: data.entries.filter(
                        (item) => item.account_id !== account.id,
                      ),
                    }),
                  )
                }
              />
            ))}
          </ManagerSection>
        )}

        {tab === "holdings" && (
          <ManagerSection
            title={`${data.snapshots.length} saved holding values`}
            addLabel="Add holding value"
            add={() => setEditor({ kind: "snapshot" })}
          >
            {[...data.snapshots]
              .sort((a, b) => b.captured_on.localeCompare(a.captured_on))
              .map((snapshot) => (
                <ManagerRow
                  key={snapshot.id}
                  title={accountNames.get(snapshot.account_id) ?? "Holding"}
                  subtitle={`${formatDate(snapshot.captured_on)} · ${snapshot.note || "Manual value"}`}
                  value={formatINR(Number(snapshot.value_paise))}
                  edit={() => setEditor({ kind: "snapshot", value: snapshot })}
                  remove={() =>
                    void remove(
                      "nw_account_snapshots",
                      "id",
                      snapshot.id,
                      "this holding value",
                      () => ({
                        ...data,
                        snapshots: data.snapshots.filter(
                          (item) => item.id !== snapshot.id,
                        ),
                      }),
                    )
                  }
                />
              ))}
          </ManagerSection>
        )}

        {tab === "entries" && (
          <ManagerSection
            title={`${data.entries.length} Account Book entries`}
            addLabel="Add entry"
            add={() => setEditor({ kind: "entry" })}
          >
            {[...data.entries]
              .sort((a, b) => b.entry_date.localeCompare(a.entry_date))
              .map((entry) => (
                <ManagerRow
                  key={entry.id}
                  title={entry.description}
                  subtitle={`${accountNames.get(entry.account_id) ?? "Account"} · ${formatDate(entry.entry_date)} · ${entry.direction === "increase" ? "In" : "Out"}`}
                  value={formatINR(Number(entry.amount_paise))}
                  edit={() => setEditor({ kind: "entry", value: entry })}
                  remove={() =>
                    void remove(
                      "nw_account_entries",
                      "id",
                      entry.id,
                      "this Account Book entry",
                      () => ({
                        ...data,
                        entries: data.entries.filter(
                          (item) => item.id !== entry.id,
                        ),
                      }),
                    )
                  }
                />
              ))}
          </ManagerSection>
        )}

        {tab === "notes" && (
          <ManagerSection
            title={`${data.notes.length} monthly notes`}
            addLabel="Add monthly note"
            add={() => setEditor({ kind: "note" })}
          >
            {[...data.notes]
              .sort((a, b) => b.month_start.localeCompare(a.month_start))
              .map((note) => (
                <ManagerRow
                  key={note.month_start}
                  title={formatMonth(note.month_start.slice(0, 7))}
                  subtitle={note.note || "Blank note"}
                  edit={() => setEditor({ kind: "note", value: note })}
                  remove={() =>
                    void remove(
                      "nw_monthly_notes",
                      "month_start",
                      note.month_start,
                      "this monthly note",
                      () => ({
                        ...data,
                        notes: data.notes.filter(
                          (item) => item.month_start !== note.month_start,
                        ),
                      }),
                    )
                  }
                />
              ))}
          </ManagerSection>
        )}
      </section>

      {editor && (
        <EditorModal
          accounts={data.accounts}
          editor={editor}
          saving={saving}
          close={() => setEditor(null)}
          save={async (values) => {
            setSaving(true);
            setError("");
            try {
              const next = await saveEditor(
                workspaceId,
                data,
                editor,
                values,
              );
              onDataChange(next);
              setEditor(null);
            } catch (saveError) {
              setError(
                saveError instanceof Error
                  ? saveError.message
                  : "The change could not be saved.",
              );
            } finally {
              setSaving(false);
            }
          }}
        />
      )}
    </div>
  );
}

function ManagerSection({
  title,
  addLabel,
  add,
  children,
}: {
  title: string;
  addLabel: string;
  add: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="manager-section">
      <header>
        <h3>{title}</h3>
        <button className="small-primary-button" onClick={add} type="button">
          <Plus size={15} /> {addLabel}
        </button>
      </header>
      <div className="manager-list">{children}</div>
    </div>
  );
}

function ManagerRow({
  title,
  subtitle,
  value,
  edit,
  remove,
}: {
  title: string;
  subtitle: string;
  value?: string;
  edit: () => void;
  remove: () => void;
}) {
  return (
    <article className="manager-row">
      <div>
        <strong>{title}</strong>
        <span>{subtitle}</span>
      </div>
      {value && <strong className="manager-value">{value}</strong>}
      <div className="row-actions">
        <button aria-label={`Edit ${title}`} onClick={edit} type="button">
          <Pencil size={15} />
        </button>
        <button
          aria-label={`Delete ${title}`}
          className="delete"
          onClick={remove}
          type="button"
        >
          <Trash2 size={15} />
        </button>
      </div>
    </article>
  );
}

type EditorValues = Record<string, string>;

function EditorModal({
  accounts,
  editor,
  saving,
  close,
  save,
}: {
  accounts: CloudAccount[];
  editor: Exclude<Editor, null>;
  saving: boolean;
  close: () => void;
  save: (values: EditorValues) => Promise<void>;
}) {
  const initial = initialValues(editor, accounts);
  const [values, setValues] = useState<EditorValues>(initial);
  const set = (key: string, value: string) =>
    setValues((current) => ({ ...current, [key]: value }));

  return (
    <div className="modal-backdrop" role="presentation">
      <form
        className="editor-modal"
        onSubmit={(event) => {
          event.preventDefault();
          void save(values);
        }}
      >
        <header>
          <div>
            <p className="eyebrow">Cloud editor</p>
            <h2>{editorTitle(editor)}</h2>
          </div>
          <button aria-label="Close editor" onClick={close} type="button">
            <X size={19} />
          </button>
        </header>

        <div className="editor-fields">
          {editor.kind === "account" && (
            <>
              <EditorField label="Account name" required value={values.name} set={(value) => set("name", value)} />
              <label className="editor-field">
                <span>Account type</span>
                <select value={values.class_raw} onChange={(event) => set("class_raw", event.target.value)}>
                  {accountTypes.map((type) => <option key={type} value={type}>{classLabels[type]}</option>)}
                </select>
              </label>
              <EditorField label="Broker or bank" value={values.broker_name} set={(value) => set("broker_name", value)} />
              <EditorField label="Ticker symbol" value={values.ticker_symbol} set={(value) => set("ticker_symbol", value)} />
              <EditorField label="Notes" value={values.notes} set={(value) => set("notes", value)} />
            </>
          )}

          {editor.kind === "snapshot" && (
            <>
              <AccountPicker accounts={accounts} value={values.account_id} set={(value) => set("account_id", value)} />
              <EditorField label="Value date" type="date" required value={values.captured_on} set={(value) => set("captured_on", value)} />
              <EditorField label="Value (₹)" type="number" required value={values.value} set={(value) => set("value", value)} />
              <EditorField label="Quantity / units" type="number" value={values.quantity} set={(value) => set("quantity", value)} />
              <EditorField label="Unit price (₹ or USD)" type="number" value={values.unit_price} set={(value) => set("unit_price", value)} />
              <EditorField label="USD to INR rate" type="number" value={values.usd_to_inr} set={(value) => set("usd_to_inr", value)} />
              <EditorField label="Note" value={values.note} set={(value) => set("note", value)} />
            </>
          )}

          {editor.kind === "entry" && (
            <>
              <AccountPicker accounts={accounts} value={values.account_id} set={(value) => set("account_id", value)} />
              <EditorField label="Entry date" type="date" required value={values.entry_date} set={(value) => set("entry_date", value)} />
              <EditorField label="Description" required value={values.description} set={(value) => set("description", value)} />
              <EditorField label="Comment" value={values.comment} set={(value) => set("comment", value)} />
              <label className="editor-field">
                <span>Movement</span>
                <select value={values.direction} onChange={(event) => set("direction", event.target.value)}>
                  <option value="increase">In / increase</option>
                  <option value="decrease">Out / decrease</option>
                </select>
              </label>
              <EditorField label="Amount (₹)" type="number" required value={values.amount} set={(value) => set("amount", value)} />
              <EditorField label="Quantity / units" type="number" value={values.quantity} set={(value) => set("quantity", value)} />
              <EditorField label="Unit price (₹ or USD)" type="number" value={values.unit_price} set={(value) => set("unit_price", value)} />
              <EditorField label="USD to INR rate" type="number" value={values.usd_to_inr} set={(value) => set("usd_to_inr", value)} />
            </>
          )}

          {editor.kind === "note" && (
            <>
              <EditorField label="Month" type="month" required value={values.month} set={(value) => set("month", value)} />
              <label className="editor-field full">
                <span>Monthly note</span>
                <textarea required value={values.note} onChange={(event) => set("note", event.target.value)} />
              </label>
            </>
          )}
        </div>

        <footer>
          <button className="secondary-button" onClick={close} type="button">Cancel</button>
          <button className="small-primary-button" disabled={saving} type="submit">
            <Save size={15} /> {saving ? "Saving…" : "Save change"}
          </button>
        </footer>
      </form>
    </div>
  );
}

function EditorField({
  label,
  value,
  set,
  type = "text",
  required = false,
}: {
  label: string;
  value: string;
  set: (value: string) => void;
  type?: string;
  required?: boolean;
}) {
  return (
    <label className="editor-field">
      <span>{label}</span>
      <input
        min={type === "number" ? "0" : undefined}
        required={required}
        step={type === "number" ? "any" : undefined}
        type={type}
        value={value}
        onChange={(event) => set(event.target.value)}
      />
    </label>
  );
}

function AccountPicker({
  accounts,
  value,
  set,
}: {
  accounts: CloudAccount[];
  value: string;
  set: (value: string) => void;
}) {
  return (
    <label className="editor-field">
      <span>Account</span>
      <select required value={value} onChange={(event) => set(event.target.value)}>
        <option value="">Select account</option>
        {accounts.map((account) => <option key={account.id} value={account.id}>{account.name}</option>)}
      </select>
    </label>
  );
}

function initialValues(
  editor: Exclude<Editor, null>,
  accounts: CloudAccount[],
): EditorValues {
  const today = new Date().toISOString().slice(0, 10);
  switch (editor.kind) {
    case "account":
      return {
        name: editor.value?.name ?? "",
        class_raw: editor.value?.class_raw ?? "cash",
        notes: editor.value?.notes ?? "",
        ticker_symbol: editor.value?.ticker_symbol ?? "",
        broker_name: editor.value?.broker_name ?? "",
      };
    case "snapshot":
      return {
        account_id: editor.value?.account_id ?? accounts[0]?.id ?? "",
        captured_on: editor.value?.captured_on ?? today,
        value: editor.value ? String(Number(editor.value.value_paise) / 100) : "",
        quantity: String(editor.value?.quantity ?? ""),
        unit_price: editor.value ? String(Number(editor.value.unit_price_paise) / 100 || "") : "",
        usd_to_inr: String(editor.value?.usd_to_inr ?? ""),
        note: editor.value?.note ?? "Web update",
      };
    case "entry":
      return {
        account_id: editor.value?.account_id ?? accounts[0]?.id ?? "",
        entry_date: editor.value?.entry_date ?? today,
        description: editor.value?.description ?? "",
        comment: editor.value?.comment ?? "",
        direction: editor.value?.direction ?? "increase",
        amount: editor.value ? String(Number(editor.value.amount_paise) / 100) : "",
        quantity: String(editor.value?.quantity ?? ""),
        unit_price: editor.value ? String(Number(editor.value.unit_price_paise) / 100 || "") : "",
        usd_to_inr: String(editor.value?.usd_to_inr ?? ""),
      };
    case "note":
      return {
        month: editor.value?.month_start.slice(0, 7) ?? today.slice(0, 7),
        note: editor.value?.note ?? "",
      };
  }
}

function editorTitle(editor: Exclude<Editor, null>) {
  const action = editor.value ? "Edit" : "Add";
  const names = {
    account: "account",
    snapshot: "holding value",
    entry: "Account Book entry",
    note: "monthly note",
  };
  return `${action} ${names[editor.kind]}`;
}

async function saveEditor(
  workspaceId: string,
  data: TrackerData,
  editor: Exclude<Editor, null>,
  values: EditorValues,
): Promise<TrackerData> {
  const supabase = getSupabaseClient();
  if (!supabase) throw new Error("Cloud connection is unavailable.");

  if (editor.kind === "account") {
    const payload = {
      workspace_id: workspaceId,
      name: values.name.trim(),
      class_raw: values.class_raw,
      notes: values.notes.trim(),
      ticker_symbol: values.ticker_symbol.trim(),
      broker_name: values.broker_name.trim(),
      sort_order: editor.value?.sort_order ?? data.accounts.length,
    };
    const query = editor.value
      ? supabase.from("nw_accounts").update(payload).eq("id", editor.value.id)
      : supabase.from("nw_accounts").insert(payload);
    const { data: row, error } = await query
      .select("id,name,class_raw,notes,ticker_symbol,broker_name,sort_order")
      .single();
    if (error || !row) throw new Error(error?.message ?? "Account was not saved.");
    const account = row as CloudAccount;
    return {
      ...data,
      accounts: editor.value
        ? data.accounts.map((item) => item.id === account.id ? account : item)
        : [...data.accounts, account],
    };
  }

  if (editor.kind === "snapshot") {
    const payload = {
      workspace_id: workspaceId,
      account_id: values.account_id,
      captured_on: values.captured_on,
      value_paise: paise(values.value),
      quantity: number(values.quantity),
      unit_price_paise: paise(values.unit_price),
      usd_to_inr: number(values.usd_to_inr),
      source: "manual",
      note: values.note.trim(),
    };
    const query = editor.value
      ? supabase.from("nw_account_snapshots").update(payload).eq("id", editor.value.id)
      : supabase.from("nw_account_snapshots").insert(payload);
    const { data: row, error } = await query
      .select("id,account_id,captured_on,value_paise,quantity,unit_price_paise,usd_to_inr,source,note")
      .single();
    if (error || !row) throw new Error(error?.message ?? "Holding value was not saved.");
    const snapshot = row as CloudSnapshot;
    return {
      ...data,
      snapshots: editor.value
        ? data.snapshots.map((item) => item.id === snapshot.id ? snapshot : item)
        : [...data.snapshots, snapshot],
    };
  }

  if (editor.kind === "entry") {
    const payload = {
      workspace_id: workspaceId,
      account_id: values.account_id,
      entry_date: values.entry_date,
      description: values.description.trim(),
      comment: values.comment.trim(),
      direction: values.direction,
      amount_paise: paise(values.amount),
      quantity: number(values.quantity),
      unit_price_paise: paise(values.unit_price),
      usd_to_inr: number(values.usd_to_inr),
    };
    const query = editor.value
      ? supabase.from("nw_account_entries").update(payload).eq("id", editor.value.id)
      : supabase.from("nw_account_entries").insert(payload);
    const { data: row, error } = await query
      .select("id,account_id,entry_date,description,comment,direction,amount_paise,quantity,unit_price_paise,usd_to_inr")
      .single();
    if (error || !row) throw new Error(error?.message ?? "Entry was not saved.");
    const entry = row as CloudEntry;
    return {
      ...data,
      entries: editor.value
        ? data.entries.map((item) => item.id === entry.id ? entry : item)
        : [...data.entries, entry],
    };
  }

  const monthStart = `${values.month}-01`;
  const payload = {
    workspace_id: workspaceId,
    month_start: monthStart,
    note: values.note.trim(),
  };
  const { data: row, error } = await supabase
    .from("nw_monthly_notes")
    .upsert(payload, { onConflict: "workspace_id,month_start" })
    .select("month_start,note")
    .single();
  if (error || !row) throw new Error(error?.message ?? "Monthly note was not saved.");
  const note = row as CloudMonthlyNote;
  return {
    ...data,
    notes: [
      ...data.notes.filter(
        (item) =>
          item.month_start !== editor.value?.month_start &&
          item.month_start !== note.month_start,
      ),
      note,
    ],
  };
}

function paise(value: string) {
  return Math.round(number(value) * 100);
}

function number(value: string) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${value.slice(0, 10)}T00:00:00Z`));
}
