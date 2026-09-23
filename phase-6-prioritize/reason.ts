import type { Relevance } from "../phase-3-classify/types";
import type { ReviewedLead } from "../phase-5-qc/types";

const GENERIC_REASON =
  /nursing profile with a germany|outside healthcare or a non-germany|allied health or a critical field|gemini did not supply/i;

const STOP = new Set(
  "the and for with about that this from have has said wants asked work germany german interested just what they she he you her his not but may can will".split(
    " "
  )
);

function clipConversation(text: string): string {
  const clause = text.replace(/\s+/g, " ").trim().split(/[.!?]/)[0] || "";
  return clause.split(/\s+/).filter(Boolean).slice(0, 14).join(" ");
}

export function leadDetails(lead: ReviewedLead): string[] {
  const details = [
    lead.city,
    lead.education,
    lead.german_level,
    lead.experience,
    lead.displayName?.split(/\s+/)[0],
    lead.goal
  ]
    .map((value) => String(value || "").trim())
    .filter((value) => value.length >= 2);
  const conversation = clipConversation(lead.conversation || "");
  if (conversation) details.push(conversation);
  for (const token of conversation.toLowerCase().split(/[^a-z0-9+]+/)) {
    if (token.length >= 4 && !STOP.has(token)) details.push(token);
  }
  return [...new Set(details)];
}

export function reasonCitesLead(reason: string, lead: ReviewedLead): boolean {
  const hay = reason.toLowerCase();
  const city = lead.city?.toLowerCase();
  const education = lead.education?.toLowerCase();
  const german = lead.german_level?.toLowerCase();
  const experience = lead.experience?.toLowerCase();
  const first = lead.displayName?.split(/\s+/)[0]?.toLowerCase();
  if (city && hay.includes(city)) return true;
  if (education && education.length >= 3 && hay.includes(education)) return true;
  if (german && hay.includes(german)) return true;
  if (experience && experience.length >= 3 && hay.includes(experience)) return true;
  if (first && first.length >= 3 && hay.includes(first)) return true;
  const hook = clipConversation(lead.conversation || "").toLowerCase();
  if (hook.length >= 12 && hay.includes(hook.slice(0, 24))) return true;
  return leadDetails(lead).some((detail) => detail.length >= 5 && hay.includes(detail.toLowerCase()));
}

export function buildLeadReason(lead: ReviewedLead, relevant: Relevance | string): string {
  const name = lead.displayName?.split(/\s+/)[0] || lead.lead_id;
  const city = lead.city || "an unlisted city";
  const edu = lead.education || "an unlisted qualification";
  const german = lead.german_level ? ` at ${lead.german_level}` : "";
  const hook = clipConversation(lead.conversation || "") || lead.goal || "their stated goal";
  const s = lead.signals;

  if (relevant === "Not Relevant") {
    if (s.wantsCanada) return `${name} in ${city} (${edu}) asked for Canada, not a Germany pathway.`;
    if (s.wantsUk) return `${name} in ${city} (${edu}) asked for the UK, not a Germany pathway.`;
    if (s.nonHealthcare) {
      return `${name} is a ${edu} professional in ${city}; conversation: “${hook}”. Not a healthcare candidate.`;
    }
    return `${name} in ${city} (${edu}) is outside the nurse/Germany ICP. Conversation: “${hook}”.`;
  }

  if (relevant === "Uncertain") {
    const missing = lead.missingFields[0] ? ` Missing ${lead.missingFields[0]}.` : "";
    return `${name} is a ${edu} professional in ${city}${german}. Conversation: “${hook}”. Allied or incomplete — needs a human.${missing}`;
  }

  if (s.readyNow) return `${name} (${edu}, ${city}${german}) said they are ready and asked for a call tomorrow.`;
  if (s.icu) return `${name} (${edu}, ${city}${german}) mentioned ICU experience and asked about vacancies.`;
  if (s.hasCertificate && s.jobsInterview) {
    return `${name} in ${city} already holds ${lead.german_level || "a certificate"} as a ${edu} and asked about jobs or interviews.`;
  }
  if (s.gnmQuestion) return `${name} is a ${edu} professional in ${city}${german} who asked whether GNM is accepted.`;
  if (s.cannotAfford) return `${name} (${edu}, ${city}${german}) said they cannot afford the course right now.`;
  if (s.installments) return `${name} (${edu}, ${city}${german}) asked whether fees can be paid in installments.`;
  if (s.jobGuarantee) return `${name} (${edu}, ${city}${german}) asked whether Skillcase guarantees a German job.`;
  if (s.missingEmail) return `${name} (${edu}, ${city}${german}) asked about jobs and still has no email.`;
  if (s.missingExperience) return `${name} (${edu}, ${city}${german}) asked about Germany jobs and experience is blank.`;
  if (s.missingGerman) return `${name} (${edu}, ${city}) is interested in Germany but has not shared a German level.`;
  if (s.otherCourse) return `${name} (${edu}, ${city}${german}) is already on another German course and wants B2 prep.`;
  if (s.nervous || s.germanHard) {
    return `${name} (${edu}, ${city}${german}) said German feels hard or they feel nervous. Conversation: “${hook}”.`;
  }
  if (s.exploring) return `${name} (${edu}, ${city}${german}) is still exploring: “${hook}”.`;
  if (s.timeline) return `${name} (${edu}, ${city}${german}) asked about timeline: “${hook}”.`;
  return `${name} is a ${edu} professional in ${city}${german}. Conversation: “${hook}”.`;
}

