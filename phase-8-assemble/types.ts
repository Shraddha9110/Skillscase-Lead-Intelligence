import type { QcExample } from "../phase-5-qc/types";

export type Relevance = "Relevant" | "Not Relevant" | "Uncertain";
export type Priority = "High" | "Medium" | "Low";

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
  relevant: Relevance | string;
  reason: string;
  confidence: number;
  intent: string;
  profile: string;
  need: string;
  objection: string;
  missing_information: string;
  opportunity: string;
  priority: Priority | "";
  priority_score: number | null;
  next_action: string;
  outreach: string;
  is_duplicate: boolean;
  duplicate_of: string | null;
  quality_flags: string;
  review_required: boolean;
  review_reasons: string;
  critic_notes: string;
  sources: string;
  pipeline_mode: "rules" | "llm";
  enrichment_path: "ai" | "fallback";
  outreach_path: "ai" | "fallback";
}

export interface PipelineStep {
  id: string;
  title: string;
  summary: string;
}

export interface PipelineDataset {
  generatedAt: string;
  asOfDate: string;
  mode: "rules" | "llm";
  model: string;
  stepModes?: {
    classify: "ai" | "rules";
    enrich: "ai" | "fallback";
    outreach: "ai" | "fallback";
  };
  inputCount: number;
  uniquePeople: number;
  relevantCount: number;
  reviewCount: number;
  repairedCount: number;
  duplicateCount: number;
  draftCount: number;
  steps: PipelineStep[];
  qcExamples: QcExample[];
  leads: ProcessedLead[];
  relevanceCriteria: string[];
  priorityCriteria: string[];
}

export interface Phase8Quality {
  ok: boolean;
  rowCount: number;
  uniquePeople: number;
  draftCount: number;
  reviewCount: number;
  errors: string[];
}

export interface Phase8Result {
  dataset: PipelineDataset;
  leads: ProcessedLead[];
  quality: Phase8Quality;
}

export const OUTPUT_COLUMNS = [
  "lead_id",
  "name",
  "phone",
  "email",
  "city",
  "education",
  "experience",
  "goal",
  "german_level",
  "source",
  "last_contacted",
  "relevant",
  "reason",
  "confidence",
  "intent",
  "profile",
  "need",
  "objection",
  "missing_information",
  "opportunity",
  "priority",
  "priority_score",
  "next_action",
  "outreach",
  "is_duplicate",
  "duplicate_of",
  "quality_flags",
  "review_required",
  "review_reasons",
  "critic_notes",
  "sources",
  "enrichment_path",
  "outreach_path"
] as const;

export const REQUIRED_TEXT_FIELDS: (keyof ProcessedLead)[] = [
  "lead_id",
  "name",
  "relevant",
  "reason",
  "intent",
  "profile",
  "need",
  "objection",
  "missing_information",
  "opportunity",
  "priority",
  "next_action"
];
