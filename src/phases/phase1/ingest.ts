import { readFileSync } from "fs";
import { join } from "path";
import { parseCsv } from "./parseCsv";
import {
  EXPECTED_ROW_COUNT,
  RAW_COLUMNS,
  SNAPSHOT_RELATIVE_PATH,
  type Phase1Quality,
  type Phase1Result,
  type RawLead
} from "./types";

export function rowsToRawLeads(rows: string[][]): RawLead[] {
  if (!rows.length) {
    throw new Error("Phase 1 ingest: CSV is empty.");
  }

  const [header, ...body] = rows;
  const index = Object.fromEntries(header.map((name, i) => [name.trim(), i]));
  const missingColumns = RAW_COLUMNS.filter((column) => index[column] === undefined);
  if (missingColumns.length) {
    throw new Error(`Phase 1 ingest: snapshot is missing columns: ${missingColumns.join(", ")}`);
  }

  return body
    .filter((row) => (row[index.lead_id] || "").trim())
    .map((row) => {
      const lead = {} as RawLead;
      for (const column of RAW_COLUMNS) {
        lead[column] = (row[index[column]] ?? "").trim();
      }
      return lead;
    });
}

export function ingestFromCsvText(text: string): RawLead[] {
  return rowsToRawLeads(parseCsv(text));
}

export function validatePhase1(leads: RawLead[]): Phase1Quality {
  const ids = leads.map((lead) => lead.lead_id);
  const seen = new Set<string>();
  const duplicateLeadIds: string[] = [];
  for (const id of ids) {
    if (seen.has(id)) duplicateLeadIds.push(id);
    seen.add(id);
  }

  const expectedIds = Array.from({ length: EXPECTED_ROW_COUNT }, (_, i) => `L${String(i + 1).padStart(3, "0")}`);
  const missingLeadIds = expectedIds.filter((id) => !seen.has(id));
  const extraLeadIds = ids.filter((id) => !expectedIds.includes(id) && !duplicateLeadIds.includes(id));

  const missingColumns = RAW_COLUMNS.filter((column) => leads.some((lead) => lead[column] === undefined));

  const errors: string[] = [];
  if (leads.length !== EXPECTED_ROW_COUNT) {
    errors.push(`Expected ${EXPECTED_ROW_COUNT} rows, got ${leads.length}.`);
  }
  if (duplicateLeadIds.length) {
    errors.push(`Duplicate lead_id values: ${duplicateLeadIds.join(", ")}.`);
  }
  if (missingLeadIds.length) {
    errors.push(`Missing lead_id values: ${missingLeadIds.join(", ")}.`);
  }
  if (extraLeadIds.length) {
    errors.push(`Unexpected lead_id values: ${extraLeadIds.join(", ")}.`);
  }
  if (missingColumns.length) {
    errors.push(`Rows missing columns: ${missingColumns.join(", ")}.`);
  }

  return {
    ok: errors.length === 0,
    rowCount: leads.length,
    uniqueLeadIds: duplicateLeadIds.length === 0,
    duplicateLeadIds,
    missingLeadIds,
    extraLeadIds,
    missingColumns,
    errors
  };
}

export function ingestFromSnapshot(projectRoot = process.cwd()): Phase1Result {
  const sourcePath = join(projectRoot, SNAPSHOT_RELATIVE_PATH);
  const text = readFileSync(sourcePath, "utf8");
  const leads = ingestFromCsvText(text);
  const quality = validatePhase1(leads);

  if (!quality.ok) {
    throw new Error(`Phase 1 quality gate failed:\n- ${quality.errors.join("\n- ")}`);
  }

  return { leads, sourcePath, quality };
}

export function assertPhase1Contract(leads: RawLead[]): void {
  const quality = validatePhase1(leads);
  if (!quality.ok) {
    throw new Error(`Phase 1 quality gate failed:\n- ${quality.errors.join("\n- ")}`);
  }
}
