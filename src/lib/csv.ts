import type { RawLead } from "./types";

const HEADERS: (keyof RawLead)[] = [
  "lead_id",
  "name",
  "phone",
  "email",
  "city",
  "education",
  "experience",
  "goal",
  "german_level",
  "source",
  "last_contacted",
  "conversation",
  "notes"
];

export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;

  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    const next = text[i + 1];
    if (quoted) {
      if (ch === '"' && next === '"') {
        cell += '"';
        i += 1;
      } else if (ch === '"') {
        quoted = false;
      } else {
        cell += ch;
      }
      continue;
    }
    if (ch === '"') {
      quoted = true;
    } else if (ch === ",") {
      row.push(cell);
      cell = "";
    } else if (ch === "\n") {
      row.push(cell.replace(/\r$/, ""));
      rows.push(row);
      row = [];
      cell = "";
    } else {
      cell += ch;
    }
  }
  if (cell.length || row.length) {
    row.push(cell.replace(/\r$/, ""));
    rows.push(row);
  }
  const width = rows[0]?.length ?? 0;
  return rows
    .filter((r) => r.some((value) => value.trim() !== ""))
    .map((entry) => {
      const next = entry.slice();
      while (next.length < width) next.push("");
      return next.slice(0, width);
    });
}

export function rowsToLeads(rows: string[][]): RawLead[] {
  const [header, ...body] = rows;
  const index = Object.fromEntries(header.map((h, i) => [h.trim(), i]));
  return body
    .filter((r) => (r[index.lead_id] || "").trim())
    .map((r) => {
      const lead = {} as RawLead;
      for (const key of HEADERS) {
        lead[key] = (r[index[key]] || "").trim();
      }
      return lead;
    });
}

export function toCsv(rows: object[], columns: string[]): string {
  const escape = (value: unknown) => {
    const text = value === null || value === undefined ? "" : String(value);
    if (/[",\n]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
    return text;
  };
  return [
    columns.join(","),
    ...rows.map((row) => columns.map((col) => escape((row as Record<string, unknown>)[col])).join(","))
  ].join("\n");
}

export const OUTPUT_COLUMNS = [
  "lead_id",
  "name",
  "phone",
  "email",
  "city",
  "education",
  "experience",
  "goal",
  "german_level",
  "source",
  "last_contacted",
  "relevant",
  "reason",
  "confidence",
  "intent",
  "profile",
  "need",
  "objection",
  "missing_information",
  "opportunity",
  "priority",
  "priority_score",
  "next_action",
  "outreach",
  "is_duplicate",
  "duplicate_of",
  "quality_flags",
  "review_required",
  "review_reasons",
  "critic_notes",
  "sources"
];
