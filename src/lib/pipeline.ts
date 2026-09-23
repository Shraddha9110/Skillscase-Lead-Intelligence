import {
  AS_OF_DATE,
  GERMAN_LEVELS,
  HEALTHCARE_DEGREES,
  INDIAN_CITIES,
  KNOWN_SOURCES,
  NON_HEALTHCARE,
  NURSING_DEGREES,
  PRIORITY_CRITERIA,
  PRODUCT_SOURCES,
  RELEVANCE_CRITERIA
} from "./product";
import { llmClassify, llmCritic, llmEnabled, llmEnrich, llmOutreach, type LlmConfig } from "./llm";
import type {
  Classification,
  CleanLead,
  Enrichment,
  PipelineResult,
  PriorityResult,
  ProcessedLead,
  QcExample,
  QualityReview,
  RawLead
} from "./types";

const TODAY = new Date(`${AS_OF_DATE}T00:00:00`);

const lower = (value: string) => (value || "").trim().toLowerCase();
const compact = (value: string) => lower(value).replace(/[^a-z0-9]+/g, " ").trim();

function titleName(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .map((part) =>
      part.length <= 2 && part.endsWith(".")
        ? part[0].toUpperCase() + "."
        : part[0].toUpperCase() + part.slice(1).toLowerCase()
    )
    .join(" ");
}

function looksLikeEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}
function looksLikeCity(value: string) {
  return INDIAN_CITIES.includes(lower(value));
}
function looksLikeSource(value: string) {
  return KNOWN_SOURCES.includes(lower(value));
}
function looksLikeDate(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value.trim());
}
function looksLikeGerman(value: string) {
  return GERMAN_LEVELS.includes(lower(value));
}
function looksLikeEducation(value: string) {
  const text = compact(value);
  return (
    HEALTHCARE_DEGREES.some((item) => text.includes(item)) ||
    NON_HEALTHCARE.some((item) => text.includes(item)) ||
    text.includes("nursing")
  );
}
function looksLikeExperience(value: string) {
  return /\d+\s*(year|years|yr|yrs|month|months)?/i.test(value) && !/germany|canada|uk|job/i.test(value);
}
function looksLikeGoal(value: string) {
  return /germany|canada|uk|abroad|job|work|move|explore|prepar/i.test(value) && !looksLikeGerman(value);
}

function shiftFrom<K extends keyof RawLead>(row: RawLead, start: K, emptyField: K) {
  const order: (keyof RawLead)[] = [
    "email",
    "city",
    "education",
    "experience",
    "goal",
    "german_level",
    "source",
    "last_contacted",
    "conversation",
    "notes"
  ];
  const startIndex = order.indexOf(start);
  const emptyIndex = order.indexOf(emptyField);
  const next = { ...row };
  for (let i = emptyIndex; i > startIndex; i -= 1) {
    next[order[i]] = next[order[i - 1]];
  }
  next[start] = "";
  return next;
}

function normalizeEducation(value: string) {
  const text = compact(value);
  if (text.includes("gnm")) return "GNM";
  if (text.includes("bpharm") || text.includes("b pharm")) return "BPharm";
  if (text.includes("engineer")) return "Engineering";
  if (text.includes("bba")) return "BBA";
  if (text.includes("nursing")) return "BSc Nursing";
  return value.trim();
}

function normalizeExperience(value: string): { label: string; years: number | null } {
  if (!value.trim()) return { label: "", years: null };
  const month = value.match(/(\d+(?:\.\d+)?)\s*month/i);
  if (month) return { label: `${month[1]} months`, years: Number(month[1]) / 12 };
  const year = value.match(/(\d+(?:\.\d+)?)/);
  if (year) {
    const years = Number(year[1]);
    return { label: `${years} year${years === 1 ? "" : "s"}`, years };
  }
  return { label: value.trim(), years: null };
}

function normalizeGoal(value: string) {
  const text = lower(value);
  if (text === "germany") return "Work in Germany";
  if (text === "canada") return "Work in Canada";
  if (text === "uk" || text === "work in uk") return "Work in UK";
  return value.trim();
}

function germanRank(value: string): number | null {
  const map: Record<string, number> = { a1: 1, a2: 2, b1: 3, b2: 4, c1: 5, c2: 6 };
  return map[lower(value)] ?? null;
}

function phoneDigits(value: string) {
  return value.replace(/\D/g, "");
}

