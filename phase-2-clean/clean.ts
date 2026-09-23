import type { RawLead } from "../phase-1-ingest/types";
import {
  compact,
  looksLikeDate,
  looksLikeEmail,
  looksLikeGerman,
  looksLikeGoal,
  looksLikeSource,
  phoneDigits,
  titleName
} from "./detect";
import type { CleanLead } from "./types";

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
  if (looksLikeGoal(value)) return { label: "", years: null };
  const year = value.match(/(\d+(?:\.\d+)?)/);
  if (year) {
    const years = Number(year[1]);
    return { label: `${years} year${years === 1 ? "" : "s"}`, years };
  }
  return { label: value.trim(), years: null };
}

function normalizeGoal(value: string) {
  const text = value.trim().toLowerCase();
  if (text === "germany") return "Work in Germany";
  if (text === "canada") return "Work in Canada";
  if (text === "uk" || text === "work in uk") return "Work in UK";
  return value.trim();
}

function germanRank(value: string): number | null {
  const map: Record<string, number> = { a1: 1, a2: 2, b1: 3, b2: 4, c1: 5, c2: 6 };
  return map[value.trim().toLowerCase()] ?? null;
}

export function cleanLead(raw: RawLead): CleanLead {
  const original = { ...raw };
  const row = { ...raw };
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
      ["email", looksLikeEmail(row.email) ? row.email : ""],
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
