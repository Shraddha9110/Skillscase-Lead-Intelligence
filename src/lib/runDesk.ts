import { classifyLead } from "../../phase-3-classify/classify";
import { getGeminiApiKey, getGeminiModel, loadEnv } from "../../phase-3-classify/env";
import { markDuplicates } from "../../phase-2-clean/dedupe";
import { cleanLead } from "../../phase-2-clean/clean";
import { toEnrichedLead } from "../../phase-4-enrich/enrich";
import { enrichLeadWithGemini } from "../../phase-4-enrich/geminiEnrich";
import type { EnrichedLead } from "../../phase-4-enrich/types";
import { runPhase5 } from "../../phase-5-qc/run";
import type { ClassificationHint } from "../../phase-5-qc/types";
import { runPhase6 } from "../../phase-6-prioritize/run";
import { writeOutreachWithGemini } from "../../phase-7-outreach/geminiOutreach";
import { toOutreachedLead } from "../../phase-7-outreach/outreach";
import type { OutreachedLead } from "../../phase-7-outreach/types";
import { assembleDataset } from "../../phase-8-assemble/assemble";
import { evaluateAgainstNotes } from "./evaluate";
import { loadRawLeads } from "./load";
import type { PipelineResult, PipelineStepModes } from "./types";

interface GeminiStepResult<T> {
  lead: T;
  usedGemini: boolean;
  quota: boolean;
}

async function mapWithQuotaStop<T, R extends GeminiStepResult<unknown>>(
  items: T[],
  fn: (item: T) => Promise<R>,
  fallback: (item: T) => R,
  label: string
): Promise<{ results: R[]; usedGemini: number; quotaHit: boolean }> {
  const results: R[] = [];
  let usedGemini = 0;
  let quotaHit = false;
  const concurrency = 4;

  for (let index = 0; index < items.length; index += concurrency) {
    if (quotaHit) {
      for (const item of items.slice(index)) results.push(fallback(item));
      break;
    }
    const batch = items.slice(index, index + concurrency);
    const classifiedBatch = await Promise.all(batch.map(fn));
    for (const item of classifiedBatch) {
      results.push(item);
      if (item.usedGemini) usedGemini += 1;
    }
    console.log(`${label} ${Math.min(index + concurrency, items.length)}/${items.length}`);
    if (classifiedBatch.every((item) => item.quota)) {
      quotaHit = true;
      console.log(`Gemini quota exceeded; remaining ${label.toLowerCase()} use fallback.`);
    }
  }

  return { results, usedGemini, quotaHit };
}