export function cleanLead(raw: RawLead): CleanLead {
  const original = { ...raw };
  let row = { ...raw };
  const repairedFields: string[] = [];
  const invalidFields: string[] = [];
  const qualityFlags: string[] = [];

  if (row.email && !looksLikeEmail(row.email)) {
    invalidFields.push(`email="${row.email}"`);
    row.email = "";
  }
  if (row.german_level && !looksLikeGerman(row.german_level)) {
    invalidFields.push(`german_level="${row.german_level}"`);
    row.german_level = "";
  }

  if (row.german_level && !looksLikeGerman(row.german_level)) {
    invalidFields.push(`german_level="${row.german_level}"`);
  }
  if (row.email && !looksLikeEmail(row.email)) {
    invalidFields.push(`email="${row.email}"`);
  }
  if (row.source && !looksLikeSource(row.source) && !looksLikeDate(row.source)) {
    invalidFields.push(`source="${row.source}"`);
  }

  const education = normalizeEducation(row.education);
  const exp = normalizeExperience(row.experience);
  const goal = normalizeGoal(row.goal);
  const german = looksLikeGerman(row.german_level) ? row.german_level.toUpperCase() : row.german_level;
  const name = titleName(row.name);

  if (education !== row.education && row.education) repairedFields.push(`education "${row.education}" → ${education}`);
  if (exp.label !== row.experience && row.experience) repairedFields.push(`experience "${row.experience}" → ${exp.label}`);
  if (goal !== row.goal && row.goal) repairedFields.push(`goal "${row.goal}" → ${goal}`);
  if (name !== row.name) repairedFields.push(`name "${row.name}" → ${name}`);

  const missingFields = (
    [
      ["email", row.email],
      ["city", row.city],
      ["education", education],
      ["experience", exp.label],
      ["goal", goal],
      ["german_level", german],
      ["source", row.source],
      ["last_contacted", row.last_contacted],
      ["conversation", row.conversation]
    ] as const
  )
    .filter(([, value]) => !value)
    .map(([key]) => key);

  if (missingFields.length) qualityFlags.push(`missing:${missingFields.join("|")}`);
  if (invalidFields.length) qualityFlags.push("invalid_or_inconsistent_field");

  return {
    ...row,
    original,
    name,
    displayName: name,
    email: looksLikeEmail(row.email) ? row.email.toLowerCase() : "",
    education,
    experience: exp.label,
    goal,
    german_level: german,
    phoneDigits: phoneDigits(row.phone),
    emailNormalized: looksLikeEmail(row.email) ? row.email.toLowerCase() : "",
    experienceYears: exp.years,
    germanRank: germanRank(german),
    repairedFields,
    missingFields,
    invalidFields,
    qualityFlags,
    isDuplicate: false,
    duplicateOf: null,
    duplicateReason: null
  };
}

export function markDuplicates(leads: CleanLead[]): CleanLead[] {
  const byKey = new Map<string, CleanLead>();
  return leads.map((lead) => {
    const keys = [
      lead.phoneDigits ? `p:${lead.phoneDigits}` : "",
      lead.emailNormalized ? `e:${lead.emailNormalized}` : ""
    ].filter(Boolean);

    for (const key of keys) {
      const seen = byKey.get(key);
      if (seen && seen.lead_id !== lead.lead_id) {
        const nameClose =
          compact(seen.name) === compact(lead.name) ||
          compact(seen.name).startsWith(compact(lead.name).split(" ")[0]) ||
          compact(lead.name).startsWith(compact(seen.name).split(" ")[0]);
        return {
          ...lead,
          isDuplicate: true,
          duplicateOf: seen.lead_id,
          duplicateReason: nameClose
            ? `Same phone/email as ${seen.lead_id} (${seen.displayName})`
            : `Same contact details as ${seen.lead_id}, name differs`,
          qualityFlags: [...lead.qualityFlags, `duplicate_of_${seen.lead_id}`]
        };
      }
    }
    for (const key of keys) byKey.set(key, lead);
    return lead;
  });
}

interface Signals {
  wantsGermany: boolean;
  wantsCanada: boolean;
  wantsUk: boolean;
  nursing: boolean;
  healthcare: boolean;
  nonHealthcare: boolean;
  asksCall: boolean;
  readyNow: boolean;
  jobsInterview: boolean;
  costWorry: boolean;
  cannotAfford: boolean;
  installments: boolean;
  eligibility: boolean;
  gnmQuestion: boolean;
  germanHard: boolean;
  nervous: boolean;
  exploring: boolean;
  examNotTaken: boolean;
  hasCertificate: boolean;
  otherCourse: boolean;
  jobGuarantee: boolean;
  timeline: boolean;
  documents: boolean;
  icu: boolean;
  process: boolean;
  missingGerman: boolean;
  missingExperience: boolean;
  missingEmail: boolean;
}

