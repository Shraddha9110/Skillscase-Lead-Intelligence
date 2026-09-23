import assert from "node:assert/strict";
import { test } from "node:test";
import { runPhase2FromSnapshot } from "../phase-2-clean/run";
import { attachClassification, contradictionFlags, fallbackClassification, parseClassification } from "./classify";
import { getGeminiApiKey, loadEnv } from "./env";

test("Phase 3 parseClassification: accepts a valid Gemini payload", () => {
  const parsed = parseClassification({
    relevant: "Relevant",
    reason: "BSc nurse targeting Germany.",
    confidence: 0.91,
    criteria: ["nursing", "Germany"]
  });
  assert.equal(parsed.relevant, "Relevant");
  assert.equal(parsed.confidence, 0.91);
});

test("Phase 3 parseClassification: rejects a bad label", () => {
  assert.throws(() => parseClassification({ relevant: "maybe", reason: "x", confidence: 1 }));
});

test("Phase 3 fallback: Gemini failure becomes Uncertain + review", () => {
  const fallback = fallbackClassification(new Error("network down"));
  assert.equal(fallback.relevant, "Uncertain");
  assert.equal(fallback.confidence, 0);
  assert.match(fallback.reason, /Gemini classification failed/);

  const lead = runPhase2FromSnapshot().leads[0];
  const attached = attachClassification(lead, fallback, "fallback", true);
  assert.equal(attached.reviewRequired, true);
  assert.ok(attached.reviewReasons.some((reason) => /Gemini failed/.test(reason)));
});

test("Phase 3 rule check: BBA cannot be high-confidence Relevant", () => {
  const amit = runPhase2FromSnapshot().leads.find((lead) => lead.lead_id === "L005");
  assert.ok(amit);
  const flags = contradictionFlags(amit, {
    relevant: "Relevant",
    reason: "wants abroad",
    confidence: 0.9,
    criteria: []
  });
  assert.ok(flags.some((flag) => /non-healthcare/.test(flag)));
});

test("Phase 3 env: .env is gitignored and the key is not empty locally", () => {
  loadEnv();
  const key = getGeminiApiKey();
  assert.equal(typeof key, "string");
  if (key) {
    assert.ok(!key.startsWith("AIza") || key.length > 10);
    assert.ok(key.length > 8);
  }
});
