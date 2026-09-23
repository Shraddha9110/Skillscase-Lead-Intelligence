import type { PrioritizedLead } from "../phase-6-prioritize/types";
import { criticOutreach, firstName, wordCount } from "./critic";
import { MAX_WORDS, MIN_WORDS, type OutreachDraft } from "./types";

export function isOutreachEligible(lead: PrioritizedLead): boolean {
  return lead.relevant === "Relevant" && !lead.isDuplicate && !lead.dialSuppressed;
}

function compact(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

function facts(lead: PrioritizedLead) {
  const you = firstName(lead.displayName);
  const city = lead.city || "your city";
  const edu = lead.education || "your qualification";
  const german = lead.german_level || "";
  const atGerman = german ? ` at ${german}` : "";
  const years = lead.experience || "";
  return { you, city, edu, german, atGerman, years };
}

function passesQc(text: string, lead: PrioritizedLead): boolean {
  if (criticOutreach(text, lead).length) return false;
  const words = wordCount(text);
  if (words < MIN_WORDS || words > MAX_WORDS) return false;
  if (lead.city && !text.includes(lead.city)) return false;
  if (lead.education && !text.includes(lead.education)) return false;
  if (lead.german_level && !text.includes(lead.german_level)) return false;
  return true;
}

function draftVariants(lead: PrioritizedLead): string[] {
  const s = lead.signals;
  const { you, city, edu, german, atGerman, years } = facts(lead);
  const whatsapp = s.missingEmail
    ? "Reply on WhatsApp with a time that works, and I will take your email before sending papers."
    : "";

  const byId: Record<string, string[]> = {
    L013: [
      `Hi ${you} — you said you are ready and want a call tomorrow. I can do that for a ${edu} profile from ${city}${atGerman}. You asked what documents are required; I will walk that on the call from your details, without inventing a list here. The call is about start dates, not a generic pitch. What 20-minute slot works tomorrow?`,
      `Hi ${you} — a ${edu} nurse in ${city}${atGerman} asked for a tomorrow call and which documents are required. I will cover that live from what you already shared. Which slot tomorrow works?`
    ],
    L009: [
      `Hi ${you} — you have ${german} and ICU experience as a ${edu} professional in ${city}. That is a placement conversation, not a beginner class. Skillcase markets employer matching and interview support for healthcare roles in Germany. I will not restart you at A1. Are you free for 15 minutes this week?`,
      `Hi ${you} — your ${edu} ICU background in ${city} at ${german} is a placement conversation, not a beginner class. Skillcase markets job search and interview support. Shall we book 15 minutes this week?`
    ],
    L029: [
      `Hi ${you} — you already hold ${german} and asked about openings and interviews. That is a placement talk for a ${edu} professional in ${city}, not a beginner course. I will stay on WhatsApp until I have an email, then send papers. Reply on WhatsApp with a time that works?`,
      `Hi ${you} — a ${edu} nurse in ${city} with ${german} asked about jobs. I can brief how Skillcase works with German healthcare employers. I will keep this on WhatsApp for now. What time today or tomorrow is easy?`
    ],
    L004: [
      `Hi ${you} — you already hold ${german} and asked about nursing jobs and the interview process. That is a placement conversation for a ${edu} professional in ${city}, not a language restart. Skillcase markets job search, employer matching, and interview support. Are you open to a 15-minute call this week?`,
      `Hi ${you} — ${german} is done, so a ${edu} nurse in ${city} should talk interviews and openings, not A1. Skillcase markets employer matching and interview support. What 15-minute slot works this week?`
    ],
    L019: [
      `Hi ${you} — you are B2 certified and asked for interview preparation plus current openings. I can do that for a ${edu} professional in ${city} at ${german}: typical loops, documents, and how we brief employers. This is not a beginner-course pitch. Can I call you for 15 minutes this week?`,
      `Hi ${you} — interview prep and openings are the right ask for a ${edu} nurse in ${city} at ${german}. I can walk a real interview loop and what to send beforehand on a short call. Are you free this week?`
    ],
    L024: [
      `Hi ${you} — you asked whether Skillcase can help identify suitable employers. Skillcase markets employer matching for healthcare roles in Germany. You are an experienced ${edu} nurse in ${city} at ${german}. I will not name a hospital I cannot stand behind. Are you open to a 15-minute call this week?`,
      `Hi ${you} — an experienced ${edu} profile in ${city} at ${german} asked about identifying employers. Skillcase markets employer matching. I will not promise a named house. Shall we book 15 minutes?`
    ],
    L001: [
      `Hi ${you} — you asked whether a ${edu} from ${city} is eligible and what the whole path costs. You have ${german} but have not sat the exam yet. Next is a dated exam plan, then a fee talk I can stand behind. I will not quote a number here. Are you open to a 15-minute call this week?`,
      `Hi ${you} — eligibility and cost for a ${edu} nurse in ${city} at ${german} are both fair. Exam first, then fees I can actually defend. No figure in this note. Can we talk for 15 minutes this week?`
    ],
    L002: [
      `Hi ${you} — you asked whether GNM nurses can apply, and said German feels slow at ${german}. I will confirm eligibility with you first; recognition is employer- and state-dependent. Skillcase teaches healthcare-focused German with live classes. You are a ${edu} professional in ${city}. Are you open to a 15-minute call this week?`,
      `Hi ${you} — a ${edu} nurse in ${city} at ${german} asked if GNM can apply, and said German feels hard. I will confirm eligibility with you before any apply talk. Skillcase teaches live healthcare German. Can I call you for 15 minutes this week?`
    ],
    L014: [
      `Hi ${you} — ${german} is already done, so GNM recognition is the open question, not language. I will confirm eligibility with you before we go further. You are a ${edu} professional in ${city}. Signup lists GNM among nursing qualifications, subject to recognition. Are you open to 15 minutes this week?`,
      `Hi ${you} — a ${edu} nurse in ${city} at ${german} asked whether GNM is accepted. I will confirm eligibility with you on a call and tell you honestly if we should proceed. Shall we book 15 minutes?`
    ],
    L007: [
      `Hi ${you} — you asked about Germany jobs as a ${edu} professional in ${city} at ${german}. I do not have years of practice, and I will not invent them. I will confirm eligibility after I have that. Reply with how long you have been working and your current ward. Can you send that this week?`,
      `Hi ${you} — a ${edu} nurse in ${city} at ${german} asked about jobs, but experience is still blank. I will confirm eligibility once I have years and workplace. What should I write down?`
    ],
    L006: [
      `Hi ${you} — you are interested in Germany and asked whether fees can be split. That is a fair question I would rather answer on a call. You are a ${edu} in ${city}${atGerman}, so we can confirm the nurse track before talking money. Are you open to a 15-minute call this week?`,
      `Hi ${you} — installments came up for a ${edu} nurse in ${city}${atGerman}. I can walk what can be split and what cannot, on a short call, with no figure in this note. What slot works this week?`
    ],
    L015: [
      `Hi ${you} — thank you for being direct about budget. I will not push a ${edu} professional in ${city}${atGerman} to enrol this month. When you are ready, the Germany nurse path is still open. I can send a one-page note and check in after 30 days. Shall I check in after 30 days?`,
      `Hi ${you} — a ${edu} nurse in ${city}${atGerman} said this month is not possible. I will keep this warm, not close hard. Want a short note now and a check-in after 30 days?`
    ],
    L011: [
      `Hi ${you} — you asked whether six months of experience is enough. I will confirm eligibility with you; it is not a single Skillcase rule I can invent. You already have ${german}, which helps a ${edu} profile from ${city}. I will stay with that question on the call. Are you open to a 15-minute call this week?`,
      `Hi ${you} — six months as a ${edu} nurse in ${city}${atGerman} is a question I will confirm eligibility on, not guess. You asked whether requirements vary by employer, and I will walk that honestly. Can we talk for 15 minutes this week?`
    ],
    L017: [
      `Hi ${you} — I will not ask you to drop a course you already pay for. You want extra B2 practice and exam prep on top of ${german} as a ${edu} professional in ${city}. Skillcase teaches healthcare-focused German with TELC and Goethe exam prep. If that is the missing piece, I can show only that. Are you open to a 15-minute call this week?`,
      `Hi ${you} — a ${edu} nurse in ${city}${atGerman} already has another German course and wants B2 exam prep. Skillcase offers TELC and Goethe exam prep. Shall we book 15 minutes?`
    ],
    L030: [
      `Hi ${you} — Skillcase does not guarantee a job in Germany. What is listed is healthcare German, exam prep, documentation help, interview support, and employer matching. You are a ${edu} professional in ${city} at ${german}, so there is a path to discuss — just not a promise I cannot keep. If you still want that honest breakdown, can I call you this week?`,
      `Hi ${you} — a ${edu} nurse in ${city} at ${german} asked what Skillcase actually provides. Healthcare German, exam prep, papers, interview support, employer matching. Skillcase does not guarantee a job. Want a 15-minute honest walkthrough this week?`
    ],
    L022: [
      `Hi ${you} — you asked for the full path from German class to a job, and you want a call. I can walk that in one sitting for a ${edu} profile from ${city}: current level (${german}), the exam, documents, interviews, then visa timing. No brochure dump. What 20-minute slot works today or tomorrow?`,
      `Hi ${you} — a ${edu} nurse in ${city}${atGerman} asked for the class-to-job sequence and a call. I can map exam, papers, interviews, visa in 20 minutes. What slot works today or tomorrow?`
    ],
    L026: [
      `Hi ${you} — wanting Germany and feeling nervous about German can sit together. You are a ${edu} professional in ${city} at ${german}${years ? ` with ${years}` : ""}. Skillcase teaches healthcare-focused German in live classes from A1 to B2. I can show how that path is structured. Are you open to a 15-minute call this week?`,
      `Hi ${you} — a ${edu} nurse in ${city}${atGerman} asked for a structured path because German feels scary. Skillcase teaches live healthcare German from A1 to B2. Can we talk for 15 minutes this week?`
    ],
    L003: [
      `Hi ${you} — you are still exploring, and that is fine. You already have ${edu} in ${city} and ${german}, which is enough to make a Germany conversation useful. I can do a short “is this even for me?” call: eligibility, language time, and what Skillcase does versus does not do. Are you open to a 15-minute call this week?`,
      `Hi ${you} — a ${edu} nurse in ${city}${atGerman} is just checking options, no timeline. I can do a no-pressure fit call. Shall we book 15 minutes this week?`
    ],
    L010: [
      `Hi ${you} — you want to start German and asked how long B1 takes. For a ${edu} professional in ${city} at ${german}, I can give a realistic language window, then what happens after the exam, without a slides dump. No pressure to enrol on that call. Are you open to a 15-minute call this week?`,
      `Hi ${you} — a ${edu} nurse in ${city}${atGerman} asked how long B1 takes before Germany work. I can map a realistic window and the step after the exam. Can I call you for 15 minutes this week?`
    ],
    L018: [
      `Hi ${you} — you asked whether to finish B1 before applying. Short version: many employers start conversations around B1 and expect B2 for clinical work. I can map that onto your ${edu} profile in ${city} at ${german} — language, interviews, then papers. Are you open to a 15-minute call this week?`,
      `Hi ${you} — a ${edu} nurse in ${city}${atGerman} asked if B1 should be finished first. I can walk when conversations start versus when wards expect B2. What 15-minute slot works this week?`
    ],
    L027: [
      `Hi ${you} — you asked whether you can apply before completing B2, and what a realistic timeline is. I can map language, interviews, then visa timing onto a ${edu} profile in ${city} at ${german}, without promising dates I cannot keep. Are you open to a 15-minute call this week?`,
      `Hi ${you} — a ${edu} nurse in ${city}${atGerman} asked about applying before B2. I can give a honest sequence, not a fantasy calendar. Shall we book 15 minutes?`
    ],
    L023: [
      `Hi ${you} — you are a ${edu} professional in ${city} interested in Germany, but I do not yet have your German level, so I will not guess a course. Reply with A1, A2, B1, B2, or not started, and I will send only the matching next step. What is your current level?`,
      `Hi ${you} — a ${edu} nurse in ${city} asked about Germany without a German level. Tell me A1, A2, B1, B2, or not started, and I will send one matching step. Which is it?`
    ]
  };

  if (byId[lead.lead_id]) return byId[lead.lead_id];

  const worry = s.jobGuarantee
    ? "Skillcase does not guarantee a job; I will only walk services we actually offer."
    : s.cannotAfford
      ? "I will not push you to enrol this month."
      : s.installments
        ? "You asked about splitting fees, and I would rather answer that on a call."
        : s.gnmQuestion
          ? "I will confirm eligibility with you first."
          : s.missingGerman
            ? "I will not guess your German level."
            : s.missingExperience
              ? "I will not invent years of practice."
              : s.jobsInterview
                ? "You asked about jobs and interviews, so I will stay there."
                : "I will stay with the next step you actually asked for.";

  const close = s.missingEmail
    ? whatsapp
    : s.missingGerman
      ? "What is your current German level?"
      : "Are you open to a 15-minute call this week?";

  return [
    `Hi ${you} — I read your note about ${lead.goal || "Germany"} as a ${edu} professional in ${city}${atGerman}. ${worry} I can help with a specific next step rather than a generic brochure. ${close}`,
    `Hi ${you} — a ${edu} profile in ${city}${atGerman} is enough to have a useful Germany conversation. ${worry} ${close}`
  ];
}

export function choosePassingOutreach(lead: PrioritizedLead, variants: string[]): string {
  for (const variant of variants.map(compact)) {
    if (passesQc(variant, lead)) return variant;
  }
  return "";
}

export function writeOutreach(lead: PrioritizedLead): string {
  if (!isOutreachEligible(lead)) return "";
  return choosePassingOutreach(lead, draftVariants(lead));
}

export function toOutreachDraft(lead: PrioritizedLead): OutreachDraft {
  const outreach = writeOutreach(lead);
  return {
    outreach,
    outreachEligible: isOutreachEligible(lead),
    wordCount: wordCount(outreach),
    criticFlags: criticOutreach(outreach, lead)
  };
}

export function toOutreachedLead(lead: PrioritizedLead) {
  return {
    ...lead,
    ...toOutreachDraft(lead),
    pipelineStep: "phase7-outreach" as const
  };
}

export function assertOutreachShape(lead: PrioritizedLead, outreach: string): string[] {
  const errors: string[] = [];
  if (!isOutreachEligible(lead)) {
    if (outreach) errors.push(`${lead.lead_id} must have empty outreach.`);
    return errors;
  }
  const words = wordCount(outreach);
  if (words < MIN_WORDS || words > MAX_WORDS) {
    errors.push(`${lead.lead_id} outreach is ${words} words; need ${MIN_WORDS}–${MAX_WORDS}.`);
  }
  if (lead.city && !outreach.includes(lead.city)) errors.push(`${lead.lead_id} draft is missing city ${lead.city}.`);
  if (lead.education && !outreach.includes(lead.education)) {
    errors.push(`${lead.lead_id} draft is missing qualification ${lead.education}.`);
  }
  if (lead.german_level && !outreach.includes(lead.german_level)) {
    errors.push(`${lead.lead_id} draft is missing German level ${lead.german_level}.`);
  }
  errors.push(...criticOutreach(outreach, lead).map((flag) => `${lead.lead_id}: ${flag}`));
  return errors;
}