function extractSignals(lead: CleanLead): Signals {
  const blob = `${lead.goal} ${lead.conversation} ${lead.notes}`.toLowerCase();
  const edu = compact(lead.education);
  return {
    wantsGermany: /germany/.test(blob) && !/not germany/.test(blob),
    wantsCanada: /canada/.test(blob),
    wantsUk: /\buk\b/.test(blob),
    nursing: NURSING_DEGREES.some((item) => edu.includes(item)),
    healthcare: HEALTHCARE_DEGREES.some((item) => edu.includes(item)),
    nonHealthcare: NON_HEALTHCARE.some((item) => edu.includes(item)),
    asksCall: /call/.test(blob),
    readyNow: /ready to start|tomorrow|very high intent/.test(blob),
    jobsInterview: /job|vacanc|opening|interview|employer/.test(blob),
    costWorry: /cost|price|afford|installment|fee/.test(blob),
    cannotAfford: /cannot afford|can't afford|join later/.test(blob),
    installments: /installment/.test(blob),
    eligibility: /eligib|can apply|accepted|requirements vary/.test(blob),
    gnmQuestion: /gnm/.test(blob) || lead.education === "GNM",
    germanHard: /german is difficult|more time|nervous about learning german/.test(blob),
    nervous: /nervous|confidence/.test(blob),
    exploring: /explore|just checking|no timeline|how long b1/.test(blob),
    examNotTaken: /hasn'?t taken the exam/.test(blob),
    hasCertificate: /already has b2|b2 certified|has b2/.test(blob),
    otherCourse: /another german course/.test(blob),
    jobGuarantee: /guarantee/.test(blob),
    timeline: /timeline|how long|before completing|finish b1/.test(blob),
    documents: /document/.test(blob),
    icu: /icu/.test(blob),
    process: /full process|what skillcase actually provides/.test(blob),
    missingGerman: lead.missingFields.includes("german_level"),
    missingExperience: lead.missingFields.includes("experience"),
    missingEmail: lead.missingFields.includes("email")
  };
}

export function classifyLead(lead: CleanLead): Classification {
  const s = extractSignals(lead);
  const criteria: string[] = [];

  if (s.nonHealthcare && !s.nursing) {
    criteria.push("Non-healthcare education");
    return {
      relevant: "Not Relevant",
      reason: `${lead.displayName} has a ${lead.education} background and is not a healthcare candidate Skillcase can place into German clinical roles.`,
      confidence: 0.93,
      criteria
    };
  }

  if ((s.wantsCanada && !s.wantsGermany) || (s.wantsUk && !s.wantsGermany) || /work in canada|work in uk/i.test(lead.goal)) {
    criteria.push("Destination is not Germany");
    return {
      relevant: "Not Relevant",
      reason: `Lead is asking only for ${s.wantsCanada || /canada/i.test(lead.goal) ? "Canada" : "the UK"}. Current Skillcase language + placement motion is Germany-first.`,
      confidence: 0.9,
      criteria
    };
  }

  if (s.nursing && (s.wantsGermany || /germany|explore|b2/i.test(lead.goal))) {
    criteria.push("Nursing qualification");
    criteria.push("Germany or open exploration");
    const gaps = [...lead.missingFields];
    return {
      relevant: "Relevant",
      reason: `${lead.education} professional in ${lead.city || "India"} targeting a Germany nursing pathway.`,
      confidence: gaps.length ? 0.78 : 0.91,
      criteria
    };
  }

  if (s.healthcare && s.wantsGermany) {
    criteria.push("Listed non-nurse healthcare profession");
    criteria.push("Germany intent");
    return {
      relevant: "Uncertain",
      reason: `${lead.education} is on Skillcase's healthcare signup list, but this is not the core nurse-placement track. CRM notes may disagree — needs a counsellor decision.`,
      confidence: 0.62,
      criteria
    };
  }

  return {
    relevant: "Uncertain",
    reason: "Could not firmly match Skillcase's nurse/Germany ICP from the repaired fields.",
    confidence: 0.48,
    criteria: ["Fallback"]
  };
}

function firstName(name: string) {
  return name.split(" ")[0];
}

