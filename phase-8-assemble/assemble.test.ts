import assert from "node:assert/strict";
import { mkdtempSync, readFileSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { test } from "node:test";
import { runPhase7FromSnapshot } from "../phase-7-outreach/run";
import { assembleDataset } from "./assemble";
import { parseProcessedCsv, toCsv, writeOutputs } from "./export";
import { runPhase8, runPhase8FromSnapshot, validatePhase8 } from "./run";
import { SLIDES } from "./slides";
import { missingUiSurfaces } from "./ui";
import { OUTPUT_COLUMNS, type ProcessedLead } from "./types";

function byId(leads: ProcessedLead[], id: string): ProcessedLead {
  const lead = leads.find((row) => row.lead_id === id);
  assert.ok(lead, `Missing ${id}`);
  return lead;
}

test("Phase 8 quality gate: all 30 ids assembled with the output schema", () => {
  const result = runPhase8FromSnapshot();
  assert.equal(result.quality.ok, true);
  assert.equal(result.leads.length, 30);
  assert.equal(result.quality.uniquePeople, 27);
  assert.equal(result.dataset.asOfDate, "2026-09-23");
  assert.equal(result.dataset.steps.length, 8);
  const ids = result.leads.map((lead) => lead.lead_id);
  assert.deepEqual(ids, Array.from({ length: 30 }, (_, index) => `L${String(index + 1).padStart(3, "0")}`));
  for (const lead of result.leads) {
    if (lead.is_duplicate) {
      assert.equal(lead.profile, "");
      assert.equal(lead.priority_score, null);
      assert.match(String(lead.relevant), /^Duplicate of /);
      continue;
    }
    assert.ok(lead.profile.length > 5);
    assert.ok(lead.intent.length > 5);
    assert.ok(["High", "Medium", "Low"].includes(lead.priority));
    assert.ok((lead.priority_score ?? -1) >= 0 && (lead.priority_score ?? 0) <= 100);
  }
});

test("Phase 8: duplicates are kept, not deleted, and get no outreach", () => {
  const leads = runPhase8FromSnapshot().leads;
  const copies = ["L008", "L021", "L028"].map((id) => byId(leads, id));
  assert.ok(copies.every((lead) => lead.is_duplicate && lead.outreach === "" && lead.priority_score === null));
  assert.equal(byId(leads, "L028").duplicate_of, "L001");
  assert.equal(byId(leads, "L008").duplicate_of, "L001");
  assert.equal(byId(leads, "L021").duplicate_of, "L004");
});

test("Phase 8: showcase QC rows survive into the final list", () => {
  const result = runPhase8FromSnapshot();
  const deepa = byId(result.leads, "L029");
  const farhan = byId(result.leads, "L016");
  const arjun = byId(result.leads, "L007");
  assert.equal(deepa.email, "");
  assert.equal(deepa.review_required, true);
  assert.equal(deepa.city, "Chennai");
  assert.equal(farhan.review_required, true);
  assert.equal(arjun.experience, "");
  assert.equal(result.dataset.qcExamples.length, 4);
  assert.deepEqual(
    result.dataset.qcExamples.map((example) => example.leadId),
    ["L029", "L028", "L016", "L007"]
  );
});

test("Phase 8: L011 objection and Not Relevant leads have no sales need", () => {
  const leads = runPhase8FromSnapshot().leads;
  assert.equal(byId(leads, "L011").objection, "experience requirement question");
  for (const id of ["L005", "L012", "L020", "L025"]) {
    assert.equal(byId(leads, id).need, "");
    assert.equal(byId(leads, id).relevant, "Not Relevant");
  }
  assert.equal(byId(leads, "L008").priority, "");
});

test("Phase 8: Not Relevant is never High and never messaged", () => {
  const leads = runPhase8FromSnapshot().leads;
  for (const id of ["L005", "L012", "L020", "L025"]) {
    const lead = byId(leads, id);
    assert.equal(lead.relevant, "Not Relevant");
    assert.equal(lead.priority, "Low");
    assert.equal(lead.outreach, "");
  }
  assert.ok(leads.every((lead) => lead.relevant === "Relevant" || lead.priority !== "High"));
});

test("Phase 8: reason is lead-specific and confidence is not a category default", () => {
  const leads = runPhase8FromSnapshot().leads.filter((lead) => !lead.is_duplicate);
  const relevant = leads.filter((lead) => lead.relevant === "Relevant");
  assert.ok(new Set(leads.map((lead) => lead.reason)).size >= leads.length - 1);
  assert.ok(new Set(relevant.map((lead) => lead.confidence)).size >= 3);
  assert.ok(!relevant.every((lead) => lead.confidence === 0.82));
  assert.match(byId(runPhase8FromSnapshot().leads, "L013").reason, /Bangalore|tomorrow|Kavya/i);
});

test("Phase 8: unique Relevant B2 nurses keep a scored draft", () => {
  const ritika = byId(runPhase8FromSnapshot().leads, "L009");
  assert.equal(ritika.relevant, "Relevant");
  assert.equal(ritika.priority, "High");
  assert.match(ritika.outreach, /Kolkata/);
  assert.match(ritika.outreach, /ICU/);
  assert.doesNotMatch(ritika.outreach, /guarantee you a job|₹/);
});

test("Phase 8: CSV and JSON export all 30 rows and round-trip", () => {
  const result = runPhase8FromSnapshot();
  const dir = mkdtempSync(join(tmpdir(), "phase8-"));
  const paths = writeOutputs(result.dataset, dir);
  const csv = readFileSync(paths.csvPath, "utf8");
  const json = JSON.parse(readFileSync(paths.jsonPath, "utf8"));
  const rows = parseProcessedCsv(csv);
  assert.equal(rows.length, 30);
  assert.equal(json.leads.length, 30);
  assert.ok(csv.startsWith("\uFEFFlead_id"));
  assert.ok(OUTPUT_COLUMNS.every((column) => csv.includes(column)));
  assert.equal(rows.find((row) => row.lead_id === "L028")?.outreach, "");
  assert.equal(rows.find((row) => row.lead_id === "L029")?.email, "");
  assert.equal(toCsv(result.leads).split("\n").length, 31);
});

test("Phase 8: counsellor UI and exactly 5 slides are part of the contract", () => {
  const missing = missingUiSurfaces();
  assert.deepEqual(missing, []);
  assert.equal(SLIDES.length, 5);
  assert.deepEqual(
    SLIDES.map((slide) => slide.kicker),
    ["01 · Input", "02 · Architecture", "03 · AI processing", "04 · Quality checks", "05 · Final output"]
  );
});

test("Phase 8 quality gate fails if an id is dropped", () => {
  const leads = runPhase8FromSnapshot().leads.filter((lead) => lead.lead_id !== "L029");
  const quality = validatePhase8(leads);
  assert.equal(quality.ok, false);
  assert.ok(quality.errors.some((error) => /L029/.test(error)));
});

test("Phase 8 runPhase8: same contract from Phase 7 output", () => {
  const result = runPhase8(runPhase7FromSnapshot().leads);
  assert.equal(result.quality.ok, true);
  assert.ok(result.quality.draftCount >= 1);
  assert.ok(result.quality.reviewCount >= 4);
  assert.equal(assembleDataset(runPhase7FromSnapshot().leads).inputCount, 30);
});
