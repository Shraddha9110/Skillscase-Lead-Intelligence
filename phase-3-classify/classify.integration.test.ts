import assert from "node:assert/strict";
import { test } from "node:test";
import { runPhase2FromSnapshot } from "../phase-2-clean/run";
import type { CleanLead } from "../phase-2-clean/types";
import { classifyLead } from "./classify";
import { getGeminiApiKey, loadEnv } from "./env";
import type { ClassifiedLead, Relevance } from "./types";

loadEnv();
const apiKey = getGeminiApiKey();

function pick(leads: CleanLead[], id: string): CleanLead {
  const lead = leads.find((row) => row.lead_id === id);
  assert.ok(lead, `Missing ${id}`);
  return lead;
}

test("Phase 3 integration: GEMINI_API_KEY is loaded from .env", { skip: !apiKey }, () => {
  assert.ok(apiKey.length > 8);
  assert.doesNotMatch(apiKey, /\s/);
});

test(
  "Phase 3 integration: Gemini classifies representative cleaned leads",
  { skip: !apiKey },
  async () => {
    const cleaned = runPhase2FromSnapshot().leads;
    const expected: Record<string, Relevance> = {
      L005: "Not Relevant",
      L004: "Relevant"
    };

    const results: ClassifiedLead[] = [];
    for (const id of Object.keys(expected)) {
      const classified = await classifyLead(pick(cleaned, id));
      results.push(classified);
      await new Promise((resolve) => setTimeout(resolve, 1200));
    }

    const connected = results.filter((lead) => lead.model !== "fallback");
    if (!connected.length) {
      const last = results[results.length - 1]?.reason || "";
      assert.match(
        last,
        /429|503/,
        `Gemini key was rejected or unreachable. Last reason: ${last}`
      );
      return;
    }

    for (const lead of connected) {
      assert.equal(lead.relevant, expected[lead.lead_id], `${lead.lead_id} → ${lead.relevant} (${lead.reason})`);
      assert.ok(lead.reason.length > 8);
      assert.ok(lead.confidence >= 0 && lead.confidence <= 1);
    }
  }
);
