import assert from "node:assert/strict";
import { test } from "node:test";
import { runPhase5FromSnapshot } from "../phase-5-qc/run";
import {
  assignCallOrder,
  bandForScore,
  inferRelevance,
  prioritizeLead,
  recencyPoints,
  scoreBreakdownSum,
  toPrioritizedLead
} from "./prioritize";
import { reasonCitesLead } from "./reason";
import { runPhase6, runPhase6FromSnapshot, validatePhase6 } from "./run";
import { AS_OF_DATE, HIGH_MIN, MEDIUM_MIN, OUT_OF_ICP_SCORE } from "./scorecard";
import type { PrioritizedLead } from "./types";

function byId(leads: PrioritizedLead[], id: string): PrioritizedLead {
  const lead = leads.find((row) => row.lead_id === id);
  assert.ok(lead, `Missing ${id}`);
  return lead;
}

test("Phase 6 quality gate: unique rows have a 0–100 score; duplicates do not", () => {
  const result = runPhase6FromSnapshot();
  assert.equal(result.quality.ok, true);
  assert.equal(result.leads.length, 30);
  assert.equal(result.quality.duplicateLowCount, 3);
  assert.ok(result.quality.highCount >= 1);
  for (const lead of result.leads) {
    assert.equal(lead.pipelineStep, "phase6-prioritize");
    if (lead.isDuplicate) {
      assert.equal(lead.score, null);
      assert.equal(lead.band, "");
      continue;
    }
    assert.ok((lead.score ?? -1) >= 0 && (lead.score ?? 0) <= 100);
    assert.ok(["High", "Medium", "Low"].includes(lead.band));
    assert.equal(lead.score, Math.max(0, Math.min(100, scoreBreakdownSum(lead.breakdown))));
  }
});

test("Phase 6: duplicates have no score and are labeled Duplicate of <id>", () => {
  const leads = runPhase6FromSnapshot().leads;
  for (const id of ["L008", "L021", "L028"]) {
    const copy = byId(leads, id);
    assert.equal(copy.isDuplicate, true);
    assert.equal(copy.band, "");
    assert.equal(copy.score, null);
    assert.match(String(copy.relevant), /^Duplicate of /);
    assert.equal(copy.dialSuppressed, true);
    assert.equal(copy.callOrder, null);
    assert.match(copy.nextAction, /suppress/i);
  }
  assert.equal(byId(leads, "L028").duplicateOf, "L001");
  assert.equal(byId(leads, "L008").duplicateOf, "L001");
  assert.equal(byId(leads, "L021").duplicateOf, "L004");
});

test("Phase 6: L021 would be High if it were not a duplicate of L004", () => {
  const reviewed = runPhase5FromSnapshot().leads.find((lead) => lead.lead_id === "L021");
  assert.ok(reviewed);
  const asUnique = prioritizeLead({ ...reviewed, isDuplicate: false, duplicateOf: null });
  assert.equal(asUnique.band, "High");
  assert.ok(asUnique.score >= HIGH_MIN);
  const asCopy = prioritizeLead(reviewed);
  assert.equal(asCopy.band, "");
  assert.equal(asCopy.score, null);
});

test("Phase 6: unique Relevant B2 job-ready nurses are High", () => {
  const leads = runPhase6FromSnapshot().leads;
  for (const id of ["L004", "L009", "L019", "L024"]) {
    const lead = byId(leads, id);
    assert.equal(lead.relevant, "Relevant");
    assert.equal(lead.band, "High");
    assert.ok(lead.score >= HIGH_MIN);
    assert.ok(lead.callOrder !== null);
    assert.equal(lead.dialSuppressed, false);
  }
  const ritika = byId(leads, "L009");
  assert.equal(ritika.breakdown.german, 28);
  assert.equal(ritika.breakdown.experience, 18);
  assert.equal(ritika.breakdown.intent, 30);
  const pooja = byId(leads, "L024");
  assert.equal(pooja.name, "Pooja Reddy");
  assert.equal(pooja.breakdown.german, 28);
  assert.equal(pooja.breakdown.experience, 18);
  assert.equal(pooja.breakdown.intent, 30);
  assert.ok((pooja.score ?? 0) >= 88);
});

test("Phase 6: L013 Kavya is High because she asked for a call tomorrow", () => {
  const kavya = byId(runPhase6FromSnapshot().leads, "L013");
  assert.equal(kavya.relevant, "Relevant");
  assert.equal(kavya.band, "High");
  assert.equal(kavya.breakdown.intent, 30);
  assert.ok(kavya.score >= HIGH_MIN);
});

test("Phase 6: Not Relevant rows are Low and never High", () => {
  const leads = runPhase6FromSnapshot().leads;
  for (const id of ["L005", "L012", "L020", "L025"]) {
    const lead = byId(leads, id);
    assert.equal(lead.relevant, "Not Relevant");
    assert.equal(lead.band, "Low");
    assert.equal(lead.score, OUT_OF_ICP_SCORE);
    assert.equal(lead.callOrder, null);
  }
  assert.ok(leads.every((lead) => lead.relevant === "Relevant" || lead.band !== "High"));
});

