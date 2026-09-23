import type { PrioritizedLead } from "../phase-6-prioritize/types";

export type GeminiPath = "ai" | "fallback";

export interface OutreachDraft {
  outreach: string;
  outreachEligible: boolean;
  wordCount: number;
  criticFlags: string[];
  outreachPath: GeminiPath;
}

export interface OutreachedLead extends Omit<PrioritizedLead, "pipelineStep">, OutreachDraft {
  pipelineStep: "phase7-outreach";
}

export interface Phase7Quality {
  ok: boolean;
  rowCount: number;
  draftCount: number;
  blankCount: number;
  errors: string[];
}

export interface Phase7Result {
  leads: OutreachedLead[];
  drafts: OutreachedLead[];
  quality: Phase7Quality;
}

export const MIN_WORDS = 50;
export const MAX_WORDS = 70;
