import { mkdirSync, writeFileSync } from "fs";
import { join } from "path";
import { parseCsv } from "../phase-1-ingest/parseCsv";
import type { PipelineDataset, ProcessedLead } from "./types";
import { OUTPUT_COLUMNS } from "./types";

export const UTF8_BOM = "\uFEFF";

export function toCsv(rows: ProcessedLead[]): string {
  const escape = (value: unknown) => {
    const text = value === null || value === undefined ? "" : String(value);
    if (/[",\n]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
    return text;
  };
  return (
    UTF8_BOM +
    [
      OUTPUT_COLUMNS.join(","),
      ...rows.map((row) => OUTPUT_COLUMNS.map((column) => escape(row[column])).join(","))
    ].join("\n")
  );
}

export function parseProcessedCsv(text: string): Record<string, string>[] {
  const [header, ...body] = parseCsv(text.replace(/^\uFEFF/, ""));
  return body.map((row) => Object.fromEntries(header.map((key, index) => [key, row[index] ?? ""])));
}

export function writeOutputs(dataset: PipelineDataset, outputDir: string): { csvPath: string; jsonPath: string } {
  mkdirSync(outputDir, { recursive: true });
  const csvPath = join(outputDir, "skillcase_leads_enriched.csv");
  const jsonPath = join(outputDir, "skillcase_leads_enriched.json");
  writeFileSync(csvPath, toCsv(dataset.leads));
  writeFileSync(jsonPath, JSON.stringify(dataset, null, 2));
  return { csvPath, jsonPath };
}
