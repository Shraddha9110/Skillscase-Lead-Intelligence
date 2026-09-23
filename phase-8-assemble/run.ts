import { join } from "path";
import { runPhase7FromSnapshot } from "../phase-7-outreach/run";
import type { OutreachedLead } from "../phase-7-outreach/types";
import { assembleDataset } from "./assemble";
import { writeOutputs } from "./export";
import { missingUiSurfaces } from "./ui";
import type { Phase8Quality, Phase8Result, ProcessedLead } from "./types";
import { REQUIRED_TEXT_FIELDS } from "./types";

const BANNED = /guarantee you a job|guaranteed job|₹\d|rs\.?\s*\d/i;
const ALL_IDS = Array.from({ length: 30 }, (_, index) => `L${String(index + 1).padStart(3, "0")}`);

export function validatePhase8(leads: ProcessedLead[], projectRoot = process.cwd()): Phase8Quality {
  const errors: string[] = [];
  if (leads.length !== 30) errors.push(`Expected 30 assembled rows, got ${leads.length}.`);

  const ids = leads.map((lead) => lead.lead_id);
  const uniqueIds = new Set(ids);
  if (uniqueIds.size !== 30) errors.push("Lead ids must stay unique. Do not drop or merge ids.");
  for (const id of ALL_IDS) {
    if (!uniqueIds.has(id)) errors.push(`Missing ${id} from the final dataset.`);
  }

  for (const lead of leads) {
    if (lead.is_duplicate) {
      if (lead.outreach || lead.priority_score !== null || lead.profile || lead.intent) {
        errors.push(`${lead.lead_id} is a duplicate and must have no score, enrichment, or outreach.`);
      }
      if (!String(lead.relevant).startsWith("Duplicate of")) {
        errors.push(`${lead.lead_id} Relevant column must be Duplicate of <id>.`);
      }
    } else {
      for (const field of REQUIRED_TEXT_FIELDS) {
        if (field === "need" && lead.relevant === "Not Relevant") continue;
        if (!String(lead[field] ?? "").trim()) errors.push(`${lead.lead_id} is missing ${field}.`);
      }
      if (lead.relevant === "Not Relevant" && lead.need) {
        errors.push(`${lead.lead_id} is Not Relevant and must not have a sales need.`);
      }
    }
    if (lead.priority === "High" && lead.relevant !== "Relevant") {
      errors.push(`${lead.lead_id} is High but not Relevant.`);
    }
    if ((lead.is_duplicate || lead.relevant !== "Relevant") && lead.outreach) {
      errors.push(`${lead.lead_id} must have empty outreach.`);
    }
    if (lead.relevant === "Not Relevant" && /call/i.test(lead.next_action)) {
      errors.push(`${lead.lead_id} is Not Relevant and must not recommend a call.`);
    }
    const copy = `${lead.outreach} ${lead.need} ${lead.opportunity} ${lead.next_action}`;
    if (BANNED.test(copy)) errors.push(`${lead.lead_id} invents a price or a job guarantee.`);
  }

  const byId = Object.fromEntries(leads.map((lead) => [lead.lead_id, lead]));
  if (byId.L029?.email || !byId.L029?.review_required) {
    errors.push("L029 must stay in review with email still missing.");
  }
  if (!byId.L028?.is_duplicate || byId.L028.duplicate_of !== "L001" || byId.L028.outreach) {
    errors.push("L028 must be kept as a blank duplicate of L001.");
  }
  if (!byId.L016?.review_required) errors.push("L016 must remain in the review queue.");
  if (byId.L007?.experience) errors.push("L007 must not invent experience years.");
  if (!byId.L014?.review_required) errors.push("L014 must be in human review for GNM recognition.");
  if (leads.some((lead) => /column_shift/.test(lead.quality_flags))) {
    errors.push("No row may be marked as column-shifted.");
  }

  errors.push(...missingUiSurfaces(projectRoot));

  return {
    ok: errors.length === 0,
    rowCount: leads.length,
    uniquePeople: leads.filter((lead) => !lead.is_duplicate).length,
    draftCount: leads.filter((lead) => lead.outreach).length,
    reviewCount: leads.filter((lead) => lead.review_required).length,
    errors
  };
}

export function runPhase8(outreachedLeads: OutreachedLead[], projectRoot = process.cwd()): Phase8Result {
  const dataset = assembleDataset(outreachedLeads);
  const quality = validatePhase8(dataset.leads, projectRoot);
  if (!quality.ok) {
    throw new Error(`Phase 8 quality gate failed:\n- ${quality.errors.join("\n- ")}`);
  }
  return { dataset, leads: dataset.leads, quality };
}

export function runPhase8FromSnapshot(projectRoot = process.cwd()): Phase8Result {
  return runPhase8(runPhase7FromSnapshot(projectRoot).leads, projectRoot);
}

export function writePhase8Outputs(result: Phase8Result, projectRoot = process.cwd()) {
  const processed = writeOutputs(result.dataset, join(projectRoot, "data", "processed"));
  writeOutputs(result.dataset, join(projectRoot, "public", "data"));
  return processed;
}
