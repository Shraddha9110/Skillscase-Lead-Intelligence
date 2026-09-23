export type Relevance = "Relevant" | "Not Relevant" | "Uncertain";
export type Priority = "High" | "Medium" | "Low";
export type PipelineMode = "rules" | "llm";

export interface RawLead {
  lead_id: string;
  name: string;
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
}

export interface CleanLead extends RawLead {
  original: RawLead;
  displayName: string;
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

export interface Classification {
  relevant: Relevance;
  reason: string;
  confidence: number;
  criteria: string[];
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

export interface PriorityResult {
  score: number;
  band: Priority;
  rationale: string;
  breakdown: Record<string, number>;
}

export interface QualityReview {
  reviewRequired: boolean;
  reviewReasons: string[];
  criticNotes: string[];
  validationErrors: string[];
  accepted: boolean;
  uncertainty: string | null;
}

export interface ProcessedLead {
  lead_id: string;
  name: string;
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
  relevant: Relevance;
  reason: string;
  confidence: number;
  intent: string;
  profile: string;
  need: string;
  objection: string;
  missing_information: string;
  opportunity: string;
  priority: Priority;
  priority_score: number;
  next_action: string;
  outreach: string;
  is_duplicate: boolean;
  duplicate_of: string | null;
  quality_flags: string;
  review_required: boolean;
  review_reasons: string;
  critic_notes: string;
  sources: string;
  pipeline_mode: PipelineMode;
}

export interface PipelineStepResult {
  id: string;
  title: string;
  summary: string;
  count?: number;
}

export interface QcExample {
  id: string;
  leadId: string;
  title: string;
  problem: string;
  handling: string;
  severity: "high" | "medium" | "low";
}

export interface PipelineResult {
  generatedAt: string;
  asOfDate: string;
  mode: PipelineMode;
  inputCount: number;
  uniquePeople: number;
  relevantCount: number;
  reviewCount: number;
  repairedCount: number;
  duplicateCount: number;
  steps: PipelineStepResult[];
  qcExamples: QcExample[];
  leads: ProcessedLead[];
  relevanceCriteria: string[];
  priorityCriteria: string[];
}
