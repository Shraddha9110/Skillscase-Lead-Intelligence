import { runPhase2FromSnapshot } from "../phase-2-clean/run";
import type { CleanLead } from "../phase-2-clean/types";
import { classifyLead } from "./classify";
import type { ClassifiedLead, Phase3Quality, Phase3Result } from "./types";

export function validatePhase3(leads: ClassifiedLead[]): Phase3Quality {
  const errors: string[] = [];
  const geminiFailures = leads.filter((lead) => lead.model === "fallback").length;
  const reviewCount = leads.filter((lead) => lead.reviewRequired).length;

  if (!leads.length) errors.push("Phase 3 produced no classified rows.");
  for (const lead of leads) {
    if (!lead.relevant || !lead.reason) {
      errors.push(`${lead.lead_id} is missing relevant/reason.`);
    }
  }

  return {
    ok: errors.length === 0,
    classifiedCount: leads.length,
    geminiFailures,
    reviewCount,
    errors
  };
}

export async function runPhase3(cleanLeads: CleanLead[]): Promise<Phase3Result> {
  const leads: ClassifiedLead[] = [];
  for (const lead of cleanLeads) {
    leads.push(await classifyLead(lead));
  }
  const quality = validatePhase3(leads);
  if (!quality.ok) {
    throw new Error(`Phase 3 quality gate failed:\n- ${quality.errors.join("\n- ")}`);
  }
  return { leads, quality };
}

export async function runPhase3FromSnapshot(projectRoot = process.cwd()): Promise<Phase3Result> {
  return runPhase3(runPhase2FromSnapshot(projectRoot).leads);
}
