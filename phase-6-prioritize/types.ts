import type { Relevance } from "../phase-3-classify/types";
import type { ReviewedLead } from "../phase-5-qc/types";

export type PriorityBand = "High" | "Medium" | "Low";

export interface ScoreBreakdown {
  german: number;
  experience: number;
  intent: number;
  recency: number;
  completeness: number;
  penalty: number;
  floor: number;
}

export interface PriorityResult {
  score: number | null;
  band: PriorityBand | "";
  rationale: string;
  breakdown: ScoreBreakdown;
}

export interface PrioritizedLead extends ReviewedLead, PriorityResult {
  relevant: Relevance | string;
  reason: string;
  dialSuppressed: boolean;
  callOrder: number | null;
  pipelineStep: "phase6-prioritize";
}

export interface Phase6Quality {
  ok: boolean;
  rowCount: number;
  highCount: number;
  mediumCount: number;
  lowCount: number;
  duplicateLowCount: number;
  errors: string[];
}

export interface Phase6Result {
  leads: PrioritizedLead[];
  callList: PrioritizedLead[];
  quality: Phase6Quality;
}