export async function runDeskPipeline(): Promise<PipelineResult> {
  loadEnv();
  const rawLeads = loadRawLeads();
  const cleaned = markDuplicates(rawLeads.map(cleanLead));
  const apiKey = getGeminiApiKey();
  const classifications: Record<string, ClassificationHint> = {};
  const stepModes: PipelineStepModes = {
    classify: "rules",
    enrich: "fallback",
    outreach: "fallback"
  };
  let mode: "rules" | "llm" = "rules";
  let model = apiKey ? getGeminiModel() : "none";
  let quotaExhausted = false;
  let geminiStatus: "ai" | "missing_key" | "quota" | "error" = apiKey ? "ai" : "missing_key";

  if (apiKey) {
    model = getGeminiModel();
    const unique = cleaned.filter((lead) => !lead.isDuplicate);
    const classifyStep = await mapWithQuotaStop(
      unique,
      async (lead) => {
        const classified = await classifyLead(lead);
        const usedGemini = classified.model !== "fallback";
        const quota = !usedGemini && /429|quota/i.test(classified.reason);
        return { lead: classified, usedGemini, quota };
      },
      (lead) => ({
        lead: {
          ...lead,
          relevant: "Uncertain" as const,
          reason: "Gemini quota exceeded; remaining unique leads use rules labels.",
          confidence: 0,
          criteria: ["fallback"],
          reviewRequired: true,
          reviewReasons: ["Gemini failed; do not auto-accept."],
          contradictionFlags: [],
          model: "fallback",
          pipelineStep: "phase3-gemini" as const
        },
        usedGemini: false,
        quota: true
      }),
      "Classified"
    );
    for (const item of classifyStep.results) {
      if (!item.usedGemini) continue;
      classifications[item.lead.lead_id] = {
        relevant: item.lead.relevant,
        reason: item.lead.reason,
        confidence: item.lead.confidence
      };
    }
    stepModes.classify = classifyStep.usedGemini > 0 ? "ai" : "rules";
    quotaExhausted = classifyStep.quotaHit;
    console.log(
      `Classify mode: ${stepModes.classify === "ai" ? "AI" : "rules"} · model ${model} · live labels ${classifyStep.usedGemini}/${unique.length}`
    );
  } else {
    console.log("Classify mode: rules · GEMINI_API_KEY is missing on this server.");
  }

  const uniqueClean = cleaned.filter((lead) => !lead.isDuplicate);
  let enriched: EnrichedLead[];
  if (apiKey && !quotaExhausted) {
    const enrichStep = await mapWithQuotaStop(
      uniqueClean,
      (lead) => enrichLeadWithGemini(lead),
      (lead) => ({ lead: toEnrichedLead(lead), usedGemini: false, quota: true }),
      "Enriched"
    );
    const byId = Object.fromEntries(enrichStep.results.map((item) => [item.lead.lead_id, item.lead]));
    enriched = cleaned.map((lead) => byId[lead.lead_id] || toEnrichedLead(lead));
    stepModes.enrich = enrichStep.usedGemini > 0 ? "ai" : "fallback";
    quotaExhausted = quotaExhausted || enrichStep.quotaHit;
    console.log(
      `Enrich mode: ${stepModes.enrich === "ai" ? "AI" : "fallback"} · model ${model} · live rows ${enrichStep.usedGemini}/${uniqueClean.length}`
    );
  } else {
    enriched = cleaned.map(toEnrichedLead);
    console.log(`Enrich mode: fallback · model ${model}`);
  }

  const reviewed = runPhase5(enriched, classifications).leads;
  const prioritized = runPhase6(reviewed).leads;

  let outreached: OutreachedLead[];
  const eligible = prioritized.filter((lead) => !lead.isDuplicate && lead.relevant === "Relevant");
  if (apiKey && !quotaExhausted) {
    const outreachStep = await mapWithQuotaStop(
      eligible,
      (lead) => writeOutreachWithGemini(lead),
      (lead) => ({ lead: toOutreachedLead(lead), usedGemini: false, quota: true }),
      "Outreach"
    );
    const byId = Object.fromEntries(outreachStep.results.map((item) => [item.lead.lead_id, item.lead]));
    outreached = prioritized.map((lead) => byId[lead.lead_id] || toOutreachedLead(lead));
    stepModes.outreach = outreachStep.usedGemini > 0 ? "ai" : "fallback";
    console.log(
      `Outreach mode: ${stepModes.outreach === "ai" ? "AI" : "fallback"} · model ${model} · live drafts ${outreachStep.usedGemini}/${eligible.length}`
    );
  } else {
    outreached = prioritized.map(toOutreachedLead);
    console.log(`Outreach mode: fallback · model ${model}`);
  }

  mode = stepModes.classify === "ai" || stepModes.enrich === "ai" || stepModes.outreach === "ai" ? "llm" : "rules";
  if (!apiKey) geminiStatus = "missing_key";
  else if (quotaExhausted && mode === "rules") geminiStatus = "quota";
  else if (mode === "llm") geminiStatus = "ai";
  else geminiStatus = "error";

  const fallbackWhy = !apiKey
    ? "GEMINI_API_KEY is not set on this server. Add it in Render → Environment (or local .env), restart, then re-run."
    : quotaExhausted
      ? `Gemini quota was hit. Configured model: ${model}. Wait, then re-run once.`
      : `Gemini did not return live output. Configured model: ${model}.`;

  const dataset = assembleDataset(outreached, new Date().toISOString(), mode, model);
  const evaluation = evaluateAgainstNotes(dataset.leads);

  return {
    generatedAt: dataset.generatedAt,
    asOfDate: dataset.asOfDate,
    mode,
    model,
    stepModes,
    geminiStatus,
    inputCount: dataset.inputCount,
    uniquePeople: dataset.uniquePeople,
    relevantCount: dataset.relevantCount,
    reviewCount: dataset.reviewCount,
    repairedCount: 0,
    duplicateCount: dataset.duplicateCount,
    steps: dataset.steps.map((step) => {
      if (step.id === "classify") {
        return {
          ...step,
          title: "Classify (Gemini)",
          summary:
            stepModes.classify === "ai"
              ? `AI classification with ${model}. Reason and confidence are per lead.`
              : `Rules classification. ${fallbackWhy}`
        };
      }
      if (step.id === "enrich") {
        return {
          ...step,
          title: "Enrich (Gemini)",
          summary:
            stepModes.enrich === "ai"
              ? `AI enrichment with ${model}. Signals used only if Gemini fails.`
              : `Fallback signals. ${fallbackWhy}`
        };
      }
      if (step.id === "outreach") {
        return {
          ...step,
          title: "Outreach (Gemini)",
          summary:
            stepModes.outreach === "ai"
              ? `AI drafts with ${model}, passed through criticOutreach. Failed QC goes to review.`
              : `Fallback templates. ${fallbackWhy}`
        };
      }
      return step;
    }),
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
