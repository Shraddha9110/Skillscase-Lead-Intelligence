import { runPhase2FromSnapshot } from "../phase-2-clean/run";
import type { CleanLead } from "../phase-2-clean/types";
import { toEnrichedLead } from "./enrich";
import type { EnrichedLead, Phase4Quality, Phase4Result } from "./types";

const REQUIRED_FIELDS: (keyof EnrichedLead)[] = [
  "profile",
  "intent",
  "needs",
  "objections",
  "missingInformation",
  "opportunity",
  "nextAction"
];

export function validatePhase4(leads: EnrichedLead[]): Phase4Quality {
  const errors: string[] = [];
  if (leads.length !== 30) errors.push(`Expected 30 enriched rows, got ${leads.length}.`);

  for (const lead of leads) {
    if (lead.isDuplicate) {
      if (lead.profile || lead.intent || lead.needs) {
        errors.push(`${lead.lead_id} is a duplicate and must not be enriched.`);
      }
      continue;
    }
    const notRelevant = lead.signals.nonHealthcare || lead.signals.wantsCanada || lead.signals.wantsUk;
    for (const field of REQUIRED_FIELDS) {
      if (field === "needs" && notRelevant) continue;
      if (!String(lead[field] || "").trim()) {
        errors.push(`${lead.lead_id} is missing ${field}.`);
      }
    }
    if (notRelevant && lead.needs) {
      errors.push(`${lead.lead_id} is Not Relevant and must not have a sales need.`);
    }
  }

  const karan = leads.find((lead) => lead.lead_id === "L030");
  if (karan && /guarantee you a job|guaranteed job/i.test(`${karan.opportunity} ${karan.nextAction} ${karan.needs}`)) {
    errors.push("L030 must not invent a job guarantee.");
  }

  const deepa = leads.find((lead) => lead.lead_id === "L029");
  if (deepa && !/email/i.test(deepa.missingInformation)) {
    errors.push("L029 must list the missing email.");
  }

  return {
    ok: errors.length === 0,
    rowCount: leads.length,
    sourcedCount: leads.filter((lead) => lead.sources.length > 0).length,
    errors
  };
}

export function runPhase4(cleanLeads: CleanLead[]): Phase4Result {
  const leads = cleanLeads.map(toEnrichedLead);
  const quality = validatePhase4(leads);
  if (!quality.ok) {
    throw new Error(`Phase 4 quality gate failed:\n- ${quality.errors.join("\n- ")}`);
  }
  return { leads, quality };
}

export function runPhase4FromSnapshot(projectRoot = process.cwd()): Phase4Result {
  return runPhase4(runPhase2FromSnapshot(projectRoot).leads);
}