test("Phase 6: L015 cannot-afford and L006 installment penalties apply", () => {
  const leads = runPhase6FromSnapshot().leads;
  const meera = byId(leads, "L015");
  const sneha = byId(leads, "L006");
  assert.equal(meera.breakdown.intent, 6);
  assert.equal(meera.breakdown.penalty, -8);
  assert.equal(meera.band, "Low");
  assert.equal(sneha.breakdown.penalty, -3);
  assert.ok(sneha.score >= MEDIUM_MIN);
  assert.ok(sneha.score < HIGH_MIN);
  assert.equal(sneha.band, "Medium");
});

test("Phase 6: L029 missing-email penalty and L030 job-guarantee penalty", () => {
  const leads = runPhase6FromSnapshot().leads;
  const deepa = byId(leads, "L029");
  const karan = byId(leads, "L030");
  assert.equal(deepa.email, "");
  assert.equal(deepa.breakdown.completeness, 0);
  assert.equal(deepa.breakdown.penalty, -8);
  assert.equal(karan.breakdown.penalty, -4);
  assert.match(karan.rationale, /penalty=-4/);
});

test("Phase 6: recency is measured against 23 Sep 2026", () => {
  assert.equal(AS_OF_DATE, "2026-09-23");
  assert.equal(recencyPoints("2026-09-21"), 10);
  assert.equal(recencyPoints("2026-09-20"), 10);
  assert.equal(recencyPoints("2026-09-17"), 7);
  assert.equal(recencyPoints("2026-09-13"), 4);
  assert.equal(recencyPoints("2026-09-09"), 2);
  assert.equal(recencyPoints(""), 0);
  assert.equal(bandForScore(70), "High");
  assert.equal(bandForScore(69), "Medium");
  assert.equal(bandForScore(45), "Medium");
  assert.equal(bandForScore(44), "Low");
});

test("Phase 6: call list is unique Relevant leads in score order", () => {
  const result = runPhase6FromSnapshot();
  assert.ok(result.callList.length >= 1);
  assert.ok(result.callList.every((lead) => lead.relevant === "Relevant" && !lead.isDuplicate && !lead.reviewRequired));
  const orders = result.callList.map((lead) => lead.callOrder);
  assert.deepEqual(orders, [...orders].sort((a, b) => (a ?? 0) - (b ?? 0)));
  for (let i = 1; i < result.callList.length; i++) {
    assert.ok(result.callList[i - 1].score >= result.callList[i].score);
  }
  assert.equal(result.callList[0].callOrder, 1);
});

test("Phase 6: review-held leads are not on Call first until accepted", () => {
  const result = runPhase6FromSnapshot();
  for (const id of ["L014", "L029", "L030"]) {
    const lead = byId(result.leads, id);
    assert.equal(lead.reviewRequired, true);
    assert.equal(lead.callOrder, null);
    assert.equal(result.callList.some((row) => row.lead_id === id), false);
  }
  const accepted = result.leads.map((lead) =>
    lead.lead_id === "L030" ? { ...lead, accepted: true, reviewRequired: true } : lead
  );
  const resorted = assignCallOrder(accepted);
  assert.ok(resorted.find((lead) => lead.lead_id === "L030")?.callOrder !== null);
});

test("Phase 6 quality gate fails if a duplicate is ranked High", () => {
  const leads = runPhase6FromSnapshot().leads.map((lead) =>
    lead.lead_id === "L028" ? { ...lead, band: "High" as const, score: 88, dialSuppressed: false, relevant: "Relevant" } : lead
  );
  const quality = validatePhase6(leads);
  assert.equal(quality.ok, false);
  assert.ok(quality.errors.some((error) => /L028/.test(error)));
});

test("Phase 6: reason cites a lead detail and confidence is not a category constant", () => {
  const leads = runPhase6FromSnapshot().leads;
  const unique = leads.filter((lead) => !lead.isDuplicate);
  const reasons = new Set(unique.map((lead) => lead.reason));
  const relevantConf = unique.filter((lead) => lead.relevant === "Relevant").map((lead) => lead.confidence);
  for (const lead of unique) {
    assert.ok(reasonCitesLead(lead.reason, lead), `${lead.lead_id} reason=${lead.reason}`);
    assert.doesNotMatch(lead.reason, /Nursing profile with a Germany or Germany-linked goal/);
    assert.ok(lead.confidence > 0 && lead.confidence <= 1);
  }
  assert.ok(reasons.size >= unique.length - 1);
  assert.ok(new Set(relevantConf).size >= 3);
  const kavya = byId(leads, "L013");
  assert.match(kavya.reason, /Bangalore|tomorrow|Kavya|BSc Nursing/i);
  const amit = byId(leads, "L005");
  assert.match(amit.reason, /BBA|Mumbai|Amit/i);
});

test("Phase 6 runPhase6: same contract from Phase 5 output", () => {
  const result = runPhase6(runPhase5FromSnapshot().leads);
  assert.equal(result.quality.ok, true);
  const farhan = byId(result.leads, "L016");
  assert.equal(inferRelevance(farhan), "Uncertain");
  assert.ok(farhan.band !== "High");
  assert.equal(toPrioritizedLead(farhan).pipelineStep, "phase6-prioritize");
});
