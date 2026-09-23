import type { EnrichedLead } from "../phase-4-enrich/types";
import type { Relevance } from "../phase-3-classify/types";

export type QueueStatus = "pending" | "accepted" | "held" | "rejected";

export interface QualityReview {
  reviewRequired: boolean;
  reviewReasons: string[];
  criticNotes: string[];
  validationErrors: string[];
  accepted: boolean;
  uncertainty: string | null;
  queueStatus: QueueStatus;
}

export interface ClassificationHint {
  relevant: Relevance;
  reason: string;
  confidence: number;
}

export interface ReviewedLead extends EnrichedLead, QualityReview {
  relevant?: Relevance;
  reason?: string;
  confidence?: number;
  showcaseId: string | null;
  pipelineStep: "phase5-qc";
}

export interface QcExample {
  id: string;
  leadId: string;
  title: string;
  problem: string;
  handling: string;
}

export interface Phase5Quality {
  ok: boolean;
  rowCount: number;
  reviewCount: number;
  showcaseCount: number;
  errors: string[];
}

export interface Phase5Result {
  leads: ReviewedLead[];
  queue: ReviewedLead[];
  examples: QcExample[];
  quality: Phase5Quality;
}
