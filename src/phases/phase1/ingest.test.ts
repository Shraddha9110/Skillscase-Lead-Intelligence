import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { ingestFromCsvText, ingestFromSnapshot, validatePhase1 } from "./ingest";
import { parseCsv } from "./parseCsv";
import { EXPECTED_ROW_COUNT, RAW_COLUMNS, SNAPSHOT_RELATIVE_PATH, type RawLead } from "./types";

const root = process.cwd();

function byId(leads: RawLead[], id: string): RawLead {
  const lead = leads.find((row) => row.lead_id === id);
  assert.ok(lead, `Missing ${id}`);
  return lead;
}

test("Phase 1 quality gate: snapshot exists and is byte-stable on disk", () => {
  const snapshot = join(root, SNAPSHOT_RELATIVE_PATH);
  assert.equal(existsSync(snapshot), true, `Missing ${SNAPSHOT_RELATIVE_PATH}`);
  const text = readFileSync(snapshot, "utf8");
  assert.match(text, /^lead_id,name,phone,email,city,education,experience,goal,german_level,source,last_contacted,conversation,notes/);
  assert.match(text, /^L001,/m);
  assert.match(text, /^L030,/m);
});

test("Phase 1 ingest: Google Sheet snapshot maps to 30 unique RawLead rows", () => {
  const result = ingestFromSnapshot(root);

  assert.equal(result.leads.length, EXPECTED_ROW_COUNT);
  assert.equal(result.quality.ok, true);
  assert.equal(result.quality.uniqueLeadIds, true);
  assert.deepEqual(result.quality.duplicateLeadIds, []);
  assert.deepEqual(result.quality.missingLeadIds, []);
  assert.deepEqual(
    result.leads.map((lead) => lead.lead_id),
    Array.from({ length: 30 }, (_, i) => `L${String(i + 1).padStart(3, "0")}`)
  );
});

test("Phase 1 ingest: every row has exactly the 13 source columns", () => {
  const { leads } = ingestFromSnapshot(root);
  for (const lead of leads) {
    assert.deepEqual(Object.keys(lead), [...RAW_COLUMNS]);
    for (const column of RAW_COLUMNS) {
      assert.equal(typeof lead[column], "string");
    }
  }
});

test("Phase 1 ingest: does not repair messy cells", () => {
  const { leads } = ingestFromSnapshot(root);

  const deepa = byId(leads, "L029");
  assert.equal(deepa.email, "Chennai");
  assert.equal(deepa.city, "BSc Nursing");
  assert.equal(deepa.education, "3 years");
  assert.equal(deepa.experience, "Work in Germany");
  assert.equal(deepa.goal, "B2");
  assert.equal(deepa.german_level, "Website");

  const arjun = byId(leads, "L007");
  assert.equal(arjun.experience, "Germany job");
  assert.equal(arjun.goal, "A2");
  assert.equal(arjun.german_level, "Facebook");

  const amit = byId(leads, "L005");
  assert.equal(amit.german_level, "Instagram");
  assert.equal(amit.source, "2026-09-12");

  const mohit = byId(leads, "L010");
  assert.equal(mohit.name, "MOHIT SHARMA");
  assert.equal(mohit.experience, "2 yrs");
  assert.equal(mohit.goal, "GERMANY");
});

test("Phase 1 ingest: quoted conversation text is preserved", () => {
  const priya = byId(ingestFromSnapshot(root).leads, "L001");
  assert.equal(
    priya.conversation,
    "Interested in Germany. Has B1 but hasn't taken the exam. Asked about eligibility and total cost."
  );
  assert.equal(priya.notes, "Very interested");
});

test("Phase 1 parser: quoted commas stay inside one cell", () => {
  const rows = parseCsv('lead_id,conversation\nL999,"Hello, world, again"\n');
  assert.equal(rows[1][0], "L999");
  assert.equal(rows[1][1], "Hello, world, again");
});

test("Phase 1 quality gate fails when a lead_id is missing or duplicated", () => {
  const leads = ingestFromSnapshot(root).leads;
  const broken = leads.filter((lead) => lead.lead_id !== "L030");
  const failed = validatePhase1(broken);
  assert.equal(failed.ok, false);
  assert.deepEqual(failed.missingLeadIds, ["L030"]);

  const duplicated = validatePhase1([...leads, { ...leads[0], lead_id: "L001" }]);
  assert.equal(duplicated.ok, false);
  assert.deepEqual(duplicated.duplicateLeadIds, ["L001"]);
});

test("Phase 1 ingestFromCsvText: same contract as the snapshot file", () => {
  const text = readFileSync(join(root, SNAPSHOT_RELATIVE_PATH), "utf8");
  const leads = ingestFromCsvText(text);
  const quality = validatePhase1(leads);
  assert.equal(quality.ok, true);
  assert.equal(leads.length, 30);
});
