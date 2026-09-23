import assert from "node:assert/strict";
import { test } from "node:test";
import { runPhase4FromSnapshot } from "../phase-4-enrich/run";
import { QC_EXAMPLES } from "./examples";
import { reviewLead, setQueueDecision, toReviewedLead } from "./review";
import { runPhase5, runPhase5FromSnapshot, validatePhase5 } from "./run";
import type { ReviewedLead } from "./types";

function byId(leads: ReviewedLead[], id: string): ReviewedLead {
  const lead = leads.find((row) => row.lead_id === id);
  assert.ok(lead, `Missing ${id}`);
  return lead;
}

test("Phase 5 quality gate: four showcase problems are queued, not auto-sent", () => {
  const result = runPhase5FromSnapshot();
  assert.equal(result.quality.ok, true);
  assert.equal(result.leads.length, 30);
  assert.ok(result.quality.reviewCount >= 4);
  assert.equal(result.examples.length, 4);
  assert.deepEqual(
    result.examples.map((example) => example.leadId),
    ["L029", "L028", "L016", "L007"]
  );
  assert.ok(result.queue.every((lead) => lead.queueStatus === "pending"));
  assert.ok(result.queue.every((lead) => lead.accepted === false));
});

test("Phase 5: L029 Deepa — missing email, not a column shift", () => {
  const deepa = byId(runPhase5FromSnapshot().leads, "L029");
  assert.equal(deepa.reviewRequired, true);
  assert.equal(deepa.email, "");
  assert.ok(deepa.reviewReasons.some((reason) => /contact/i.test(reason)));
  assert.ok(deepa.reviewReasons.every((reason) => !/column/i.test(reason)));
  assert.equal(deepa.showcaseId, "qc-1");
});

test("Phase 5: L014 GNM goes to human review for qualification recognition", () => {
  const sanjay = byId(runPhase5FromSnapshot().leads, "L014");
  assert.equal(sanjay.reviewRequired, true);
  assert.ok(sanjay.reviewReasons.some((reason) => /qualification recognition check needed/i.test(reason)));
});

test("Phase 5: L030 is queued for job-guarantee expectation risk", () => {
  const karan = byId(runPhase5FromSnapshot().leads, "L030");
  assert.equal(karan.reviewRequired, true);
  assert.ok(karan.reviewReasons.some((reason) => /job-guarantee expectation risk/i.test(reason)));
  assert.equal(karan.accepted, false);
  assert.equal(karan.queueStatus, "pending");
});

test("Phase 5: L025 Not Relevant GNM is not on the recognition check", () => {
  const raj = byId(runPhase5FromSnapshot().leads, "L025");
  assert.ok(raj.reviewReasons.every((reason) => !/qualification recognition/i.test(reason)));
  assert.ok(raj.signals.wantsUk);
});

test("Phase 5: L028 Priya S. — fuzzy duplicate of L001", () => {
  const priya = byId(runPhase5FromSnapshot().leads, "L028");
  assert.equal(priya.reviewRequired, true);
  assert.equal(priya.duplicateOf, "L001");
  assert.ok(priya.criticNotes.some((note) => /Priya S/i.test(note)));
  assert.equal(priya.showcaseId, "qc-2");
});

test("Phase 5: L016 Farhan — CRM vs product eligibility", () => {
  const farhan = byId(runPhase5FromSnapshot().leads, "L016");
  assert.equal(farhan.reviewRequired, true);
  assert.ok(farhan.criticNotes.some((note) => /Pharmacists/i.test(note)));
  assert.equal(farhan.showcaseId, "qc-3");
});

test("Phase 5: L007 Arjun — experience must stay blank", () => {
  const arjun = byId(runPhase5FromSnapshot().leads, "L007");
  assert.equal(arjun.reviewRequired, true);
  assert.equal(arjun.experience, "");
  assert.ok(arjun.criticNotes.some((note) => /Do not invent years/i.test(note)));
  assert.equal(arjun.showcaseId, "qc-4");
});

test("Phase 5: invented guarantee in copy is a validation error", () => {
  const clean = runPhase4FromSnapshot().leads.find((lead) => lead.lead_id === "L001");
  assert.ok(clean);
  const broken = reviewLead({ ...clean, nextAction: "We guarantee you a job in Germany for ₹50000." });
  assert.equal(broken.reviewRequired, true);
  assert.ok(broken.validationErrors.some((error) => /guarantee or a price/i.test(error)));
});

test("Phase 5: low Gemini confidence is not auto-accepted", () => {
  const farhan = runPhase4FromSnapshot().leads.find((lead) => lead.lead_id === "L016");
  assert.ok(farhan);
  const review = reviewLead(farhan, {
    relevant: "Uncertain",
    reason: "Pharmacist track needs a human.",
    confidence: 0.62
  });
  assert.equal(review.reviewRequired, true);
  assert.ok(review.reviewReasons.some((reason) => /0.70/i.test(reason)));
  assert.equal(review.accepted, false);
});

test("Phase 5: human can accept or reject a queued row", () => {
  const deepa = byId(runPhase5FromSnapshot().leads, "L029");
  const held = setQueueDecision(deepa, "held");
  const rejected = setQueueDecision(deepa, "rejected");
  assert.equal(held.queueStatus, "held");
  assert.equal(held.accepted, false);
  assert.equal(rejected.queueStatus, "rejected");
});

test("Phase 5 quality gate fails if a showcase row leaves the queue", () => {
  const leads = runPhase5FromSnapshot().leads.map((lead) =>
    lead.lead_id === "L029" ? { ...lead, reviewRequired: false, email: "deepa@example.com" } : lead
  );
  const quality = validatePhase5(leads);
  assert.equal(quality.ok, false);
  assert.ok(quality.errors.some((error) => /L029/.test(error)));
});

test("Phase 5 runPhase5: same contract from Phase 4 output", () => {
  const result = runPhase5(runPhase4FromSnapshot().leads);
  assert.equal(result.quality.ok, true);
  assert.ok(QC_EXAMPLES.every((example) => result.leads.some((lead) => lead.lead_id === example.leadId)));
  assert.equal(toReviewedLead(result.leads[0]).pipelineStep, "phase5-qc");
});
