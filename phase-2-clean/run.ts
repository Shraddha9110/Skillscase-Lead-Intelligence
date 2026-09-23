import { ingestFromSnapshot } from "../phase-1-ingest/ingest";
import type { RawLead } from "../phase-1-ingest/types";
import { cleanLead } from "./clean";
import { markDuplicates } from "./dedupe";
import type { CleanLead, Phase2Quality, Phase2Result } from "./types";

export function validatePhase2(leads: CleanLead[]): Phase2Quality {
  const errors: string[] = [];
  const deepa = leads.find((lead) => lead.lead_id === "L029");
  const priyaCopy = leads.find((lead) => lead.lead_id === "L008");
  const priyaFuzzy = leads.find((lead) => lead.lead_id === "L028");
  const arjun = leads.find((lead) => lead.lead_id === "L007");

  if (leads.length !== 30) errors.push(`Expected 30 cleaned rows, got ${leads.length}.`);
  if (!deepa || deepa.city !== "Chennai" || deepa.email !== "") {
    errors.push("L029 must have city=Chennai and an empty email (missing field, not a column shift).");
  }
  if (leads.some((lead) => lead.qualityFlags.some((flag) => flag.startsWith("column_shift")))) {
    errors.push("No row may be marked as column-shifted. Empty cells stay empty.");
  }
  if (!priyaCopy?.isDuplicate || priyaCopy.duplicateOf !== "L001") {
    errors.push("L008 must be marked as a duplicate of L001.");
  }
  if (!priyaFuzzy?.isDuplicate || priyaFuzzy.duplicateOf !== "L001") {
    errors.push("L028 must be marked as a fuzzy duplicate of L001.");
  }
  if (!arjun || arjun.experience !== "" || arjun.experienceYears !== null) {
    errors.push("L007 experience must stay blank; do not invent years.");
  }

  const duplicateCount = leads.filter((lead) => lead.isDuplicate).length;
  const columnShiftCount = leads.filter((lead) =>
    lead.qualityFlags.some((flag) => flag.startsWith("column_shift"))
  ).length;

  return {
    ok: errors.length === 0,
    rowCount: leads.length,
    duplicateCount,
    columnShiftCount,
    errors
  };
}

export function runPhase2(rawLeads: RawLead[]): Phase2Result {
  const leads = markDuplicates(rawLeads.map(cleanLead));
  const quality = validatePhase2(leads);
  if (!quality.ok) {
    throw new Error(`Phase 2 quality gate failed:\n- ${quality.errors.join("\n- ")}`);
  }
  return { leads, quality };
}

export function runPhase2FromSnapshot(projectRoot = process.cwd()): Phase2Result {
  return runPhase2(ingestFromSnapshot(projectRoot).leads);
}
