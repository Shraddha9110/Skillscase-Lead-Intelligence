import type { CleanLead } from "../phase-2-clean/types";
import { extractSignals } from "./signals";
import { formatSource, type SourceKey } from "./sources";
import type { Enrichment, EnrichedLead, Signals } from "./types";

const BANNED = /guarantee you a job|guaranteed job|₹\d|rs\.?\s*\d/i;

export function enrichLead(lead: CleanLead): Enrichment {
  const s = extractSignals(lead);
  const sources: string[] = [];
  const add = (key: SourceKey) => {
    const line = formatSource(key);
    if (!sources.includes(line)) sources.push(line);
  };

  const germanBit = lead.german_level
    ? `${lead.german_level}${s.examNotTaken ? " (self-reported, exam not yet taken)" : s.hasCertificate ? " certified" : ""}`
    : "German level unknown";
  const expBit = lead.experience || "experience not captured";

  const profile = [
    `${lead.displayName} is a ${lead.education || "unknown-qualification"} professional in ${lead.city || "an unknown city"} with ${expBit}.`,
    `Current language standing: ${germanBit}. Traffic source: ${lead.source || "unknown"}. Last touch ${lead.last_contacted || "unknown"}.`,
    s.icu ? "Conversation mentions ICU experience, which is useful for ward-matching." : ""
  ]
    .filter(Boolean)
    .join(" ");

  const intent = buildIntent(s);
  const needs = buildNeeds(lead, s, add);
  const objections = buildObjections(s, lead);
  const missingInformation = buildMissing(s);
  const { opportunity, nextAction } = buildOpportunity(lead, s, add);

  if (s.hasCertificate) add("b2Required");

  const enrichment: Enrichment = {
    profile,
    intent,
    needs,
    objections,
    missingInformation,
    opportunity,
    nextAction,
    sources
  };

  assertNoInventions(enrichment);
  return enrichment;
}

function buildIntent(s: Signals): string {
  if (s.readyNow) return "Ready to start immediately and has asked for a near-term call.";
  if (s.hasCertificate && s.jobsInterview) {
    return "Job-ready: wants vacancies, employers or interview prep, not a beginner language pitch.";
  }
  if (s.otherCourse) return "Already studying German elsewhere; wants B2 exam practice rather than a full beginner course.";
  if (s.exploring) return "Early-stage exploration — curious about Germany, no committed timeline.";
  if (s.wantsCanada) return "Intends to move to Canada, not Germany.";
  if (s.wantsUk) return "Intends to move to the UK, not Germany.";
  if (s.nonHealthcare) return "Wants to work abroad, but not as a healthcare professional Skillcase places.";
  if (s.process || s.jobGuarantee) return "Wants to understand what Skillcase actually does before committing.";
  if (s.wantsGermany) return "Wants a Germany work pathway and is looking for a realistic next step.";
  return "Intent is not fully stated.";
}

function buildNeeds(lead: CleanLead, s: Signals, add: (key: SourceKey) => void): string {
  const needs: string[] = [];
  if (s.examNotTaken) needs.push("Official B1 exam booking and a short prep plan so employers can see a certificate.");
  if (s.gnmQuestion) {
    needs.push("A clear GNM recognition check before they invest more time.");
    add("gnm");
    add("qualifications");
  }
  if (s.installments || s.costWorry) {
    needs.push("A transparent fee conversation, including whether language fees can be split.");
  }
  if (s.jobsInterview && s.hasCertificate) {
    needs.push("Current nurse vacancies, employer shortlist and interview practice.");
    add("placements");
  }
  if (s.documents) needs.push("A document checklist for profile + visa stage.");
  if (s.timeline) {
    needs.push("A realistic language → interview → visa timeline.");
    add("timeline");
  }
  if (s.otherCourse) {
    needs.push("B2-focused exam drills rather than restarting A1.");
    add("language");
  }
  if (s.nervous || s.germanHard) {
    needs.push("A structured A2/B1 path and reassurance that healthcare German is taught in small steps.");
    add("language");
  }
  if (s.eligibility && lead.experienceYears !== null && lead.experienceYears < 1) {
    needs.push("Honest guidance on how 6-month experience is treated by different German employers.");
  }
  if (s.missingGerman) needs.push("Capture current German level before pitching a course.");
  if (s.missingExperience) needs.push("Capture years of clinical experience and exam status.");
  if (s.jobGuarantee) needs.push("A plain-language explanation of services vs outcomes. No guarantee language.");
  if (s.healthcare && !s.nursing) {
    needs.push("Confirm whether a pharmacist/allied track is open this quarter.");
    add("notOnlyNurses");
    add("qualifications");
  }
  if (!needs.length && s.nursing) {
    needs.push("Map the next language or placement step and book a counsellor call.");
    add("language");
  }
  return needs.join(" ") || "Qualify the next conversation.";
}

