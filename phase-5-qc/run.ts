import { runPhase4FromSnapshot } from "../phase-4-enrich/run";
import type { EnrichedLead } from "../phase-4-enrich/types";
import type { ClassificationHint } from "./types";
import { QC_EXAMPLES } from "./examples";
import { toReviewedLead } from "./review";
import type { Phase5Quality, Phase5Result, ReviewedLead } from "./types";

export function validatePhase5(leads: ReviewedLead[]): Phase5Quality {
  const errors: string[] = [];
  if (leads.length !== 30) errors.push(`Expected 30 reviewed rows, got ${leads.length}.`);

  const byId = Object.fromEntries(leads.map((lead) => [lead.lead_id, lead]));
  const deepa = byId.L029;
  const priya = byId.L028;
  const farhan = byId.L016;
  const arjun = byId.L007;

  if (!deepa?.reviewRequired || deepa.email) {
    errors.push("L029 must be in the review queue with email still missing.");
  }
  if (!priya?.reviewRequired || priya.duplicateOf !== "L001") {
    errors.push("L028 must be queued as a duplicate of L001.");
  }
  if (!farhan?.reviewRequired || !farhan.criticNotes.some((note) => /Pharmacists/i.test(note))) {
    errors.push("L016 must be queued for the pharmacist vs CRM conflict.");
  }
  if (!arjun?.reviewRequired || arjun.experience) {
    errors.push("L007 must be queued and must not have invented experience.");
  }
  if (!byId.L014?.reviewRequired || !byId.L014.reviewReasons.some((reason) => /qualification recognition/i.test(reason))) {
    errors.push("L014 must be queued for a GNM qualification recognition check.");
  }
  if (!byId.L030?.reviewRequired || !byId.L030.reviewReasons.some((reason) => /guarantee|expectation risk/i.test(reason))) {
    errors.push("L030 must be queued for job-guarantee expectation risk.");
  }
  if (byId.L025?.reviewReasons.some((reason) => /qualification recognition/i.test(reason))) {
    errors.push("L025 is Not Relevant and must not be on the GNM recognition check.");
  }
  if (leads.some((lead) => lead.qualityFlags.some((flag) => flag.startsWith("column_shift")))) {
    errors.push("No reviewed row may carry a column_shift flag.");
  }

  const autoSent = leads.filter((lead) => lead.reviewRequired && lead.queueStatus !== "pending" && lead.accepted);
  if (autoSent.length) {
    errors.push("A review-queue row was auto-accepted.");
  }

  const showcaseCount = leads.filter((lead) => lead.showcaseId).length;
  if (showcaseCount < 3) errors.push("Need at least 3 documented QC showcase rows.");

  return {
    ok: errors.length === 0,
    rowCount: leads.length,
    reviewCount: leads.filter((lead) => lead.reviewRequired).length,
    showcaseCount,
    errors
  };
}

export function runPhase5(
  enrichedLeads: EnrichedLead[],
  classifications: Record<string, ClassificationHint> = {}
): Phase5Result {
  const leads = enrichedLeads.map((lead) => toReviewedLead(lead, classifications[lead.lead_id]));
  const quality = validatePhase5(leads);
  if (!quality.ok) {
    throw new Error(`Phase 5 quality gate failed:\n- ${quality.errors.join("\n- ")}`);
  }
  return {
    leads,
    queue: leads.filter((lead) => lead.reviewRequired),
    examples: QC_EXAMPLES,
    quality
  };
}

export function runPhase5FromSnapshot(projectRoot = process.cwd()): Phase5Result {
  return runPhase5(runPhase4FromSnapshot(projectRoot).leads);
}