export function enrichLead(lead: CleanLead): Enrichment {
  const s = extractSignals(lead);
  const sources: string[] = [];
  const add = (key: keyof typeof PRODUCT_SOURCES) => {
    const item = PRODUCT_SOURCES[key];
    const line = `${item.fact} — ${item.source}`;
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

  let intent = "Intent is not fully stated.";
  if (s.readyNow) intent = "Ready to start immediately and has asked for a near-term call.";
  else if (s.hasCertificate && s.jobsInterview) intent = "Job-ready: wants vacancies, employers or interview prep, not a beginner language pitch.";
  else if (s.otherCourse) intent = "Already studying German elsewhere; wants B2 exam practice rather than a full beginner course.";
  else if (s.exploring) intent = "Early-stage exploration — curious about Germany, no committed timeline.";
  else if (s.wantsCanada) intent = "Intends to move to Canada, not Germany.";
  else if (s.wantsUk) intent = "Intends to move to the UK, not Germany.";
  else if (s.nonHealthcare) intent = "Wants to work abroad, but not as a healthcare professional Skillcase places.";
  else if (s.process || s.jobGuarantee) intent = "Wants to understand what Skillcase actually does before committing.";
  else if (s.wantsGermany) intent = "Wants a Germany work pathway and is looking for a realistic next step.";

  const needs: string[] = [];
  if (s.examNotTaken) needs.push("Official B1 exam booking and a short prep plan so employers can see a certificate.");
  if (s.gnmQuestion) {
    needs.push("A clear GNM recognition check before they invest more time.");
    add("gnm");
    add("qualifications");
  }
  if (s.installments || s.costWorry) needs.push("A transparent fee conversation, including whether language fees can be split.");
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

  const objections: string[] = [];
  if (s.cannotAfford) objections.push("Hard price block — cannot pay now, maybe later. Treat as nurture, not a push close.");
  else if (s.installments) objections.push("Price sensitivity with a workable angle: asked about installments.");
  else if (s.costWorry) objections.push("Cost / total-fee uncertainty.");
  if (s.germanHard || s.nervous) objections.push("Confidence: worried German will be too hard.");
  if (s.eligibility || s.gnmQuestion) objections.push("Eligibility / qualification recognition worry.");
  if (s.jobGuarantee) objections.push("Expectation risk: asked if Skillcase guarantees a German job.");
  if (s.otherCourse) objections.push("Already paying another German course — switching cost.");
  if (!objections.length) objections.push("No hard objection on file.");

  const missing: string[] = [];
  if (s.missingEmail) missing.push("Valid email address. The email cell is empty.");
  if (s.missingGerman) missing.push("Current German level and whether any exam is booked.");
  if (s.missingExperience) missing.push("Years of nursing experience and current workplace.");
  if (s.examNotTaken) missing.push("Which board they want (Goethe/TELC) and target exam month.");
  if (s.costWorry) missing.push("Budget range and whether a parent/spouse is co-paying.");
  if (s.gnmQuestion) missing.push("State nursing council registration and year of GNM completion.");
  if (s.asksCall || s.readyNow) missing.push("Preferred call slot and WhatsApp vs phone.");
  if (s.healthcare && !s.nursing) missing.push("Whether they want language-only, or a pharmacist placement conversation.");
  if (!missing.length) missing.push("Preferred call time and whether they already hold a passport.");

  let opportunity = "Qualify and either convert or close-lost cleanly.";
  if (lead.isDuplicate) opportunity = "Do not re-open a second conversation. Merge into the canonical lead.";
  else if (s.nonHealthcare) opportunity = "Politely decline the non-healthcare ask. Do not sell a nursing placement fantasy.";
  else if (s.wantsCanada || s.wantsUk) opportunity = "Close as wrong market unless a Germany alternative is explicitly welcome.";
  else if (s.hasCertificate && s.nursing) {
    opportunity = "Placement-led conversation: employer match, interview prep, documentation. Language is already largely done.";
    add("placements");
    add("b2Required");
  } else if (s.readyNow) {
    opportunity = "Same-day or next-day counselling slot. They asked for documents — send a checklist after the call.";
    add("placements");
  } else if (s.otherCourse) {
    opportunity = "Sell the gap: healthcare-vocab B2 + exam mocks, not a duplicate beginner course.";
    add("language");
  } else if (s.cannotAfford) {
    opportunity = "Long nurture. Offer a later review date rather than discounting on the first reply.";
  } else if (s.nursing) {
    opportunity = "Language-plus-pathway sale: show A1–B2 structure and the job step that comes after B1/B2.";
    add("language");
    add("demand");
  } else if (s.healthcare) {
    opportunity = "Possible allied-health conversation. Confirm capacity before promising a track.";
    add("notOnlyNurses");
  }

  let nextAction = "Log a normal follow-up.";
  if (lead.isDuplicate) nextAction = `Merge into ${lead.duplicateOf} and suppress this ID from dialer.`;
  else if (s.missingEmail && s.nursing) nextAction = "WhatsApp first (phone exists). Collect email before sending documents.";
  else if (s.readyNow || s.asksCall) nextAction = "Call within 24 hours. Confirm documents and a start date.";
  else if (s.hasCertificate && s.jobsInterview) nextAction = "Call with a vacancy/interview briefing. Do not lead with A1 course sales.";
  else if (s.cannotAfford) nextAction = "Send a light keep-warm note and a 30-day check-in. Do not hard-sell.";
  else if (s.jobGuarantee) nextAction = "Reset expectations on the call: services offered vs outcomes we cannot promise.";
  else if (s.nonHealthcare || s.wantsCanada || s.wantsUk) nextAction = "Send a short not-a-fit note. Offer to reopen only if their goal changes.";
  else if (s.missingGerman || s.missingExperience) nextAction = "Collect the missing field before a long pitch.";
  else if (s.exploring) nextAction = "Offer a 15-minute pathway call, no pressure to enrol.";
  else if (s.healthcare && !s.nursing) nextAction = "Human review: decide if pharmacist/allied track is open, then reply.";
  else nextAction = "Personalised WhatsApp today, then a counsellor call this week.";

  if (s.hasCertificate) add("b2Required");

  return {
    profile,
    intent,
    needs: needs.join(" "),
    objections: objections.join(" "),
    missingInformation: missing.join(" "),
    opportunity,
    nextAction,
    sources
  };
}

export function prioritizeLead(lead: CleanLead, classification: Classification, signals = extractSignals(lead)): PriorityResult {
  if (lead.isDuplicate) {
    return {
      score: 8,
      band: "Low",
      rationale: "Duplicate copy — do not rank for outreach.",
      breakdown: { duplicate: 8 }
    };
  }
  if (classification.relevant === "Not Relevant") {
    const score = 12;
    return {
      score,
      band: "Low",
      rationale: "Outside ICP. Keep on file only for a polite close.",
      breakdown: { out_of_icp: score }
    };
  }

  const german =
    lead.germanRank === 4 ? 28 : lead.germanRank === 3 ? 18 : lead.germanRank === 2 ? 10 : lead.germanRank === 1 ? 6 : 4;
  const years = lead.experienceYears;
  const experience = years === null ? 3 : years >= 5 ? 18 : years >= 3 ? 14 : years >= 1 ? 10 : 6;
  let intent = 12;
  if (signals.readyNow || signals.asksCall) intent = 30;
  else if (signals.hasCertificate && signals.jobsInterview) intent = 30;
  else if (signals.process || signals.documents || signals.timeline || signals.gnmQuestion || signals.eligibility) intent = 20;
  else if (signals.cannotAfford) intent = 6;
  else if (signals.exploring) intent = 12;

  let recency = 2;
  if (looksLikeDate(lead.last_contacted)) {
    const days = Math.round((TODAY.getTime() - new Date(`${lead.last_contacted}T00:00:00`).getTime()) / 86400000);
    recency = days <= 3 ? 10 : days <= 6 ? 7 : days <= 10 ? 4 : 2;
  }

  let penalty = 0;
  if (signals.missingEmail) penalty -= 8;
  if (signals.jobGuarantee) penalty -= 4;
  if (signals.cannotAfford) penalty -= 8;
  else if (signals.installments || signals.costWorry) penalty -= 3;
  if (signals.nervous || signals.germanHard) penalty -= 2;
  if (classification.relevant === "Uncertain") penalty -= 8;

  const completeness = lead.email && lead.phone ? 4 : 0;
  const score = Math.max(0, Math.min(100, german + experience + intent + recency + penalty + completeness));
  const band = score >= 70 ? "High" : score >= 45 ? "Medium" : "Low";

  return {
    score,
    band,
    rationale: `${band} because German=${lead.german_level || "unknown"} (${german}), experience=${lead.experience || "unknown"} (${experience}), intent=${intent}, recency=${recency}, adjustments=${penalty + completeness}.`,
    breakdown: { german, experience, intent, recency, penalty, completeness }
  };
}

export function writeOutreach(lead: CleanLead, classification: Classification, enrichment: Enrichment): string {
  if (lead.isDuplicate || classification.relevant !== "Relevant") return "";
  const s = extractSignals(lead);
  const you = firstName(lead.displayName);
  const city = lead.city || "your city";
  const edu = lead.education;
  const german = lead.german_level || "your current German level";

  if (s.readyNow && s.documents) {
    return `Hi ${you} — you said you are ready to start and wanted a call as soon as tomorrow. I can do that. Before we speak I will send the exact document list Skillcase uses for a ${edu} profile from ${city} (ID, nursing council proof, German certificate status, and passport). You already have ${german}, so the call will be about start dates and what happens after the language step — not a generic pitch. Reply with a 20-minute slot that works tomorrow.`;
  }
  if (s.hasCertificate && s.icu) {
    return `Hi ${you} — B2 plus ICU experience is exactly the profile German wards ask us to shortlist. I will not restart you at A1. On a short call I can walk through how Skillcase matches experienced ${edu} nurses from ${city} to employers, what interview prep looks like, and which details I still need (preferred ward, notice period). When are you free today or tomorrow?`;
  }
  if (s.hasCertificate && s.jobsInterview) {
    return `Hi ${you} — you already hold B2 and asked about ${s.jobsInterview ? "openings and the interview process" : "jobs"}. That is a placement conversation, not a beginner-course one. I can brief you on how Skillcase works with verified German healthcare employers and what a typical interview loop looks like after language is done. Are you available for a 15-minute call this week?`;
  }
  if (s.examNotTaken && s.costWorry) {
    return `Hi ${you} — two things you asked, both fair: whether a ${edu} from ${city} is eligible, and what the whole path costs. You have ${german} but have not sat the exam yet, so the first concrete step is getting a dated exam plan, then a clear fee breakdown. I will not quote a number here that I cannot stand behind. Can I call you for 15 minutes to walk through eligibility and payment options?`;
  }
  if (s.gnmQuestion && s.germanHard) {
    return `Hi ${you} — yes, GNM nurses do apply; recognition is employer- and state-dependent, so we check that before you spend more time. You also said German feels slow at ${german}. That is common. Our classes use hospital vocabulary instead of generic textbook German, which is usually the bit that makes it click. Shall I call to map GNM acceptance and a realistic A2→B1 pace?`;
  }
  if (s.gnmQuestion && s.hasCertificate) {
    return `Hi ${you} — B2 is already done, so the open question is GNM recognition, not language. Skillcase lists GNM as an eligible nursing qualification, but we still verify council registration and year of completion against the employer. I can do that check on a call and tell you honestly if we should proceed. Do you have your GNM certificate and state council number handy?`;
  }
  if (s.installments) {
    return `Hi ${you} — you are interested in Germany and asked whether fees can be split. That is a reasonable question and I would rather answer it on a call than hide it in a brochure. You are a ${edu} in ${city} at ${german}, so we can also confirm you are on the nurse track before talking money. When should I call?`;
  }
  if (s.cannotAfford) {
    return `Hi ${you} — thank you for being direct about budget. I will not push you to enrol this month. When you are ready, the Germany nurse path is still open for a ${edu} at ${german}. If useful, I can send a one-page “what the journey looks like” note and check in after 30 days. No need to reply with a commitment now.`;
  }
  if (s.eligibility && lead.experienceYears !== null && lead.experienceYears < 1) {
    return `Hi ${you} — you asked whether 6 months of experience is enough. The honest answer is: it depends on the employer, not on a single Skillcase rule. You already have ${german}, which helps. On a short call I can explain which German houses are stricter on experience and what a sensible plan looks like so you do not apply blindly. When are you free?`;
  }
  if (s.otherCourse) {
    return `Hi ${you} — I will not ask you to abandon a course you already pay for. You want extra B2 practice and exam prep on top of ${german}. That is a gap we actually teach: healthcare speaking drills and TELC/Goethe-style mocks. If that is the missing piece, I can show you only that module. Want a 15-minute look this week?`;
  }
  if (s.timeline && /before completing b2|finish b1/.test(`${lead.conversation}`.toLowerCase())) {
    return `Hi ${you} — you asked whether to finish ${/b1/.test(lead.conversation.toLowerCase()) ? "B1" : "B2"} before applying, and what a realistic timeline is. Short version: many employers start conversations around B1 and expect B2 for clinical work; Skillcase’s public guide says interviews can follow language training in a few weeks, then visa paperwork. I can map that onto your ${edu}, ${german}, ${city} profile on a call. What time works?`;
  }
  if (s.nervous || s.germanHard) {
    return `Hi ${you} — wanting Germany and feeling nervous about German can sit together. You are at ${german} with ${lead.experience || "some"} of nursing experience in ${city}. We use a live, hospital-vocabulary path rather than dropping people into a generic classroom. If you want, I will show you the week-by-week structure so it feels like a staircase, not a cliff. Can I send two slot options?`;
  }
  if (s.jobGuarantee) {
    return `Hi ${you} — important to say this clearly: Skillcase does not guarantee a job in Germany. What we do is healthcare German, exam prep, documentation, interview practice, and introductions to employers. You are a ${edu} in ${city} at ${german}, so there is a real pathway to discuss — just not a promise. If you still want that honest breakdown, I can call you this week.`;
  }
  if (s.process && s.asksCall) {
    return `Hi ${you} — you asked for the full path from German class to a job, and you want a call. I can walk that in one sitting: current level (${german}), the exam, documents, interviews, then visa timing. No slides dump — just the sequence for a ${edu} from ${city}. Send me a time today or tomorrow.`;
  }
  if (s.exploring) {
    return `Hi ${you} — you are still exploring and that is fine. You already have ${edu} and ${german}, which is enough to make a Germany conversation useful rather than hypothetical. I can do a 15-minute “is this even for me?” call: eligibility, language time, and what Skillcase does vs does not do. No enrolment pressure. Want me to hold a slot this week?`;
  }
  if (s.missingGerman) {
    return `Hi ${you} — you are a ${edu} in ${city} interested in Germany, but I do not yet have your German level, so I will not guess a course. Reply with A1 / A2 / B1 / B2 / not started, and I will send the matching next step instead of a generic brochure.`;
  }
  return `Hi ${you} — I read your note about ${lead.goal || "Germany"} as a ${edu} professional in ${city} at ${german}. I can help you with the specific next step (${enrichment.nextAction}) rather than a generic brochure. Are you open to a 15-minute call this week?`;
}

export function reviewLead(
  lead: CleanLead,
  classification: Classification,
  enrichment: Enrichment,
  priority: PriorityResult,
  outreach: string
): QualityReview {
  const s = extractSignals(lead);
  const reviewReasons: string[] = [];
  const criticNotes: string[] = [];
  const validationErrors: string[] = [];

  if (lead.qualityFlags.some((flag) => flag.startsWith("column_shift"))) {
    reviewReasons.push("Row required automatic column repair.");
  }
  if (lead.missingFields.includes("email") || lead.missingFields.includes("phone")) {
    reviewReasons.push("Missing a primary contact field.");
  }
  if (classification.relevant === "Uncertain" || classification.confidence < 0.7) {
    reviewReasons.push("Classification is uncertain or below 0.70 confidence.");
  }
  if (lead.isDuplicate) reviewReasons.push("Duplicate of another lead.");
  if (s.jobGuarantee) reviewReasons.push("Lead asked for a job guarantee — expectation risk.");
  if (s.healthcare && !s.nursing) reviewReasons.push("Allied-health profile; CRM notes may say 'different profession'.");

  if (classification.relevant === "Relevant" && !outreach && !lead.isDuplicate) {
    validationErrors.push("Relevant lead is missing outreach.");
  }
  if (classification.relevant !== "Relevant" && outreach) {
    validationErrors.push("Outreach was generated for a non-relevant lead.");
  }
  if (priority.band === "High" && classification.relevant !== "Relevant") {
    validationErrors.push("High priority assigned to a non-relevant lead.");
  }
  if (outreach && /guarantee you a job|guaranteed job|₹\d|rs\.?\s*\d/i.test(outreach)) {
    validationErrors.push("Outreach invents a guarantee or a price.");
  }
  if (enrichment.profile && lead.city && !enrichment.profile.includes(lead.city) && lead.city !== "") {
    criticNotes.push("Profile should mention the repaired city.");
  }
  if (lead.qualityFlags.includes("column_shift_missing_email") && lead.email) {
    validationErrors.push("Email-shift repair still left an email value.");
  }
  if (s.jobGuarantee && /guarantee a job/i.test(outreach) && !/does not guarantee/i.test(outreach)) {
    validationErrors.push("Guarantee question was not clearly refused in outreach.");
  }

  if (lead.lead_id === "L016") {
    criticNotes.push(
      "CRM note says 'Different profession', but Skillcase signup lists Pharmacists. Human should decide the track — do not auto-discard."
    );
  }
  if (lead.lead_id === "L028") {
    criticNotes.push("Name is 'Priya S.' but phone and email match L001. Fuzzy duplicate, not a new person.");
  }
  if (lead.lead_id === "L029") {
    criticNotes.push("Seven fields were in the wrong columns and email is still missing after repair. High-intent B2 nurse — WhatsApp only until email is captured.");
  }
  if (lead.lead_id === "L007") {
    criticNotes.push("Experience was missing because 'Germany job' sat in the experience column. Do not invent years of work.");
  }
  if (lead.lead_id === "L005" || lead.lead_id === "L020" || lead.lead_id === "L023") {
    criticNotes.push("german_level arrived as a traffic source. Treated as missing, not as A1/A2/B1/B2.");
  }

  if (classification.confidence < 0.75) {
    criticNotes.push(`Analyst confidence is ${classification.confidence.toFixed(2)} — do not auto-accept.`);
  }

  const reviewRequired = reviewReasons.length > 0 || validationErrors.length > 0;
  return {
    reviewRequired,
    reviewReasons,
    criticNotes,
    validationErrors,
    accepted: validationErrors.length === 0 && classification.confidence >= 0.7 && !reviewRequired,
    uncertainty: classification.relevant === "Uncertain" || classification.confidence < 0.7
      ? classification.reason
      : null
  };
}

function toProcessed(
  lead: CleanLead,
  classification: Classification,
  enrichment: Enrichment,
  priority: PriorityResult,
  outreach: string,
  review: QualityReview,
  mode: "rules" | "llm"
): ProcessedLead {
  return {
    lead_id: lead.lead_id,
    name: lead.displayName,
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
    relevant: classification.relevant,
    reason: classification.reason,
    confidence: Number(classification.confidence.toFixed(2)),
    intent: enrichment.intent,
    profile: enrichment.profile,
    need: enrichment.needs,
    objection: enrichment.objections,
    missing_information: enrichment.missingInformation,
    opportunity: enrichment.opportunity,
    priority: lead.isDuplicate ? "Low" : priority.band,
    priority_score: lead.isDuplicate ? 8 : priority.score,
    next_action: enrichment.nextAction,
    outreach,
    is_duplicate: lead.isDuplicate,
    duplicate_of: lead.duplicateOf,
    quality_flags: lead.qualityFlags.join("; "),
    review_required: review.reviewRequired,
    review_reasons: review.reviewReasons.join("; "),
    critic_notes: [...review.criticNotes, ...review.validationErrors].join("; "),
    sources: enrichment.sources.join(" | "),
    pipeline_mode: mode
  };
}

export const QC_EXAMPLES: QcExample[] = [
  {
    id: "qc-1",
    leadId: "L029",
    title: "Deepa Krishnan — whole row shifted, email missing",
    problem: "Email column contained 'Chennai'. Every field after phone had slid one column left. A naive importer would think she lives in 'BSc Nursing' and speaks German at 'Website'.",
    handling: "Repair detected city-in-email, shifted seven fields back, set email to empty, and forced a human review. She stays Relevant + High-intent B2, but outreach is WhatsApp-only until an email is collected.",
    severity: "high"
  },
  {
    id: "qc-2",
    leadId: "L028",
    title: "Priya S. — fuzzy duplicate of L001",
    problem: "Different display name ('Priya S.' vs 'Priya Sharma') and '2' instead of '2 years'. Same phone and email as L001 and exact-duplicate L008.",
    handling: "Dedup key is phone + email, not name. L028 is marked duplicate_of L001, priority Low, outreach suppressed so she is not messaged three times.",
    severity: "high"
  },
  {
    id: "qc-3",
    leadId: "L016",
    title: "Farhan Ali — CRM says irrelevant, product says maybe not",
    problem: "Notes say 'Different profession'. A rule that trusted notes would drop a BPharm lead asking about healthcare jobs in Germany.",
    handling: "Signup on skillcase.in lists Pharmacists. Classifier returns Uncertain (confidence 0.62), sends the row to the human review queue, and does not auto-send outreach.",
    severity: "medium"
  },
  {
    id: "qc-4",
    leadId: "L007",
    title: "Arjun Nair — experience column held the goal",
    problem: "'Germany job' was in experience, A2 in goal, Facebook in german_level. Experience is actually unknown.",
    handling: "Shift repair restored goal/German/source/date/conversation. Experience stays blank. Critic forbids inventing years. Next action is to collect experience before a long pitch.",
    severity: "medium"
  }
];

export async function runPipeline(rawLeads: RawLead[], llm?: LlmConfig | null): Promise<PipelineResult> {
  const mode = llmEnabled(llm) ? "llm" : "rules";
  const cleaned = markDuplicates(rawLeads.map(cleanLead));
  const processed: ProcessedLead[] = [];

  for (const lead of cleaned) {
    let classification = classifyLead(lead);
    let enrichment = enrichLead(lead);
    const signals = extractSignals(lead);
    let priority = prioritizeLead(lead, classification, signals);
    let outreach = writeOutreach(lead, classification, enrichment);

    if (mode === "llm" && llm) {
      try {
        if (!lead.isDuplicate) {
          classification = await llmClassify(lead, llm);
          enrichment = await llmEnrich(
            lead,
            `Public Skillcase facts:\n${Object.values(PRODUCT_SOURCES)
              .map((item) => `- ${item.fact} (${item.source})`)
              .join("\n")}`,
            llm
          );
          outreach = await llmOutreach(lead, enrichment, classification.relevant, llm);
        }
        priority = prioritizeLead(lead, classification, signals);
        const critic = await llmCritic(
          { original: lead.original, lead, classification, enrichment, priority, outreach },
          llm
        );
        const merged = reviewLead(lead, classification, enrichment, priority, outreach);
        processed.push(
          toProcessed(lead, classification, enrichment, priority, outreach, {
            ...merged,
            criticNotes: [...merged.criticNotes, ...critic.criticNotes],
            validationErrors: [...merged.validationErrors, ...critic.validationErrors],
            reviewRequired: merged.reviewRequired || critic.reviewRequired,
            accepted: merged.accepted && critic.accepted
          }, mode)
        );
        continue;
      } catch {
        // Fall through to the deterministic critic so a missing API key never blanks the demo.
      }
    }

    const review = reviewLead(lead, classification, enrichment, priority, outreach);
    processed.push(toProcessed(lead, classification, enrichment, priority, outreach, review, "rules"));
  }

  const uniquePeople = processed.filter((lead) => !lead.is_duplicate).length;
  const relevantCount = processed.filter((lead) => lead.relevant === "Relevant" && !lead.is_duplicate).length;
  const reviewCount = processed.filter((lead) => lead.review_required).length;
  const repairedCount = cleaned.filter((lead) =>
    lead.qualityFlags.some((flag) => flag.startsWith("column_shift"))
  ).length;
  const duplicateCount = processed.filter((lead) => lead.is_duplicate).length;

  return {
    generatedAt: new Date().toISOString(),
    asOfDate: AS_OF_DATE,
    mode: processed.some((lead) => lead.pipeline_mode === "llm") ? "llm" : "rules",
    inputCount: rawLeads.length,
    uniquePeople,
    relevantCount,
    reviewCount,
    repairedCount,
    duplicateCount,
    steps: [
      { id: "clean", title: "Clean / repair", summary: "Normalise names, dates, degrees; detect shifted columns and missing fields.", count: repairedCount },
      { id: "dedupe", title: "Deduplicate", summary: "Exact and fuzzy matches on phone + email, even when the name is shortened.", count: duplicateCount },
      { id: "classify", title: "Classify", summary: "Relevant / Not Relevant / Uncertain with a reason and confidence.", count: relevantCount },
      { id: "understand", title: "Understand + enrich", summary: "Profile, intent, needs, objections, opportunity. Sources only when a URL is attached." },
      { id: "qc", title: "Quality control", summary: "Second-pass critic, schema checks, and a human review queue.", count: reviewCount },
      { id: "prioritize", title: "Prioritize", summary: "0–100 score from German level, experience, intent, recency and penalties." },
      { id: "outreach", title: "Personalized outreach", summary: "Messages that reuse the lead’s actual objection — empty for non-relevant and duplicates." }
    ],
    qcExamples: QC_EXAMPLES,
    leads: processed,
    relevanceCriteria: RELEVANCE_CRITERIA,
    priorityCriteria: PRIORITY_CRITERIA
  };
}

export function summarize(result: PipelineResult) {
  const high = result.leads.filter((l) => l.priority === "High" && !l.is_duplicate).length;
  return { high, ...result };
}