function buildObjections(s: Signals, lead: CleanLead): string {
  const objections: string[] = [];
  if (s.cannotAfford) objections.push("Hard price block — cannot pay now, maybe later. Treat as nurture, not a push close.");
  else if (s.installments) objections.push("Price sensitivity with a workable angle: asked about installments.");
  else if (s.costWorry) objections.push("Cost / total-fee uncertainty.");
  if (s.germanHard || s.nervous) objections.push("Confidence: worried German will be too hard.");
  if (lead.lead_id === "L011" || (s.eligibility && lead.experienceYears !== null && lead.experienceYears < 1 && !s.gnmQuestion)) {
    objections.push("experience requirement question");
  } else if (s.eligibility || s.gnmQuestion) {
    objections.push("Eligibility / qualification recognition worry.");
  }
  if (s.jobGuarantee) objections.push("Expectation risk: asked if Skillcase guarantees a German job.");
  if (s.otherCourse) objections.push("Already paying another German course — switching cost.");
  return objections.join(" ") || "No hard objection on file.";
}

function buildMissing(s: Signals): string {
  const missing: string[] = [];
  if (s.missingEmail) missing.push("Valid email address. The email cell is empty.");
  if (s.missingGerman) missing.push("Current German level and whether any exam is booked.");
  if (s.missingExperience) missing.push("Years of nursing experience and current workplace.");
  if (s.examNotTaken) missing.push("Which board they want (Goethe/TELC) and target exam month.");
  if (s.costWorry) missing.push("Budget range and whether a parent/spouse is co-paying.");
  if (s.gnmQuestion) missing.push("State nursing council registration and year of GNM completion.");
  if (s.asksCall || s.readyNow) missing.push("Preferred call slot and WhatsApp vs phone.");
  if (s.healthcare && !s.nursing) {
    missing.push("Whether they want language-only, or a pharmacist placement conversation.");
  }
  return missing.join(" ") || "Preferred call time and whether they already hold a passport.";
}

