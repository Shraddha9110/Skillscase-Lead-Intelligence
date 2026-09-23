import type { CleanLead } from "../phase-2-clean/types";

export type Relevance = "Relevant" | "Not Relevant" | "Uncertain";

export interface Classification {
  relevant: Relevance;
  reason: string;
  confidence: number;
  criteria: string[];
}

export interface ClassifiedLead extends CleanLead {
  relevant: Relevance;
  reason: string;
  confidence: number;
  criteria: string[];
  reviewRequired: boolean;
  reviewReasons: string[];
  contradictionFlags: string[];
  model: string;
  pipelineStep: "phase3-gemini";
}

export interface Phase3Quality {
  ok: boolean;
  classifiedCount: number;
  geminiFailures: number;
  reviewCount: number;
  errors: string[];
}

export interface Phase3Result {
  leads: ClassifiedLead[];
  quality: Phase3Quality;
}
