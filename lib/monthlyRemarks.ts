export type MonthlyRemarks = {
  overall: string;
  categories: Record<string, string>;
};

type EncodedMonthlyRemarks = MonthlyRemarks & { schema: number };

export function parseMonthlyRemarks(raw: string): MonthlyRemarks {
  try {
    const parsed = JSON.parse(raw) as Partial<EncodedMonthlyRemarks>;
    if (
      parsed.schema === 1 &&
      typeof parsed.overall === "string" &&
      parsed.categories &&
      typeof parsed.categories === "object"
    ) {
      return { overall: parsed.overall, categories: parsed.categories as Record<string, string> };
    }
  } catch {
    // Notes saved by older app versions are plain overall remarks.
  }
  return { overall: raw, categories: {} };
}

export function encodeMonthlyRemarks(remarks: MonthlyRemarks): string {
  const overall = remarks.overall.trim();
  const categories = Object.fromEntries(
    Object.entries(remarks.categories)
      .map(([key, value]) => [key, value.trim()] as const)
      .filter(([, value]) => value !== ""),
  );
  return Object.keys(categories).length === 0
    ? overall
    : JSON.stringify({ schema: 1, overall, categories });
}
