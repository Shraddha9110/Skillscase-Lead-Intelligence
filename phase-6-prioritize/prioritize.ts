import type { Relevance } from "../phase-3-classify/types";
import type { Signals } from "../phase-4-enrich/types";
import type { ReviewedLead } from "../phase-5-qc/types";
import {
  AS_OF_DATE,
  COMPLETENESS_POINTS,
  DUPLICATE_SCORE,
  EXPERIENCE_POINTS,
  GERMAN_POINTS,
  HIGH_MIN,
  INTENT_POINTS,
  MEDIUM_MIN,
  OUT_OF_ICP_SCORE,
  PENALTY_POINTS,
  RECENCY_POINTS
} from "./scorecard";
import { finalizeConfidence, finalizeReason } from "./reason";
import type { PriorityBand, PriorityResult, PrioritizedLead, ScoreBreakdown } from "./types";

const TODAY = new Date(`${AS_OF_DATE}T00:00:00`);
const DATE_SHAPE = /^\d{4}-\d{2}-\d{2}$/;

export function bandForScore(score: number): PriorityBand {
  if (score >= HIGH_MIN) return "High";
  if (score >= MEDIUM_MIN) return "Medium";
  return "Low";
}

export function inferRelevance(lead: ReviewedLead): Relevance {
  if (lead.relevant) return lead.relevant;
  const s = lead.signals;
  if (s.nonHealthcare || s.wantsCanada || s.wantsUk) return "Not Relevant";
  if (s.nursing && (s.wantsGermany || s.exploring || s.otherCourse || /b2|german|germany/i.test(lead.goal))) {
    return "Relevant";
  }
  if (s.healthcare && !s.nursing) return "Uncertain";
  return "Uncertain";
}

export function germanPoints(lead: ReviewedLead): number {
  if (lead.germanRank === 4 || /^b2$/i.test(lead.german_level)) return GERMAN_POINTS.B2;
  if (lead.germanRank === 3 || /^b1$/i.test(lead.german_level)) return GERMAN_POINTS.B1;
  if (lead.germanRank === 2 || /^a2$/i.test(lead.german_level)) return GERMAN_POINTS.A2;
  if (lead.germanRank === 1 || /^a1$/i.test(lead.german_level)) return GERMAN_POINTS.A1;
  return GERMAN_POINTS.unknown;
}

export function experiencePoints(lead: ReviewedLead): number {
  const years = lead.experienceYears;
  if (years === null) return EXPERIENCE_POINTS.unknown;
  if (years >= 5) return EXPERIENCE_POINTS.fivePlus;
  if (years >= 3) return EXPERIENCE_POINTS.threeToFour;
  if (years >= 1) return EXPERIENCE_POINTS.oneToTwo;
  return EXPERIENCE_POINTS.underOne;
}

export function intentPoints(signals: Signals): number {
  if (signals.readyNow || signals.asksCall) return INTENT_POINTS.callOrJobs;
  if (signals.hasCertificate && signals.jobsInterview) return INTENT_POINTS.callOrJobs;
  if (signals.process || signals.documents || signals.timeline || signals.gnmQuestion || signals.eligibility) {
    return INTENT_POINTS.processOrEligibility;
  }
  if (signals.cannotAfford) return INTENT_POINTS.cannotAfford;
  if (signals.exploring) return INTENT_POINTS.exploring;
  return INTENT_POINTS.exploring;
}

export function recencyPoints(lastContacted: string): number {
  if (!DATE_SHAPE.test(lastContacted)) return RECENCY_POINTS.unknown;
  const days = Math.round((TODAY.getTime() - new Date(`${lastContacted}T00:00:00`).getTime()) / 86400000);
  if (days < 0) return RECENCY_POINTS.unknown;
  if (days <= 3) return RECENCY_POINTS.within3;
  if (days <= 6) return RECENCY_POINTS.within6;
  if (days <= 10) return RECENCY_POINTS.within10;
  return RECENCY_POINTS.older;
}

export function penaltyPoints(signals: Signals): number {
  let penalty = 0;
  if (signals.missingEmail) penalty += PENALTY_POINTS.missingEmail;
  if (signals.jobGuarantee) penalty += PENALTY_POINTS.jobGuarantee;
  if (signals.cannotAfford) penalty += PENALTY_POINTS.cannotAfford;
  else if (signals.installments) penalty += PENALTY_POINTS.installment;
  return penalty;
}

function emptyBreakdown(floor: number): ScoreBreakdown {
  return { german: 0, experience: 0, intent: 0, recency: 0, completeness: 0, penalty: 0, floor };
}

