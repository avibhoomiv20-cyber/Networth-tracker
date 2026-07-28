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
  revision: number;
  name: string;
  class_raw: AssetClass;
  notes: string;
  ticker_symbol: string;
  broker_name: string;
  sort_order: number;
};

export type CloudSnapshot = {
  id: string;
  revision: number;
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
  revision: number;
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
  revision: number;
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
  | "insights"
  | "holdings"
  | "account-book"
  | "ledger"
  | "history"
  | "setup";

export type InsightTone = "attention" | "change" | "opportunity" | "progress";

export type FinancialInsight = {
  id: string;
  tone: InsightTone;
  eyebrow: string;
  title: string;
  summary: string;
  impact: string;
  why: string;
  source: string;
  question: string;
};

export type AIChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt: string;
};
