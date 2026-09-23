import { mkdirSync, writeFileSync } from "fs";
import { join } from "path";
import { OUTPUT_COLUMNS, toCsv } from "../src/lib/csv";
import { loadRawLeads } from "../src/lib/load";
import { runPipeline } from "../src/lib/pipeline";

const root = process.cwd();

async function main() {
  const result = await runPipeline(loadRawLeads(), {
    apiKey: process.env.OPENAI_API_KEY || "",
    model: process.env.OPENAI_MODEL,
    baseUrl: process.env.OPENAI_BASE_URL
  });

  const outDir = join(root, "data", "processed");
  mkdirSync(outDir, { recursive: true });
  writeFileSync(join(outDir, "skillcase_leads_enriched.json"), JSON.stringify(result, null, 2));
  writeFileSync(join(outDir, "skillcase_leads_enriched.csv"), toCsv(result.leads, OUTPUT_COLUMNS));

  console.log(`Processed ${result.inputCount} leads`);
  console.log(`Unique people: ${result.uniquePeople}`);
  console.log(`Relevant: ${result.relevantCount}`);
  console.log(`Duplicates: ${result.duplicateCount}`);
  console.log(`Repaired rows: ${result.repairedCount}`);
  console.log(`Human review: ${result.reviewCount}`);
  console.log(`Mode: ${result.mode}`);
  console.log(`Wrote data/processed/skillcase_leads_enriched.csv`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
