import assert from "node:assert/strict";
import { test } from "node:test";
import { attachEnrichment, enrichLead, toEnrichedLead } from "./enrich";
import { parseEnrichment } from "./geminiEnrich";
import { runPhase4FromSnapshot, validatePhase4 } from "./run";
import type { EnrichedLead } from "./types";

function byId(leads: EnrichedLead[], id: string): EnrichedLead {
  const lead = leads.find((row) => row.lead_id === id);
  assert.ok(lead, `Missing ${id}`);
  return lead;
}

test("Phase 4 quality gate: every row has sales context fields", () => {
  const result = runPhase4FromSnapshot();
  assert.equal(result.quality.ok, true);
  assert.equal(result.leads.length, 30);
  for (const lead of result.leads) {
    assert.equal(lead.pipelineStep, "phase4-enrich");
    if (lead.isDuplicate) {
      assert.equal(lead.profile, "");
      assert.equal(lead.intent, "");
      continue;
    }
    const notRelevant = lead.signals.nonHealthcare || lead.signals.wantsCanada || lead.signals.wantsUk;
    assert.ok(lead.profile.includes(lead.displayName));
    assert.ok(lead.intent.length > 5);
    if (notRelevant) assert.equal(lead.needs, "");
    else assert.ok(lead.needs.length > 5);
    assert.ok(lead.objections.length > 5);
    assert.ok(lead.missingInformation.length > 5);
    assert.ok(lead.opportunity.length > 5);
    assert.ok(lead.nextAction.length > 5);
  }
});

test("Phase 4: L013 Kavya is ready now and needs a call plus documents", () => {
  const kavya = byId(runPhase4FromSnapshot().leads, "L013");
  assert.match(kavya.intent, /Ready to start/i);
  assert.match(kavya.needs, /document/i);
  assert.match(kavya.nextAction, /Call within 24 hours/i);
});

test("Phase 4: L030 Karan does not invent a job guarantee", () => {
  const karan = byId(runPhase4FromSnapshot().leads, "L030");
  assert.match(karan.objections, /guarantee/i);
  assert.match(karan.needs, /No guarantee language/i);
  assert.match(karan.nextAction, /cannot promise/i);
  const blob = `${karan.opportunity} ${karan.nextAction} ${karan.needs}`;
  assert.doesNotMatch(blob, /guarantee you a job|guaranteed job|₹\d/i);
});

test("Phase 4: L006 Sneha has an installment / price objection", () => {
  const sneha = byId(runPhase4FromSnapshot().leads, "L006");
  assert.match(sneha.objections, /installment/i);
  assert.match(sneha.needs, /fee/i);
});

test("Phase 4: L015 Meera is a nurture, not a push close", () => {
  const meera = byId(runPhase4FromSnapshot().leads, "L015");
  assert.match(meera.objections, /cannot pay now/i);
  assert.match(meera.opportunity, /nurture/i);
  assert.match(meera.nextAction, /30-day/i);
});

test("Phase 4: L002 difficult does not match ICU; L009 still does", () => {
  const leads = runPhase4FromSnapshot().leads;
  const rahul = byId(leads, "L002");
  assert.match(rahul.conversation, /difficult/i);
  assert.equal(rahul.signals.icu, false);
  assert.doesNotMatch(rahul.profile, /ICU/i);
  assert.equal(byId(leads, "L009").signals.icu, true);
});

test("Phase 4: L009 Ritika is a B2 ICU placement conversation", () => {
  const ritika = byId(runPhase4FromSnapshot().leads, "L009");
  assert.match(ritika.profile, /ICU/i);
  assert.match(ritika.intent, /Job-ready/i);
  assert.ok(ritika.sources.some((source) => source.includes("skillcase.info")));
});

test("Phase 4: L016 Farhan gets allied-health sources, not a nurse pitch", () => {
  const farhan = byId(runPhase4FromSnapshot().leads, "L016");
  assert.match(farhan.opportunity, /allied-health/i);
  assert.ok(farhan.sources.some((source) => source.includes("create-account-new")));
});

test("Phase 4: L028 is a duplicate and gets no enrichment", () => {
  const priya = byId(runPhase4FromSnapshot().leads, "L028");
  assert.equal(priya.profile, "");
  assert.equal(priya.intent, "");
  assert.match(priya.nextAction, /L001/i);
});

test("Phase 4: L007 and L029 keep the missing-field truth from Phase 2", () => {
  const leads = runPhase4FromSnapshot().leads;
  const arjun = byId(leads, "L007");
  const deepa = byId(leads, "L029");
  assert.match(arjun.missingInformation, /experience/i);
  assert.equal(arjun.experience, "");
  assert.match(deepa.missingInformation, /email/i);
  assert.equal(deepa.email, "");
  assert.match(deepa.nextAction, /WhatsApp/i);
});

test("Phase 4: L011 objection is an experience requirement question", () => {
  const divya = byId(runPhase4FromSnapshot().leads, "L011");
  assert.equal(divya.objections, "experience requirement question");
});

test("Phase 4: Not Relevant leads have no sales need", () => {
  const leads = runPhase4FromSnapshot().leads;
  for (const id of ["L005", "L012", "L020", "L025"]) {
    assert.equal(byId(leads, id).needs, "");
  }
});

test("Phase 4 quality gate fails if a required field is blank", () => {
  const leads = runPhase4FromSnapshot().leads.map((lead) =>
    lead.lead_id === "L001" ? { ...lead, intent: "" } : lead
  );
  const quality = validatePhase4(leads);
  assert.equal(quality.ok, false);
  assert.ok(quality.errors.some((error) => /L001/.test(error)));
});

test("Phase 4: signal path records fallback; Gemini parse rejects empty fields", () => {
  const leads = runPhase4FromSnapshot().leads;
  assert.ok(leads.every((lead) => lead.enrichmentPath === "fallback"));
  assert.equal(toEnrichedLead(leads[0]).enrichmentPath, "fallback");

  const parsed = parseEnrichment({
    profile: "Priya is a BSc Nursing professional in Bangalore.",
    intent: "Wants a Germany pathway.",
    needs: "Book a counsellor call.",
    objections: "Cost uncertainty.",
    missingInformation: "Preferred call time.",
    opportunity: "Language-plus-pathway sale.",
    nextAction: "Call this week.",
    sources: ["Skillcase teaches healthcare-focused German — https://skillcase.in/"]
  });
  assert.equal(parsed.intent, "Wants a Germany pathway.");
  assert.throws(() => parseEnrichment({ profile: "only profile" }), /missing/i);

  const notFit = attachEnrichment(
    leads.find((lead) => lead.lead_id === "L005")!,
    { ...parsed, needs: "Sell a nurse course." },
    "ai"
  );
  assert.equal(notFit.needs, "");
  assert.equal(notFit.enrichmentPath, "ai");
});

test("Phase 4 enrichLead: public sources include a URL when used", () => {
  const result = runPhase4FromSnapshot();
  const withSources = result.leads.filter((lead) => lead.sources.length);
  assert.ok(withSources.length > 0);
  assert.ok(withSources.every((lead) => lead.sources.every((source) => /https?:\/\//.test(source))));
  assert.doesNotThrow(() => enrichLead(result.leads[0]));
});
