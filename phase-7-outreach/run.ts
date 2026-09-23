import { runPhase6FromSnapshot } from "../phase-6-prioritize/run";
import type { PrioritizedLead } from "../phase-6-prioritize/types";
import { endsWithNextStep } from "./critic";
import { assertOutreachShape, isOutreachEligible, toOutreachedLead } from "./outreach";
import type { OutreachedLead, Phase7Quality, Phase7Result } from "./types";

export function validatePhase7(leads: OutreachedLead[]): Phase7Quality {
  const errors: string[] = [];
  if (leads.length !== 30) errors.push(`Expected 30 outreach rows, got ${leads.length}.`);

  for (const lead of leads) {
    errors.push(...assertOutreachShape(lead, lead.outreach));
    if (lead.criticFlags.length) {
      errors.push(`${lead.lead_id}: ${lead.criticFlags.join("; ")}`);
    }
    if (lead.outreachEligible && lead.outreach && !endsWithNextStep(lead.outreach)) {
      errors.push(`${lead.lead_id} draft must end with one next step.`);
    }
  }

  const byId = Object.fromEntries(leads.map((lead) => [lead.lead_id, lead]));
  for (const id of ["L008", "L021", "L028"] as const) {
    if (byId[id]?.outreach) errors.push(`${id} is a duplicate and must not get a second message.`);
  }
  for (const id of ["L005", "L012", "L020", "L025"] as const) {
    if (byId[id]?.outreach) errors.push(`${id} is Not Relevant and must have empty outreach.`);
  }
  if (byId.L016?.outreach) errors.push("L016 is Uncertain and must not be auto-messaged.");
  if (byId.L030 && /guarantee you a job|₹/i.test(byId.L030.outreach)) {
    errors.push("L030 must refuse a guarantee and must not invent a price.");
  }
  if (byId.L030 && !/does not guarantee/i.test(byId.L030.outreach)) {
    errors.push("L030 must say Skillcase does not guarantee a job.");
  }
  for (const id of ["L002", "L007", "L014"] as const) {
    const gnm = byId[id];
    if (!gnm?.outreach) continue;
    if (!/confirm eligibility/i.test(gnm.outreach)) {
      errors.push(`${id} is GNM and must say we will confirm eligibility.`);
    }
    if (/\byes,?\s+you can apply\b|\bgnm nurses?\b.{0,40}\bdo apply\b/i.test(gnm.outreach)) {
      errors.push(`${id} must not tell a GNM lead they can apply.`);
    }
  }

  const drafts = leads.filter((lead) => lead.outreach);
  const expectedDrafts = leads.filter(isOutreachEligible);
  if (drafts.length !== expectedDrafts.length) {
    errors.push(`Expected ${expectedDrafts.length} drafts, got ${drafts.length}.`);
  }

  return {
    ok: errors.length === 0,
    rowCount: leads.length,
    draftCount: drafts.length,
    blankCount: leads.length - drafts.length,
    errors
  };
}

export function runPhase7(prioritizedLeads: PrioritizedLead[]): Phase7Result {
  const leads = prioritizedLeads.map(toOutreachedLead);
  const quality = validatePhase7(leads);
  if (!quality.ok) {
    throw new Error(`Phase 7 quality gate failed:\n- ${quality.errors.join("\n- ")}`);
  }
  return {
    leads,
    drafts: leads.filter((lead) => lead.outreachEligible),
    quality
  };
}

export function runPhase7FromSnapshot(projectRoot = process.cwd()): Phase7Result {
  return runPhase7(runPhase6FromSnapshot(projectRoot).leads);
}
