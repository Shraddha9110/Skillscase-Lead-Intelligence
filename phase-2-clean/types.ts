import type { RawLead } from "../phase-1-ingest/types";

export interface CleanLead {
  lead_id: string;
  name: string;
  displayName: string;
  phone: string;
  email: string;
  city: string;
  education: string;
  experience: string;
  goal: string;
  german_level: string;
  source: string;
  last_contacted: string;
  conversation: string;
  notes: string;
  original: RawLead;
  phoneDigits: string;
  emailNormalized: string;
  experienceYears: number | null;
  germanRank: number | null;
  repairedFields: string[];
  missingFields: string[];
  invalidFields: string[];
  qualityFlags: string[];
  isDuplicate: boolean;
  duplicateOf: string | null;
  duplicateReason: string | null;
}

export interface Phase2Quality {
  ok: boolean;
  rowCount: number;
  duplicateCount: number;
  columnShiftCount: number;
  errors: string[];
}

export interface Phase2Result {
  leads: CleanLead[];
  quality: Phase2Quality;
}

export const KNOWN_SOURCES = ["instagram", "whatsapp", "referral", "website", "facebook"];
export const GERMAN_LEVELS = ["a1", "a2", "b1", "b2", "c1", "c2"];
export const INDIAN_CITIES = [
  "bangalore",
  "bengaluru",
  "hyderabad",
  "delhi",
  "mumbai",
  "pune",
  "chennai",
  "kolkata",
  "kochi",
  "ahmedabad",
  "lucknow",
  "jaipur",
  "noida",
  "chandigarh",
  "patna"
];
export const EDUCATION_HINTS = [
  "nursing",
  "gnm",
  "bpharm",
  "b.pharm",
  "bba",
  "engineer",
  "engineering",
  "mbbs",
  "pharmacist"
];
