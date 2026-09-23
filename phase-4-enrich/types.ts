import type { CleanLead } from "../phase-2-clean/types";

export interface Signals {
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

export interface Enrichment {
  profile: string;
  intent: string;
  needs: string;
  objections: string;
  missingInformation: string;
  opportunity: string;
  nextAction: string;
  sources: string[];
}

export interface EnrichedLead extends CleanLead, Enrichment {
  signals: Signals;
  pipelineStep: "phase4-enrich";
}

export interface Phase4Quality {
  ok: boolean;
  rowCount: number;
  sourcedCount: number;
  errors: string[];
}

export interface Phase4Result {
  leads: EnrichedLead[];
  quality: Phase4Quality;
}
