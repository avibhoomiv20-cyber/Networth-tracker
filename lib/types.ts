export type WorkspaceSummary = {
  id: string;
  name: string;
  accountCount: number;
};

export type AssetClass =
  | "cash"
  | "bank"
  | "investment"
  | "retirement"
  | "companyStock"
  | "physical"
  | "gold"
  | "personal"
  | "liability"
  | "liquid";

export type CloudAccount = {
  id: string;
  name: string;
  class_raw: AssetClass;
  notes: string;
  ticker_symbol: string;
  broker_name: string;
  sort_order: number;
};

export type CloudSnapshot = {
  id: string;
  account_id: string;
  captured_on: string;
  value_paise: number;
  quantity: number;
  unit_price_paise: number;
  usd_to_inr: number;
  source: string;
  note: string;
};

export type CloudEntry = {
  id: string;
  account_id: string;
  entry_date: string;
  description: string;
  comment: string;
  direction: "increase" | "decrease";
  amount_paise: number;
  quantity: number;
  unit_price_paise: number;
  usd_to_inr: number;
};

export type CloudMonthlyNote = {
  month_start: string;
  note: string;
};

export type TrackerData = {
  accounts: CloudAccount[];
  snapshots: CloudSnapshot[];
  entries: CloudEntry[];
  notes: CloudMonthlyNote[];
};

export type AppSection =
  | "summary"
  | "holdings"
  | "account-book"
  | "ledger"
  | "history"
  | "setup";
