export type WorkspaceSummary = {
  id: string;
  name: string;
  accountCount: number;
};

export type AppSection =
  | "summary"
  | "holdings"
  | "account-book"
  | "ledger"
  | "history"
  | "setup";
