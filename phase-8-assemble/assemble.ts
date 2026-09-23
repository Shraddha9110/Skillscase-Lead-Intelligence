import { QC_EXAMPLES } from "../phase-5-qc/examples";
import { AS_OF_DATE } from "../phase-6-prioritize/scorecard";
import type { OutreachedLead } from "../phase-7-outreach/types";
import { PIPELINE_STEPS, PRIORITY_CRITERIA, RELEVANCE_CRITERIA } from "./criteria";
import type { PipelineDataset, ProcessedLead } from "./types";

function joinList(values: string[]): string {
  return values.filter(Boolean).join(" | ");
}

function confidenceOf(lead: OutreachedLead): number {
  if (typeof lead.confidence === "number" && Number.isFinite(lead.confidence)) return lead.confidence;
  return 0;
}

export function toProcessedLead(lead: OutreachedLead, mode: "rules" | "llm" = "rules"): ProcessedLead {
  const duplicate = lead.isDuplicate;
  const sources = (duplicate ? [] : lead.sources).filter((source) => /https?:\/\//.test(source));
  return {
    lead_id: lead.lead_id,
    name: lead.displayName || lead.name,
    phone: lead.phone,
    email: lead.email,
    city: lead.city,
    education: lead.education,
    experience: lead.experience,
    goal: lead.goal,
    german_level: lead.german_level,
    source: lead.source,
    last_contacted: lead.last_contacted,
    conversation: lead.conversation,
    notes: lead.notes,
    relevant: duplicate ? `Duplicate of ${lead.duplicateOf}` : lead.relevant,
    reason: duplicate ? `Duplicate of ${lead.duplicateOf}.` : lead.reason,
    confidence: duplicate ? 0 : confidenceOf(lead),
    intent: duplicate ? "" : lead.intent,
    profile: duplicate ? "" : lead.profile,
    need: duplicate ? "" : lead.needs,
    objection: duplicate ? "" : lead.objections,
    missing_information: duplicate ? "" : lead.missingInformation,
    opportunity: duplicate ? "" : lead.opportunity,
    priority: duplicate ? "" : lead.band,
    priority_score: duplicate ? null : lead.score,
    next_action: lead.nextAction,
    outreach: duplicate ? "" : lead.outreach,
    is_duplicate: lead.isDuplicate,
    duplicate_of: lead.duplicateOf,
    quality_flags: joinList(lead.qualityFlags.filter((flag) => !flag.startsWith("column_shift"))),
    review_required: lead.reviewRequired,
    review_reasons: joinList(lead.reviewReasons),
    critic_notes: joinList(lead.criticNotes),
    sources: joinList(sources),
    pipeline_mode: mode
  };
}

export function assembleDataset(
  leads: OutreachedLead[],
  generatedAt = new Date().toISOString(),
  mode: "rules" | "llm" = "rules",
  model = "rules"
): PipelineDataset {
  const processed = leads.map((lead) => toProcessedLead(lead, mode));
  return {
    generatedAt,
    asOfDate: AS_OF_DATE,
    mode,
    model,
    inputCount: processed.length,
    uniquePeople: processed.filter((lead) => !lead.is_duplicate).length,
    relevantCount: processed.filter((lead) => lead.relevant === "Relevant" && !lead.is_duplicate).length,
    reviewCount: processed.filter((lead) => lead.review_required).length,
    repairedCount: processed.filter((lead) => lead.missing_information).length,
    duplicateCount: processed.filter((lead) => lead.is_duplicate).length,
    draftCount: processed.filter((lead) => lead.outreach).length,
    steps: PIPELINE_STEPS,
    qcExamples: QC_EXAMPLES,
    leads: processed,
    relevanceCriteria: RELEVANCE_CRITERIA,
    priorityCriteria: PRIORITY_CRITERIA
  };
}
