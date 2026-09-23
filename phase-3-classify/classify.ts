import type { CleanLead } from "../phase-2-clean/types";
import { GeminiError, geminiJson } from "./gemini";
import { CLASSIFY_SYSTEM, classifyUserPrompt } from "./prompt";
import type { Classification, ClassifiedLead, Relevance } from "./types";

const LABELS: Relevance[] = ["Relevant", "Not Relevant", "Uncertain"];

export function parseClassification(input: unknown): Classification {
  const row = (input || {}) as Record<string, unknown>;
  const relevant = LABELS.includes(row.relevant as Relevance) ? (row.relevant as Relevance) : null;
  if (!relevant) {
    throw new Error("Classification is missing a valid relevant label.");
  }
  const confidence = Number(row.confidence);
  return {
    relevant,
    reason: String(row.reason || "").trim() || "Gemini did not supply a reason.",
    confidence: Number.isFinite(confidence) ? Math.min(1, Math.max(0, confidence)) : 0,
    criteria: Array.isArray(row.criteria) ? row.criteria.map((item) => String(item)) : []
  };
}

export function contradictionFlags(lead: CleanLead, classification: Classification): string[] {
  const flags: string[] = [];
  const education = `${lead.education}`.toLowerCase();
  const blob = `${lead.goal} ${lead.conversation}`.toLowerCase();
  const nonHealthcare = education.includes("bba") || education.includes("engineer");
  const wrongMarket =
    (blob.includes("canada") && !lead.goal.toLowerCase().includes("germany")) ||
    /\buk\b|work in uk/.test(blob);

  if (nonHealthcare && classification.relevant === "Relevant" && classification.confidence >= 0.7) {
    flags.push("Rule check: non-healthcare marked Relevant with high confidence.");
  }
  if (wrongMarket && classification.relevant === "Relevant") {
    flags.push("Rule check: Canada/UK-only lead marked Relevant.");
  }
  return flags;
}

export function fallbackClassification(error: unknown): Classification {
  const message = error instanceof GeminiError ? error.message : error instanceof Error ? error.message : String(error);
  return {
    relevant: "Uncertain",
    reason: `Gemini classification failed: ${message}`,
    confidence: 0,
    criteria: ["fallback: Gemini unreachable or invalid JSON"]
  };
}

export function attachClassification(
  lead: CleanLead,
  classification: Classification,
  model: string,
  failed = false
): ClassifiedLead {
  const contradictions = contradictionFlags(lead, classification);
  const reviewReasons: string[] = [];
  if (failed) reviewReasons.push("Gemini failed; do not auto-accept.");
  if (classification.relevant === "Uncertain" || classification.confidence < 0.7) {
    reviewReasons.push("Classification is uncertain or below 0.70 confidence.");
  }
  if (lead.missingFields.includes("email") || lead.missingFields.includes("german_level")) {
    reviewReasons.push("Critical field still missing after clean.");
  }
  if (contradictions.length) reviewReasons.push(...contradictions);

  return {
    ...lead,
    ...classification,
    reviewRequired: reviewReasons.length > 0,
    reviewReasons,
    contradictionFlags: contradictions,
    model,
    pipelineStep: "phase3-gemini"
  };
}

export async function classifyLead(lead: CleanLead): Promise<ClassifiedLead> {
  try {
    const { data, model } = await geminiJson<Classification>(CLASSIFY_SYSTEM, classifyUserPrompt(lead));
    return attachClassification(lead, parseClassification(data), model);
  } catch (error) {
    return attachClassification(lead, fallbackClassification(error), "fallback", true);
  }
}
