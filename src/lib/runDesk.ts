import { classifyLead } from "../../phase-3-classify/classify";
import { getGeminiApiKey, getGeminiModel, loadEnv } from "../../phase-3-classify/env";
import { markDuplicates } from "../../phase-2-clean/dedupe";
import { cleanLead } from "../../phase-2-clean/clean";
import { toEnrichedLead } from "../../phase-4-enrich/enrich";
import { runPhase5 } from "../../phase-5-qc/run";
import type { ClassificationHint } from "../../phase-5-qc/types";
import { runPhase6 } from "../../phase-6-prioritize/run";
import { runPhase7 } from "../../phase-7-outreach/run";
import { assembleDataset } from "../../phase-8-assemble/assemble";
import { evaluateAgainstNotes } from "./evaluate";
import { loadRawLeads } from "./load";
import type { PipelineResult } from "./types";

export async function runDeskPipeline(): Promise<PipelineResult> {
  loadEnv();
  const rawLeads = loadRawLeads();
  const cleaned = markDuplicates(rawLeads.map(cleanLead));
  const apiKey = getGeminiApiKey();
  const classifications: Record<string, ClassificationHint> = {};
  let mode: "rules" | "llm" = "rules";
  let model = "rules";

  if (apiKey) {
    model = getGeminiModel();
    const unique = cleaned.filter((lead) => !lead.isDuplicate);
    const concurrency = 4;
    let usedGemini = 0;
    for (let index = 0; index < unique.length; index += concurrency) {
      const batch = unique.slice(index, index + concurrency);
      const classifiedBatch = await Promise.all(batch.map((lead) => classifyLead(lead)));
      const quotaHit = classifiedBatch.every(
        (classified) => classified.model === "fallback" && /429|quota/i.test(classified.reason)
      );
      for (const classified of classifiedBatch) {
        if (classified.model === "fallback") continue;
        usedGemini += 1;
        classifications[classified.lead_id] = {
          relevant: classified.relevant,
          reason: classified.reason,
          confidence: classified.confidence
        };
      }
      console.log(`Classified ${Math.min(index + concurrency, unique.length)}/${unique.length} unique leads`);
      if (quotaHit) {
        console.log("Gemini quota exceeded; remaining unique leads use rules labels.");
        break;
      }
    }
    mode = usedGemini > 0 ? "llm" : "rules";
    console.log(`Classify mode: ${mode === "llm" ? "AI" : "rules"} · model ${model} · live labels ${usedGemini}/${unique.length}`);
  }

  const enriched = cleaned.map(toEnrichedLead);
  const reviewed = runPhase5(enriched, classifications).leads;
  const prioritized = runPhase6(reviewed).leads;
  const outreached = runPhase7(prioritized).leads;
  const dataset = assembleDataset(outreached, new Date().toISOString(), mode, model);
  const evaluation = evaluateAgainstNotes(dataset.leads);

  return {
    generatedAt: dataset.generatedAt,
    asOfDate: dataset.asOfDate,
    mode,
    model,
    inputCount: dataset.inputCount,
    uniquePeople: dataset.uniquePeople,
    relevantCount: dataset.relevantCount,
    reviewCount: dataset.reviewCount,
    repairedCount: 0,
    duplicateCount: dataset.duplicateCount,
    steps: dataset.steps.map((step) => ({
      id: step.id,
      title: step.title,
      summary:
        step.id === "classify"
          ? mode === "llm"
            ? `AI classification with ${model}. Reason and confidence are per lead.`
            : `Rules classification. Configured model: ${model}. Reason and confidence are per lead.`
          : step.summary
    })),
    qcExamples: dataset.qcExamples.map((example) => ({ ...example, severity: "high" as const })),
    leads: dataset.leads.map((lead) => ({
      ...lead,
      pipeline_mode: mode
    })),
    relevanceCriteria: dataset.relevanceCriteria,
    priorityCriteria: dataset.priorityCriteria,
    evaluation
  };
}
