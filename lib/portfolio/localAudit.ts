import { formatINR, formatMonth } from "@/lib/tracker";
import type { CloudEntry, TrackerData } from "@/lib/types";

export type DuplicateEntryFinding = {
  accountName: string;
  amountPaise: number;
  description: string;
  direction: CloudEntry["direction"];
  entryDate: string;
  occurrences: number;
};

const duplicateQuestionPattern =
  /\b(duplicate|duplicates|duplicated|double[- ]?entry|entered twice|repeated entr(?:y|ies))\b/i;

export function isDuplicateAuditQuestion(prompt: string) {
  return duplicateQuestionPattern.test(prompt);
}

export function buildLocalDuplicateAuditAnswer(
  data: TrackerData,
  selectedMonth: string,
) {
  const entries = data.entries.filter(
    (entry) => entry.entry_date.slice(0, 7) === selectedMonth,
  );
  const findings = findExactEntryDuplicates(data, selectedMonth);
  const scope = formatMonth(selectedMonth);

  if (findings.length === 0) {
    return [
      `Local duplicate check for ${scope}: no exact duplicate groups were found among ${entries.length} Account Book ${entries.length === 1 ? "entry" : "entries"}.`,
      "I compared account, entry date, ₹ In/₹ Out direction, amount and normalized description. Similar entries with different wording, dates or amounts still need your review. No data was sent to the AI provider and no records were changed.",
    ].join("\n\n");
  }

  const repeatedRecords = findings.reduce(
    (total, finding) => total + finding.occurrences,
    0,
  );
  const lines = findings.slice(0, 12).map((finding) => {
    const description = finding.description || "No description";
    const direction = finding.direction === "increase" ? "₹ In" : "₹ Out";
    return `• ${finding.accountName} — ${formatEntryDate(finding.entryDate)} — ${direction} ${formatINR(finding.amountPaise)} — “${description}” — ${finding.occurrences} entries`;
  });
  const remaining = findings.length - lines.length;

  return [
    `Local duplicate check for ${scope}: ${findings.length} possible exact duplicate ${findings.length === 1 ? "group" : "groups"} (${repeatedRecords} records) need review.`,
    ...lines,
    ...(remaining > 0 ? [`• ${remaining} more duplicate groups are not shown.`] : []),
    "These are candidates, not automatic deletions. I matched account, entry date, direction, amount and normalized description. No data was sent to the AI provider and no records were changed.",
  ].join("\n\n");
}

export function findExactEntryDuplicates(
  data: TrackerData,
  selectedMonth: string,
): DuplicateEntryFinding[] {
  const accounts = new Map(
    data.accounts.map((account) => [account.id, account.name]),
  );
  const grouped = new Map<string, CloudEntry[]>();

  for (const entry of data.entries) {
    if (entry.entry_date.slice(0, 7) !== selectedMonth) continue;
    const key = [
      entry.account_id,
      entry.entry_date.slice(0, 10),
      entry.direction,
      Number(entry.amount_paise),
      normalizeDescription(entry.description),
    ].join("|");
    const matches = grouped.get(key) ?? [];
    matches.push(entry);
    grouped.set(key, matches);
  }

  return Array.from(grouped.values())
    .filter((matches) => matches.length > 1)
    .map((matches) => {
      const entry = matches[0]!;
      return {
        accountName: accounts.get(entry.account_id) ?? "Unknown account",
        amountPaise: Number(entry.amount_paise),
        description: entry.description.trim(),
        direction: entry.direction,
        entryDate: entry.entry_date.slice(0, 10),
        occurrences: matches.length,
      };
    })
    .sort((first, second) =>
      first.entryDate.localeCompare(second.entryDate) ||
      first.accountName.localeCompare(second.accountName),
    );
}

function normalizeDescription(description: string) {
  return description.trim().toLocaleLowerCase("en-IN").replace(/\s+/g, " ");
}

function formatEntryDate(date: string) {
  return new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${date}T00:00:00Z`));
}