function clampScore(value: number): number {
  return Math.max(0, Math.min(100, value));
}

export function scoreBreakdownSum(breakdown: ScoreBreakdown): number {
  return (
    breakdown.german +
    breakdown.experience +
    breakdown.intent +
    breakdown.recency +
    breakdown.completeness +
    breakdown.penalty +
    breakdown.floor
  );
}

export function prioritizeLead(lead: ReviewedLead, relevant = inferRelevance(lead)): PriorityResult {
  if (lead.isDuplicate) {
    return {
      score: null,
      band: "",
      rationale: `Duplicate of ${lead.duplicateOf} — not scored.`,
      breakdown: emptyBreakdown(0)
    };
  }

  if (relevant === "Not Relevant") {
    return {
      score: OUT_OF_ICP_SCORE,
      band: "Low",
      rationale: "Low because the lead is outside the Skillcase ICP. Keep on file for a polite close only.",
      breakdown: emptyBreakdown(OUT_OF_ICP_SCORE)
    };
  }

  const german = germanPoints(lead);
  const experience = experiencePoints(lead);
  const intent = intentPoints(lead.signals);
  const recency = recencyPoints(lead.last_contacted);
  const completeness = lead.email && lead.phone ? COMPLETENESS_POINTS : 0;
  const penalty = penaltyPoints(lead.signals);
  const breakdown: ScoreBreakdown = {
    german,
    experience,
    intent,
    recency,
    completeness,
    penalty,
    floor: 0
  };
  const score = clampScore(scoreBreakdownSum(breakdown));
  const rawBand = bandForScore(score);
  const band = relevant === "Uncertain" && rawBand === "High" ? "Medium" : rawBand;

  return {
    score,
    band,
    rationale: `${band} because German=${lead.german_level || "unknown"} (${german}), experience=${lead.experience || "unknown"} (${experience}), intent=${intent}, recency=${recency}, completeness=${completeness}, penalty=${penalty}.`,
    breakdown
  };
}

function suppressDialAction(lead: ReviewedLead): string {
  return `Merge into ${lead.duplicateOf} and suppress this ID from the dialer.`;
}

export function toPrioritizedLead(lead: ReviewedLead, callOrder: number | null = null): PrioritizedLead {
  const relevant = lead.isDuplicate ? `Duplicate of ${lead.duplicateOf}` : inferRelevance(lead);
  const reason = finalizeReason(lead, relevant, lead.reason);
  const confidence = finalizeConfidence(lead, relevant);
  const priority = prioritizeLead(lead, inferRelevance(lead));
  const dialSuppressed = lead.isDuplicate;
  const nextAction =
    dialSuppressed
      ? suppressDialAction(lead)
      : relevant === "Not Relevant"
        ? "Send a short not-a-fit note. Offer to reopen only if their goal changes."
        : lead.nextAction;
  return {
    ...lead,
    ...priority,
    relevant,
    reason,
    confidence,
    nextAction,
    profile: dialSuppressed ? "" : lead.profile,
    intent: dialSuppressed ? "" : lead.intent,
    needs: dialSuppressed || relevant === "Not Relevant" ? "" : lead.needs,
    objections: dialSuppressed ? "" : lead.objections,
    missingInformation: dialSuppressed ? "" : lead.missingInformation,
    opportunity: dialSuppressed ? "" : lead.opportunity,
    sources: dialSuppressed ? [] : lead.sources.filter((source) => /https?:\/\//.test(source)),
    dialSuppressed,
    callOrder,
    pipelineStep: "phase6-prioritize"
  };
}

export function isReadyToCall(lead: {
  reviewRequired?: boolean;
  accepted?: boolean;
  isDuplicate?: boolean;
  relevant?: string;
}): boolean {
  if (lead.relevant !== "Relevant" || lead.isDuplicate) return false;
  if (lead.reviewRequired && lead.accepted !== true) return false;
  return true;
}

export function assignCallOrder(leads: PrioritizedLead[]): PrioritizedLead[] {
  const ranked = leads
    .filter((lead) => !lead.dialSuppressed && isReadyToCall(lead))
    .sort((a, b) => (b.score ?? -1) - (a.score ?? -1) || a.lead_id.localeCompare(b.lead_id));

  const order = new Map(ranked.map((lead, index) => [lead.lead_id, index + 1]));
  return leads.map((lead) => ({
    ...lead,
    callOrder: order.get(lead.lead_id) ?? null
  }));
}
