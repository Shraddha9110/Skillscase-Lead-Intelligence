import type { CleanLead } from "../phase-2-clean/types";
import type { Signals } from "./types";

const compact = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

const NURSING = ["bsc nursing", "gnm", "anm", "msc nursing", "post basic"];
const HEALTHCARE = [...NURSING, "bpharm", "pharmacist", "mbbs", "doctor", "physiotherapist", "dentist"];
const NON_HEALTHCARE = ["bba", "engineer", "engineering"];

export function extractSignals(lead: CleanLead): Signals {
  const blob = `${lead.goal} ${lead.conversation}`.toLowerCase();
  const edu = compact(lead.education);
  return {
    wantsGermany: /germany/.test(blob) && !/not germany/.test(blob),
    wantsCanada: /canada/.test(blob),
    wantsUk: /\buk\b/.test(blob),
    nursing: NURSING.some((item) => edu.includes(item)),
    healthcare: HEALTHCARE.some((item) => edu.includes(item)),
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
    hasCertificate: /already has b2|b2 certified|has b2|\bwith b2\b/.test(blob),
    otherCourse: /another german course/.test(blob),
    jobGuarantee: /guarantee/.test(blob),
    timeline: /timeline|how long|before completing|finish b1/.test(blob),
    documents: /document/.test(blob),
    icu: /\bicu\b/.test(blob),
    process: /full process|what skillcase actually provides/.test(blob),
    missingGerman: lead.missingFields.includes("german_level"),
    missingExperience: lead.missingFields.includes("experience"),
    missingEmail: lead.missingFields.includes("email")
  };
}
