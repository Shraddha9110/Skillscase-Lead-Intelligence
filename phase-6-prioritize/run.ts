import { runPhase5FromSnapshot } from "../phase-5-qc/run";
import type { ReviewedLead } from "../phase-5-qc/types";
import { assignCallOrder, toPrioritizedLead } from "./prioritize";
import { reasonCitesLead } from "./reason";
import type { Phase6Quality, Phase6Result, PrioritizedLead } from "./types";

export function validatePhase6(leads: PrioritizedLead[]): Phase6Quality {
  const errors: string[] = [];
  if (leads.length !== 30) errors.push(`Expected 30 prioritized rows, got ${leads.length}.`);

  for (const lead of leads) {
    if (lead.isDuplicate) {
      if (lead.score !== null || lead.band) {
        errors.push(`${lead.lead_id} is a duplicate and must have no score.`);
      }
      if (!lead.dialSuppressed) errors.push(`${lead.lead_id} must be suppressed from the dialer.`);
      if (!String(lead.relevant).startsWith("Duplicate of")) {
        errors.push(`${lead.lead_id} Relevant column must read Duplicate of <id>.`);
      }
    } else {
      if (!Number.isFinite(lead.score) || (lead.score ?? -1) < 0 || (lead.score ?? 0) > 100) {
        errors.push(`${lead.lead_id} has an invalid score ${lead.score}.`);
      }
      if (!["High", "Medium", "Low"].includes(lead.band)) {
        errors.push(`${lead.lead_id} is missing a priority band.`);
      }
    }
    if (!lead.rationale.trim()) errors.push(`${lead.lead_id} is missing a rationale.`);
    if (lead.relevant === "Not Relevant" && lead.band === "High") {
      errors.push(`${lead.lead_id} is Not Relevant but was marked High.`);
    }
    if (lead.isDuplicate && !/suppress/i.test(lead.nextAction)) {
      errors.push(`${lead.lead_id} must have a suppress-dial next action.`);
    }
    if (lead.relevant === "Relevant" && !lead.isDuplicate && lead.score == null) {
      errors.push(`${lead.lead_id} is unique and Relevant but has no score.`);
    }
    if (!lead.isDuplicate && !reasonCitesLead(lead.reason, lead)) {
      errors.push(`${lead.lead_id} reason must cite a detail from that lead's row or conversation.`);
    }
    if (!lead.isDuplicate && (lead.confidence === undefined || lead.confidence < 0 || lead.confidence > 1)) {
      errors.push(`${lead.lead_id} is missing a per-lead confidence.`);
    }
  }

  const byId = Object.fromEntries(leads.map((lead) => [lead.lead_id, lead]));
  for (const id of ["L008", "L021", "L028"] as const) {
    if (byId[id]?.score !== null) errors.push(`${id} must have no score as a duplicate.`);
  }
  if (byId.L028?.duplicateOf !== "L001") errors.push("L028 must stay linked to L001.");

  const uniqueRelevant = leads.filter((lead) => lead.relevant === "Relevant" && !lead.isDuplicate);
  if (uniqueRelevant.length === 0) errors.push("Expected at least one unique Relevant row.");
  if (!uniqueRelevant.some((lead) => lead.band === "High")) {
    errors.push("At least one unique Relevant row should land in High.");
  }

  const highNonRelevant = leads.filter((lead) => lead.band === "High" && lead.relevant !== "Relevant");
  if (highNonRelevant.length) {
    errors.push(`High band used on non-Relevant rows: ${highNonRelevant.map((lead) => lead.lead_id).join(", ")}.`);
  }
  const reviewOnDialer = leads.filter(
    (lead) => lead.callOrder !== null && lead.reviewRequired && lead.accepted !== true
  );
  if (reviewOnDialer.length) {
    errors.push(
      `Review-held leads must not be on Call first until accepted: ${reviewOnDialer.map((lead) => lead.lead_id).join(", ")}.`
    );
  }

  const unique = leads.filter((lead) => !lead.isDuplicate);
  const genericReasons = unique.filter((lead) =>
    /nursing profile with a germany|outside healthcare or a non-germany|allied health or a critical field/i.test(
      lead.reason
    )
  );
  if (genericReasons.length) {
    errors.push(`Generic category reasons: ${genericReasons.map((lead) => lead.lead_id).join(", ")}.`);
  }
  const relevantConf = unique.filter((lead) => lead.relevant === "Relevant").map((lead) => lead.confidence);
  if (relevantConf.length >= 3 && new Set(relevantConf).size === 1) {
    errors.push("Relevant confidence looks like a fixed category value, not a per-lead judgment.");
  }

  return {
    ok: errors.length === 0,
    rowCount: leads.length,
    highCount: leads.filter((lead) => lead.band === "High").length,
    mediumCount: leads.filter((lead) => lead.band === "Medium").length,
    lowCount: leads.filter((lead) => lead.band === "Low").length,
    duplicateLowCount: leads.filter((lead) => lead.isDuplicate && lead.score === null).length,
    errors
  };
}

export function runPhase6(reviewedLeads: ReviewedLead[]): Phase6Result {
  const leads = assignCallOrder(reviewedLeads.map((lead) => toPrioritizedLead(lead)));
  const quality = validatePhase6(leads);
  if (!quality.ok) {
    throw new Error(`Phase 6 quality gate failed:\n- ${quality.errors.join("\n- ")}`);
  }
  return {
    leads,
    callList: leads
      .filter((lead) => lead.callOrder !== null)
      .sort((a, b) => (a.callOrder ?? 99) - (b.callOrder ?? 99)),
    quality
  };
}

export function runPhase6FromSnapshot(projectRoot = process.cwd()): Phase6Result {
  return runPhase6(runPhase5FromSnapshot(projectRoot).leads);
}