function buildOpportunity(lead: CleanLead, s: Signals, add: (key: SourceKey) => void) {
  let opportunity = "Qualify and either convert or close-lost cleanly.";
  let nextAction = "Log a normal follow-up.";

  if (lead.isDuplicate) {
    opportunity = "Do not re-open a second conversation. Merge into the canonical lead.";
    nextAction = `Merge into ${lead.duplicateOf} and suppress this ID from dialer.`;
    return { opportunity, nextAction };
  }
  if (s.nonHealthcare) {
    opportunity = "Politely decline the non-healthcare ask. Do not sell a nursing placement fantasy.";
    nextAction = "Send a short not-a-fit note. Offer to reopen only if their goal changes.";
    return { opportunity, nextAction };
  }
  if (s.wantsCanada || s.wantsUk) {
    opportunity = "Close as wrong market unless a Germany alternative is explicitly welcome.";
    nextAction = "Send a short not-a-fit note. Offer to reopen only if their goal changes.";
    return { opportunity, nextAction };
  }
  if (s.hasCertificate && s.nursing) {
    opportunity = "Placement-led conversation: employer match, interview prep, documentation. Language is already largely done.";
    nextAction = "Call with a vacancy/interview briefing. Do not lead with A1 course sales.";
    add("placements");
    add("b2Required");
  } else if (s.readyNow) {
    opportunity = "Same-day or next-day counselling slot. They asked for documents — send a checklist after the call.";
    nextAction = "Call within 24 hours. Confirm documents and a start date.";
    add("placements");
  } else if (s.otherCourse) {
    opportunity = "Sell the gap: healthcare-vocab B2 + exam mocks, not a duplicate beginner course.";
    nextAction = "Personalised WhatsApp today, then a counsellor call this week.";
    add("language");
  } else if (s.cannotAfford) {
    opportunity = "Long nurture. Offer a later review date rather than discounting on the first reply.";
    nextAction = "Send a light keep-warm note and a 30-day check-in. Do not hard-sell.";
  } else if (s.nursing) {
    opportunity = "Language-plus-pathway sale: show A1–B2 structure and the job step that comes after B1/B2.";
    nextAction = s.jobGuarantee
      ? "Reset expectations on the call: services offered vs outcomes we cannot promise."
      : s.missingGerman || s.missingExperience
        ? "Collect the missing field before a long pitch."
        : s.exploring
          ? "Offer a 15-minute pathway call, no pressure to enrol."
          : s.asksCall
            ? "Call within 24 hours. Confirm documents and a start date."
            : "Personalised WhatsApp today, then a counsellor call this week.";
    add("language");
    add("demand");
  } else if (s.healthcare) {
    opportunity = "Possible allied-health conversation. Confirm capacity before promising a track.";
    nextAction = "Human review: decide if pharmacist/allied track is open, then reply.";
    add("notOnlyNurses");
  }

  if (s.missingEmail && s.nursing) {
    nextAction = "WhatsApp first (phone exists). Collect email before sending documents.";
  }
  if (s.jobGuarantee && s.nursing && !s.hasCertificate) {
    nextAction = "Reset expectations on the call: services offered vs outcomes we cannot promise.";
  }

  return { opportunity, nextAction };
}

export function assertNoInventions(enrichment: Enrichment): void {
  const blob = [
    enrichment.profile,
    enrichment.intent,
    enrichment.needs,
    enrichment.objections,
    enrichment.opportunity,
    enrichment.nextAction
  ].join(" ");
  if (BANNED.test(blob)) {
    throw new Error("Phase 4 invented a fee, employer, or job guarantee.");
  }
}

export const NOT_A_FIT_NOTE =
  "Send a short not-a-fit note. Offer to reopen only if their goal changes.";

export function blankEnrichment(nextAction = ""): Enrichment {
  return {
    profile: "",
    intent: "",
    needs: "",
    objections: "",
    missingInformation: "",
    opportunity: "",
    nextAction,
    sources: []
  };
}

export function toEnrichedLead(lead: CleanLead): EnrichedLead {
  if (lead.isDuplicate) {
    return {
      ...lead,
      ...blankEnrichment(`Merge into ${lead.duplicateOf} and suppress this ID from the dialer.`),
      signals: extractSignals(lead),
      pipelineStep: "phase4-enrich"
    };
  }
  const enrichment = enrichLead(lead);
  const signals = extractSignals(lead);
  if (signals.nonHealthcare || signals.wantsCanada || signals.wantsUk) {
    enrichment.needs = "";
    enrichment.nextAction = NOT_A_FIT_NOTE;
    enrichment.opportunity = "Do not sell. This lead is not a Skillcase fit.";
  }
  return {
    ...lead,
    ...enrichment,
    signals,
    pipelineStep: "phase4-enrich"
  };
}
