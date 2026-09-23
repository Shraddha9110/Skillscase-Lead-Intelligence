import assert from "node:assert/strict";
import { test } from "node:test";
import { ingestFromSnapshot } from "../phase-1-ingest/ingest";
import { cleanLead } from "./clean";
import { markDuplicates } from "./dedupe";
import { runPhase2, runPhase2FromSnapshot, validatePhase2 } from "./run";
import type { CleanLead } from "./types";

function byId(leads: CleanLead[], id: string): CleanLead {
  const lead = leads.find((row) => row.lead_id === id);
  assert.ok(lead, `Missing ${id}`);
  return lead;
}

test("Phase 2 quality gate: L029 city is Chennai and email is empty", () => {
  const deepa = byId(runPhase2FromSnapshot().leads, "L029");
  assert.equal(deepa.city, "Chennai");
  assert.equal(deepa.email, "");
  assert.equal(deepa.education, "BSc Nursing");
  assert.equal(deepa.experience, "3 years");
  assert.equal(deepa.goal, "Work in Germany");
  assert.equal(deepa.german_level, "B2");
  assert.equal(deepa.source, "Website");
  assert.equal(deepa.qualityFlags.some((flag) => flag.startsWith("column_shift")), false);
  assert.ok(deepa.missingFields.includes("email"));
  assert.ok(deepa.qualityFlags.some((flag) => flag.startsWith("missing:")));
});

test("Phase 2 quality gate: L001 / L008 / L028 are linked as one person", () => {
  const leads = runPhase2FromSnapshot().leads;
  const canonical = byId(leads, "L001");
  const exact = byId(leads, "L008");
  const fuzzy = byId(leads, "L028");

  assert.equal(canonical.isDuplicate, false);
  assert.equal(exact.isDuplicate, true);
  assert.equal(exact.duplicateOf, "L001");
  assert.equal(fuzzy.isDuplicate, true);
  assert.equal(fuzzy.duplicateOf, "L001");
  assert.equal(fuzzy.displayName, "Priya S.");
});

test("Phase 2 quality gate: L007 experience is not invented", () => {
  const arjun = byId(runPhase2FromSnapshot().leads, "L007");
  assert.equal(arjun.experience, "");
  assert.equal(arjun.experienceYears, null);
  assert.equal(arjun.goal, "Germany job");
  assert.equal(arjun.german_level, "A2");
  assert.equal(arjun.source, "Facebook");
  assert.equal(arjun.qualityFlags.some((flag) => flag.startsWith("column_shift")), false);
  assert.ok(arjun.missingFields.includes("experience"));
});

test("Phase 2: empty german_level stays empty and is missing, not a column shift", () => {
  const leads = runPhase2FromSnapshot().leads;
  for (const id of ["L005", "L020", "L023"]) {
    const lead = byId(leads, id);
    assert.equal(lead.german_level, "");
    assert.equal(lead.source, "Instagram");
    assert.ok(lead.missingFields.includes("german_level"));
    assert.equal(lead.qualityFlags.some((flag) => flag.startsWith("column_shift")), false);
  }
});

test("Phase 2 normalise: names, degrees, experience, and goals", () => {
  const leads = runPhase2FromSnapshot().leads;
  const mohit = byId(leads, "L010");
  assert.equal(mohit.displayName, "Mohit Sharma");
  assert.equal(mohit.education, "BSc Nursing");
  assert.equal(mohit.experience, "2 years");
  assert.equal(mohit.goal, "Work in Germany");

  const ananya = byId(leads, "L003");
  assert.equal(ananya.education, "BSc Nursing");

  const rahul = byId(leads, "L002");
  assert.equal(rahul.experience, "4 years");
  assert.equal(rahul.experienceYears, 4);
});

test("Phase 2 dedupe: L021 is a copy of L004", () => {
  const neha = byId(runPhase2FromSnapshot().leads, "L021");
  assert.equal(neha.isDuplicate, true);
  assert.equal(neha.duplicateOf, "L004");
});

test("Phase 2 run: 30 rows, 3 duplicates, no column-shift flags", () => {
  const result = runPhase2FromSnapshot();
  assert.equal(result.quality.ok, true);
  assert.equal(result.leads.length, 30);
  assert.equal(result.quality.duplicateCount, 3);
  assert.equal(result.quality.columnShiftCount, 0);
  assert.ok(result.leads.every((lead) => !lead.qualityFlags.some((flag) => flag.startsWith("column_shift"))));
});

test("Phase 2 quality gate fails if L029 email is not repaired", () => {
  const raw = ingestFromSnapshot().leads;
  const leads = markDuplicates(raw.map(cleanLead)).map((lead) =>
    lead.lead_id === "L029" ? { ...lead, email: "not-repaired@example.com", city: "BSc Nursing" } : lead
  );
  const quality = validatePhase2(leads);
  assert.equal(quality.ok, false);
  assert.ok(quality.errors.some((error) => error.includes("L029")));
});

test("Phase 2 cleanLead: keeps a healthy row intact", () => {
  const raw = ingestFromSnapshot().leads.find((lead) => lead.lead_id === "L004");
  assert.ok(raw);
  const neha = cleanLead(raw);
  assert.equal(neha.email, "neha.v@email.com");
  assert.equal(neha.city, "Delhi");
  assert.equal(neha.german_level, "B2");
  assert.equal(neha.qualityFlags.some((flag) => flag.startsWith("column_shift")), false);
});

test("Phase 2 runPhase2: same contract when fed Phase 1 output", () => {
  const raw = ingestFromSnapshot().leads;
  const result = runPhase2(raw);
  assert.equal(result.quality.ok, true);
  assert.equal(byId(result.leads, "L028").duplicateOf, "L001");
});
