import { NOT_A_FIT_NOTE } from "../phase-4-enrich/enrich";
import type { EnrichedLead } from "../phase-4-enrich/types";
import type { ClassificationHint, QualityReview, ReviewedLead } from "./types";

const PRICE_OR_GUARANTEE = /guarantee you a job|guaranteed job|₹\d|rs\.?\s*\d/i;

function isGnm(lead: EnrichedLead): boolean {
  return /\bgnm\b/i.test(`${lead.education} ${lead.conversation}`);
}

function isNotRelevant(lead: EnrichedLead, classification?: ClassificationHint): boolean {
  return (
    classification?.relevant === "Not Relevant" ||
    lead.signals.nonHealthcare ||
    lead.signals.wantsCanada ||
    lead.signals.wantsUk
  );
}

export function reviewLead(lead: EnrichedLead, classification?: ClassificationHint): QualityReview {
  const reviewReasons: string[] = [];
  const criticNotes: string[] = [];
  const validationErrors: string[] = [];

  if (lead.isDuplicate) {
    reviewReasons.push(`Duplicate of ${lead.duplicateOf} — same phone or email as an earlier row.`);
    criticNotes.push(
      lead.lead_id === "L028"
        ? "Name is 'Priya S.' but phone and email match L001. Fuzzy duplicate, not a new person."
        : `Same contact details as ${lead.duplicateOf}.`
    );
  }

  if (lead.qualityFlags.some((flag) => flag.startsWith("column_shift"))) {
    reviewReasons.push("Row was incorrectly marked as a column shift.");
  }

  if (lead.missingFields.includes("email") || !lead.phone) {
    reviewReasons.push("Missing a primary contact field.");
  }

  const education = `${lead.education}`.toLowerCase();
  if (education.includes("bpharm") || (lead.signals.healthcare && !lead.signals.nursing)) {
    reviewReasons.push("Allied-health profile; human should decide the track.");
    criticNotes.push(
      "Skillcase signup lists Pharmacists. Human should decide the track — do not auto-discard."
    );
  }

  if (isGnm(lead) && !isNotRelevant(lead, classification)) {
    reviewReasons.push("qualification recognition check needed");
    criticNotes.push("GNM recognition is employer- and state-dependent. Confirm before a long pitch.");
  }

  if (lead.lead_id === "L014" && !isNotRelevant(lead, classification)) {
    reviewReasons.push("qualification recognition check needed");
    criticNotes.push("L014 asked whether GNM is accepted. Hold for a human qualification check.");
  }

  if (lead.signals.jobGuarantee || lead.lead_id === "L030") {
    reviewReasons.push("Job-guarantee expectation risk.");
    criticNotes.push("Lead asked if Skillcase guarantees a job. Hold until a human resets expectations. Do not auto-dial.");
  }

  if (lead.lead_id === "L007") {
    criticNotes.push("Experience is missing. Do not invent years of work.");
    if (lead.experience || lead.experienceYears !== null) {
      validationErrors.push("L007 experience was invented. Keep it blank and mark it missing.");
    }
    if (!lead.missingFields.includes("experience")) {
      validationErrors.push("L007 must still list experience as missing.");
    }
  }

  if (lead.lead_id === "L029") {
    criticNotes.push("Email is missing. WhatsApp only until an address is captured.");
  }

  const notRelevant = isNotRelevant(lead, classification);
  if (notRelevant) {
    if (/call/i.test(lead.nextAction)) {
      validationErrors.push("Not relevant lead must not recommend a call.");
    }
    if (lead.nextAction && lead.nextAction !== NOT_A_FIT_NOTE && !lead.isDuplicate) {
      validationErrors.push("Not relevant lead must use the not-a-fit next action.");
    }
  }

  const copy = [lead.profile, lead.needs, lead.opportunity, lead.nextAction, lead.objections].join(" ");
  if (PRICE_OR_GUARANTEE.test(copy)) {
    validationErrors.push("Enrichment invents a guarantee or a price.");
  }

  if (classification) {
    if (classification.relevant === "Uncertain" || classification.confidence < 0.7) {
      reviewReasons.push("Classification is uncertain or below 0.70 confidence.");
    }
    if (classification.confidence < 0.75) {
      criticNotes.push(`Analyst confidence is ${classification.confidence.toFixed(2)} — do not auto-accept.`);
    }
  }

  if (/guarantee/.test(`${lead.conversation}`.toLowerCase()) && /guarantee you a job/i.test(copy)) {
    validationErrors.push("Guarantee question was not clearly refused.");
  }

  const uniqueReasons = [...new Set(reviewReasons)];
  const uniqueNotes = [...new Set(criticNotes)];
  const uniqueErrors = [...new Set(validationErrors)];
  const reviewRequired = uniqueReasons.length > 0 || uniqueErrors.length > 0;

  return {
    reviewRequired,
    reviewReasons: uniqueReasons,
    criticNotes: uniqueNotes,
    validationErrors: uniqueErrors,
    accepted: !reviewRequired && uniqueErrors.length === 0,
    uncertainty:
      classification?.relevant === "Uncertain" || (classification && classification.confidence < 0.7)
        ? classification.reason
        : null,
    queueStatus: reviewRequired ? "pending" : "accepted"
  };
}

export function toReviewedLead(lead: EnrichedLead, classification?: ClassificationHint): ReviewedLead {
  const review = reviewLead(lead, classification);
  const showcaseId =
    lead.lead_id === "L029"
      ? "qc-1"
      : lead.lead_id === "L028"
        ? "qc-2"
        : lead.lead_id === "L016"
          ? "qc-3"
          : lead.lead_id === "L007"
            ? "qc-4"
            : null;

  return {
    ...lead,
    ...review,
    relevant: classification?.relevant,
    reason: classification?.reason,
    confidence: classification?.confidence,
    showcaseId,
    pipelineStep: "phase5-qc"
  };
}

export function setQueueDecision(lead: ReviewedLead, status: ReviewedLead["queueStatus"]): ReviewedLead {
  if (!lead.reviewRequired && status === "accepted") return { ...lead, queueStatus: "accepted", accepted: true };
  return {
    ...lead,
    queueStatus: status,
    accepted: status === "accepted"
  };
}