export function finalizeReason(lead: ReviewedLead, relevant: Relevance | string, incoming?: string): string {
  if (lead.isDuplicate) return `Duplicate of ${lead.duplicateOf}. Same phone or email as the earlier row.`;
  const supplied = incoming && !GENERIC_REASON.test(incoming) ? incoming.trim() : "";
  if (supplied && reasonCitesLead(supplied, lead)) return supplied;
  const built = buildLeadReason(lead, relevant);
  if (supplied) {
    const merged = `${supplied} ${built}`;
    return reasonCitesLead(merged, lead) ? merged : built;
  }
  return built;
}

export function isModelConfidence(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= 1;
}

export function judgmentConfidence(lead: ReviewedLead, relevant: Relevance | string): number {
  const s = lead.signals;
  let score = 0.5;
  if (relevant === "Not Relevant") {
    score = 0.64;
    if (s.nonHealthcare) score += 0.11;
    if (s.wantsCanada || s.wantsUk) score += 0.13;
    if (lead.education) score += 0.03;
    if ((lead.conversation || "").length > 50) score += 0.02;
  } else if (relevant === "Uncertain") {
    score = 0.46;
    if (s.healthcare && !s.nursing) score += 0.07;
    score -= 0.04 * lead.missingFields.length;
  } else {
    score = 0.56;
    if (s.nursing) score += 0.08;
    if (s.wantsGermany) score += 0.06;
    if (lead.german_level) score += 0.05;
    if (lead.experience) score += 0.03;
    if (s.readyNow || s.asksCall) score += 0.04;
    if (s.hasCertificate) score += 0.03;
    if (s.jobGuarantee) score -= 0.03;
    score -= 0.05 * lead.missingFields.length;
  }
  const hookWords = clipConversation(lead.conversation || "").split(/\s+/).filter(Boolean).length;
  score += Math.min(0.05, hookWords * 0.004);
  if (lead.city) score += 0.015;
  return Math.round(Math.max(0.2, Math.min(0.97, score)) * 100) / 100;
}

export function finalizeConfidence(lead: ReviewedLead, relevant: Relevance | string): number {
  if (lead.isDuplicate) return 0;
  if (isModelConfidence(lead.confidence)) return Math.round(lead.confidence * 100) / 100;
  return judgmentConfidence(lead, relevant);
}
