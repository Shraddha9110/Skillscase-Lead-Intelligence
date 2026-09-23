import { geminiJson, isQuotaError } from "../phase-3-classify/gemini";
import { ENRICH_SYSTEM } from "../src/lib/prompts";
import type { CleanLead } from "../phase-2-clean/types";
import { assertNoInventions, attachEnrichment, toEnrichedLead } from "./enrich";
import { formatSource, PRODUCT_SOURCES, type SourceKey } from "./sources";
import type { Enrichment, EnrichedLead } from "./types";

const REQUIRED: (keyof Enrichment)[] = [
  "profile",
  "intent",
  "objections",
  "missingInformation",
  "opportunity",
  "nextAction"
];

export function enrichUserPrompt(lead: CleanLead): string {
  const facts = (Object.keys(PRODUCT_SOURCES) as SourceKey[])
    .map((key) => `- ${formatSource(key)}`)
    .join("\n");
  return `Turn this cleaned Skillcase lead into sales context a counsellor can use.

lead_id: ${lead.lead_id}
name: ${lead.displayName}
city: ${lead.city}
education: ${lead.education}
experience: ${lead.experience}
goal: ${lead.goal}
german_level: ${lead.german_level}
source: ${lead.source}
last_contacted: ${lead.last_contacted}
conversation: ${lead.conversation}
missingFields: ${lead.missingFields.join(", ") || "none"}
qualityFlags: ${lead.qualityFlags.join("; ") || "none"}

Public Skillcase facts. Use only these if you cite product facts. Put each used fact in sources as "claim — URL":
${facts}

If the person is not a healthcare Germany fit, leave needs empty and write a short not-a-fit next action.
Do not invent employers, prices, visa outcomes, or a job guarantee.`;
}

export function parseEnrichment(input: unknown): Enrichment {
  const row = (input || {}) as Record<string, unknown>;
  const enrichment: Enrichment = {
    profile: String(row.profile || "").trim(),
    intent: String(row.intent || "").trim(),
    needs: String(row.needs || "").trim(),
    objections: String(row.objections || "").trim(),
    missingInformation: String(row.missingInformation || "").trim(),
    opportunity: String(row.opportunity || "").trim(),
    nextAction: String(row.nextAction || "").trim(),
    sources: Array.isArray(row.sources) ? row.sources.map((item) => String(item).trim()).filter(Boolean) : []
  };
  for (const field of REQUIRED) {
    if (!enrichment[field]) {
      throw new Error(`Enrichment is missing ${field}.`);
    }
  }
  return enrichment;
}

export interface GeminiEnrichResult {
  lead: EnrichedLead;
  usedGemini: boolean;
  quota: boolean;
}

export async function enrichLeadWithGemini(lead: CleanLead): Promise<GeminiEnrichResult> {
  if (lead.isDuplicate) {
    return { lead: toEnrichedLead(lead), usedGemini: false, quota: false };
  }
  try {
    const { data } = await geminiJson<unknown>(ENRICH_SYSTEM, enrichUserPrompt(lead));
    const enrichment = parseEnrichment(data);
    assertNoInventions(enrichment);
    return { lead: attachEnrichment(lead, enrichment, "ai"), usedGemini: true, quota: false };
  } catch (error) {
    return { lead: toEnrichedLead(lead), usedGemini: false, quota: isQuotaError(error) };
  }
}
