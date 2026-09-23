import type { RawLead } from "../phase-1-ingest/types";
import { EDUCATION_HINTS, GERMAN_LEVELS, INDIAN_CITIES, KNOWN_SOURCES } from "./types";

export const lower = (value: string) => (value || "").trim().toLowerCase();
export const compact = (value: string) => lower(value).replace(/[^a-z0-9]+/g, " ").trim();

export function looksLikeEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

export function looksLikeCity(value: string) {
  return INDIAN_CITIES.includes(lower(value));
}

export function looksLikeSource(value: string) {
  return KNOWN_SOURCES.includes(lower(value));
}

export function looksLikeDate(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value.trim());
}

export function looksLikeGerman(value: string) {
  return GERMAN_LEVELS.includes(lower(value));
}

export function looksLikeEducation(value: string) {
  const text = compact(value);
  return EDUCATION_HINTS.some((item) => text.includes(item));
}

export function looksLikeGoal(value: string) {
  return /germany|canada|uk|abroad|job|work|move|explore|prepar/i.test(value) && !looksLikeGerman(value);
}

export function phoneDigits(value: string) {
  return value.replace(/\D/g, "");
}

export function titleName(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .map((part) =>
      part.length <= 2 && part.endsWith(".")
        ? `${part[0].toUpperCase()}.`
        : part[0].toUpperCase() + part.slice(1).toLowerCase()
    )
    .join(" ");
}

export function shiftFrom(row: RawLead, start: keyof RawLead, emptyField: keyof RawLead): RawLead {
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
