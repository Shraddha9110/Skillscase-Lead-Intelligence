import assert from "node:assert/strict";
import { test } from "node:test";
import { runPhase6FromSnapshot } from "../phase-6-prioritize/run";
import { criticOutreach, repeatedSentences, wordCount } from "./critic";
import { acceptGeminiOutreach, outreachReviewFallback } from "./geminiOutreach";
import { choosePassingOutreach, isOutreachEligible, writeOutreach } from "./outreach";
import { runPhase7, runPhase7FromSnapshot, validatePhase7 } from "./run";
import { MAX_WORDS, MIN_WORDS, type OutreachedLead } from "./types";

function byId(leads: OutreachedLead[], id: string): OutreachedLead {
  const lead = leads.find((row) => row.lead_id === id);
  assert.ok(lead, `Missing ${id}`);
  return lead;
}

test("Phase 7 quality gate: drafts only for unique Relevant leads, 50–70 words", () => {
  const result = runPhase7FromSnapshot();
  assert.equal(result.quality.ok, true);
  assert.equal(result.leads.length, 30);
  assert.ok(result.quality.draftCount >= 1);
  assert.ok(result.quality.blankCount >= 1);
  for (const lead of result.leads) {
    assert.equal(lead.pipelineStep, "phase7-outreach");
    if (isOutreachEligible(lead)) {
      assert.ok(lead.outreach.length > 0);
      assert.ok(lead.wordCount >= MIN_WORDS && lead.wordCount <= MAX_WORDS);
      if (lead.city) assert.ok(lead.outreach.includes(lead.city));
      if (lead.education) assert.ok(lead.outreach.includes(lead.education));
      if (lead.german_level) assert.ok(lead.outreach.includes(lead.german_level));
    } else {
      assert.equal(lead.outreach, "");
      assert.equal(lead.wordCount, 0);
    }
  }
});

test("Phase 7: duplicates get no second message", () => {
  const leads = runPhase7FromSnapshot().leads;
  for (const id of ["L008", "L021", "L028"]) {
    const copy = byId(leads, id);
    assert.equal(copy.isDuplicate, true);
    assert.equal(copy.outreach, "");
    assert.equal(copy.outreachEligible, false);
  }
});

test("Phase 7: Not Relevant and Uncertain stay blank", () => {
  const leads = runPhase7FromSnapshot().leads;
  for (const id of ["L005", "L012", "L016", "L020", "L025"]) {
    assert.equal(byId(leads, id).outreach, "");
  }
});

test("Phase 7: L013 Kavya uses Bangalore, BSc Nursing, B1, and the call she asked for", () => {
  const kavya = byId(runPhase7FromSnapshot().leads, "L013");
  assert.match(kavya.outreach, /Kavya/);
  assert.match(kavya.outreach, /Bangalore/);
  assert.match(kavya.outreach, /BSc Nursing/);
  assert.match(kavya.outreach, /B1/);
  assert.match(kavya.outreach, /tomorrow|document/i);
  assert.ok(kavya.wordCount >= MIN_WORDS);
});

test("Phase 7: L009 Ritika is a B2 ICU placement note, not an A1 pitch", () => {
  const ritika = byId(runPhase7FromSnapshot().leads, "L009");
  assert.match(ritika.outreach, /Kolkata/);
  assert.match(ritika.outreach, /B2/);
  assert.match(ritika.outreach, /ICU/);
  assert.match(ritika.outreach, /not a beginner|will not restart/i);
  assert.doesNotMatch(ritika.outreach, /beginner course|start at A1/i);
});

test("Phase 7: L006 Sneha mentions installments and invents no rupee amount", () => {
  const sneha = byId(runPhase7FromSnapshot().leads, "L006");
  assert.match(sneha.outreach, /Pune/);
  assert.match(sneha.outreach, /installment|split/i);
  assert.doesNotMatch(sneha.outreach, /₹|rs\.?\s*\d/i);
});

test("Phase 7: L030 Karan is told there is no job guarantee", () => {
  const karan = byId(runPhase7FromSnapshot().leads, "L030");
  assert.match(karan.outreach, /does not guarantee/i);
  assert.match(karan.outreach, /Delhi/);
  assert.match(karan.outreach, /BSc Nursing/);
  assert.doesNotMatch(karan.outreach, /guarantee you a job|₹/i);
});

test("Phase 7: L029 Deepa stays on WhatsApp and does not invent an email", () => {
  const deepa = byId(runPhase7FromSnapshot().leads, "L029");
  assert.equal(deepa.email, "");
  assert.match(deepa.outreach, /Chennai/);
  assert.match(deepa.outreach, /B2/);
  assert.match(deepa.outreach, /WhatsApp/i);
  assert.doesNotMatch(deepa.outreach, /@/);
});

test("Phase 7: L015 Meera is a nurture, not a push close", () => {
  const meera = byId(runPhase7FromSnapshot().leads, "L015");
  assert.match(meera.outreach, /Pune/);
  assert.match(meera.outreach, /30 days|budget|this month/i);
  assert.doesNotMatch(meera.outreach, /enrol today|limited seats/i);
});

