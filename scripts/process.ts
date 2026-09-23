import { join } from "path";
import { writeOutputs } from "../phase-8-assemble/export";
import type { PipelineDataset } from "../phase-8-assemble/types";
import { runDeskPipeline } from "../src/lib/runDesk";

async function main() {
  const result = await runDeskPipeline();
  const dataset: PipelineDataset = {
    generatedAt: result.generatedAt,
    asOfDate: result.asOfDate,
    mode: result.mode,
    model: result.model || result.mode,
    stepModes: result.stepModes,
    inputCount: result.inputCount,
    uniquePeople: result.uniquePeople,
    relevantCount: result.relevantCount,
    reviewCount: result.reviewCount,
    repairedCount: 0,
    duplicateCount: result.duplicateCount,
    draftCount: result.leads.filter((lead) => lead.outreach).length,
    steps: result.steps,
    qcExamples: result.qcExamples,
    leads: result.leads,
    relevanceCriteria: result.relevanceCriteria,
    priorityCriteria: result.priorityCriteria
  };
  writeOutputs(dataset, join(process.cwd(), "data", "processed"));
  writeOutputs(dataset, join(process.cwd(), "public", "data"));

  const steps = result.stepModes;
  console.log(`Processed ${result.inputCount} leads`);
  console.log(`Mode: ${result.mode === "llm" ? "AI" : "rules"}`);
  console.log(`Model: ${result.model}`);
  console.log(
    `Steps: classify ${steps?.classify === "ai" ? "AI" : "rules"} · enrich ${steps?.enrich === "ai" ? "AI" : "fallback"} · outreach ${steps?.outreach === "ai" ? "AI" : "fallback"}`
  );
  console.log(`Unique people: ${result.uniquePeople}`);
  console.log(`Relevant: ${result.relevantCount}`);
  console.log(`Duplicates: ${result.duplicateCount}`);
  console.log(`Human review: ${result.reviewCount}`);
  console.log(`Note agreement: ${result.evaluation?.agreementRate ?? "—"}%`);
  console.log(`Wrote data/processed/skillcase_leads_enriched.csv`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