test("Phase 7: GNM review drafts confirm eligibility and never say you can apply", () => {
  const leads = runPhase7FromSnapshot().leads;
  for (const id of ["L002", "L007", "L014"]) {
    const gnm = byId(leads, id);
    assert.match(gnm.outreach, /confirm eligibility/i);
    assert.doesNotMatch(gnm.outreach, /\byes,?\s+you can apply\b|\bdo apply\b/i);
    assert.ok(criticOutreach(gnm.outreach, gnm).every((flag) => !/unsourced|can apply|eligible/i.test(flag)));
  }
});

test("Phase 7 critic flags unsourced claims and a yes-you-can-apply line", () => {
  const unsourced = criticOutreach("German wards ask us to shortlist verified healthcare employers.");
  assert.ok(unsourced.some((flag) => /unsourced/i.test(flag)));

  const apply = criticOutreach("Yes, you can apply. GNM nurses do apply from Hyderabad.", {
    education: "GNM",
    reviewRequired: true,
    reviewReasons: ["qualification recognition check needed"]
  });
  assert.ok(apply.some((flag) => /eligible|can apply|confirm eligibility/i.test(flag)));
});

test("Phase 7: invented guarantee or price is a critic flag", () => {
  const flags = criticOutreach("We guarantee you a job in Germany for ₹50000.");
  assert.ok(flags.some((flag) => /rupee|guarantee/i.test(flag)));
  assert.equal(wordCount(""), 0);
});

test("Phase 7 regenerates when the first draft fails QC", () => {
  const lead = runPhase6FromSnapshot().leads.find((row) => row.lead_id === "L013");
  assert.ok(lead);
  const good = writeOutreach(lead);
  const repeated = "Please reply today. Please reply today. Bangalore BSc Nursing B1.";
  const jargon = "Your level is on file in this row field from the CRM. Bangalore BSc Nursing B1.";
  const tooLong = `${"word ".repeat(81)}Bangalore BSc Nursing B1`;
  const picked = choosePassingOutreach(lead, [repeated, jargon, tooLong, good]);
  assert.equal(picked, good);
  assert.equal(criticOutreach(picked).length, 0);
});

test("Phase 7 critic flags repeated sentences, internal words, and over 80 words", () => {
  const repeat = criticOutreach("Please reply today. Please reply today.");
  assert.ok(repeat.some((flag) => /twice/i.test(flag)));
  assert.equal(repeatedSentences("Please reply today. Please reply today.").length, 1);

  const jargon = criticOutreach("Your German level is on file and the row is missing a field from the CRM.");
  assert.ok(jargon.some((flag) => /internal word/i.test(flag)));

  const long = criticOutreach(Array.from({ length: 81 }, () => "word").join(" "));
  assert.ok(long.some((flag) => /80/i.test(flag)));
});

test("Phase 7: every draft is 50–70 words, unique sentences, and free of internal jargon", () => {
  const drafts = runPhase7FromSnapshot().drafts;
  const seen = new Set<string>();
  for (const lead of drafts) {
    assert.equal(criticOutreach(lead.outreach, lead).length, 0);
    assert.ok(lead.wordCount >= MIN_WORDS && lead.wordCount <= MAX_WORDS);
    assert.equal(repeatedSentences(lead.outreach).length, 0);
    assert.doesNotMatch(lead.outreach, /\bon file\b|\brow\b|\bfields?\b|\bCRM\b/i);
    assert.equal(seen.has(lead.outreach), false, `${lead.lead_id} reused another lead's message`);
    seen.add(lead.outreach);
  }
});

test("Phase 7 quality gate fails if a duplicate is messaged", () => {
  const leads = runPhase7FromSnapshot().leads.map((lead) =>
    lead.lead_id === "L028" ? { ...lead, outreach: "Hi Priya — joining the Germany track this week?" } : lead
  );
  const quality = validatePhase7(leads);
  assert.equal(quality.ok, false);
  assert.ok(quality.errors.some((error) => /L028/.test(error)));
});

test("Phase 7: snapshot drafts record fallback; Gemini critic fail goes to review", () => {
  const result = runPhase7FromSnapshot();
  assert.ok(result.leads.every((lead) => lead.outreachPath === "fallback"));

  const kavya = byId(result.leads, "L013");
  const good = acceptGeminiOutreach(kavya, { outreach: kavya.outreach });
  assert.equal(good.ok, true);

  const bad = acceptGeminiOutreach(kavya, {
    outreach: "We guarantee you a job in Germany for ₹50000. Please reply today. Please reply today."
  });
  assert.equal(bad.ok, false);
  if (bad.ok) return;
  const held = outreachReviewFallback(kavya, bad.flags);
  assert.equal(held.outreach, "");
  assert.equal(held.outreachPath, "ai");
  assert.equal(held.reviewRequired, true);
  assert.ok(held.reviewReasons.some((reason) => /failed QC after regenerate/i.test(reason)));
});

test("Phase 7 runPhase7: same contract from Phase 6 output", () => {
  const result = runPhase7(runPhase6FromSnapshot().leads);
  assert.equal(result.quality.ok, true);
  assert.equal(result.drafts.length, result.quality.draftCount);
  assert.ok(result.drafts.every((lead) => writeOutreach(lead).length > 0));
});
