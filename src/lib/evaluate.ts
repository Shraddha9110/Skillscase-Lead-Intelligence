import type { EvaluationCheck, EvaluationResult, ProcessedLead } from "./types";

function expectedRelevance(notes: string): string {
  const text = notes.toLowerCase();
  if (/duplicate/.test(text)) return "Duplicate";
  if (/probably irrelevant|wrong market|wrong audience/.test(text)) return "Not Relevant";
  if (/different profession/.test(text)) return "Uncertain";
  if (/high intent|very high|very interested|potential product fit/.test(text)) return "Relevant";
  if (/early stage|price objection|eligibility|qualification|missing|expectation|confidence|timeline|needs follow|needs guidance/.test(text)) {
    return "Relevant or Uncertain";
  }
  return "Unknown";
}

function expectedIntent(notes: string): string {
  const text = notes.toLowerCase();
  if (/duplicate/.test(text)) return "none";
  if (/high intent|very high|very interested/.test(text)) return "ready or jobs";
  if (/early stage/.test(text)) return "exploring";
  if (/price/.test(text)) return "cost";
  if (/qualification/.test(text)) return "gnm";
  if (/different profession/.test(text)) return "allied";
  if (/wrong market|wrong audience|irrelevant/.test(text)) return "not a fit";
  if (/missing/.test(text)) return "collect missing field";
  if (/expectation/.test(text)) return "guarantee";
  return "stated in notes";
}

function actualIntent(lead: ProcessedLead): string {
  const blob = `${lead.intent} ${lead.next_action} ${lead.objection}`.toLowerCase();
  if (lead.is_duplicate) return "none";
  if (/ready|call within|job-ready|vacanc/.test(blob)) return "ready or jobs";
  if (/explor/.test(blob)) return "exploring";
  if (/cannot pay|installment|cost|fee/.test(blob)) return "cost";
  if (/gnm/.test(blob)) return "gnm";
  if (/allied|pharmacist/.test(blob)) return "allied";
  if (/not-a-fit|not a fit|wrong market|do not sell/.test(blob)) return "not a fit";
  if (/missing|email|experience|german/.test(blob)) return "collect missing field";
  if (/guarantee/.test(blob)) return "guarantee";
  return blob.slice(0, 80) || "empty";
}

export function evaluateAgainstNotes(leads: ProcessedLead[]): EvaluationResult {
  const checks: EvaluationCheck[] = [];
  for (const lead of leads) {
    const notes = lead.notes || "";
    const expectDup = /duplicate/i.test(notes);
    checks.push({
      lead_id: lead.lead_id,
      dimension: "duplicate",
      notes,
      expected: expectDup ? "duplicate" : "unique",
      actual: lead.is_duplicate ? `duplicate of ${lead.duplicate_of}` : "unique",
      match: expectDup === lead.is_duplicate
    });

    const expectRel = expectedRelevance(notes);
    const actualRel = String(lead.relevant);
    const relMatch =
      expectRel === "Unknown" ||
      expectRel === "Relevant or Uncertain"
        ? actualRel === "Relevant" || actualRel === "Uncertain"
        : expectRel === "Duplicate"
          ? actualRel.startsWith("Duplicate of")
          : actualRel === expectRel;
    checks.push({
      lead_id: lead.lead_id,
      dimension: "relevance",
      notes,
      expected: expectRel,
      actual: actualRel,
      match: relMatch
    });

    const expectIntent = expectedIntent(notes);
    const actual = actualIntent(lead);
    checks.push({
      lead_id: lead.lead_id,
      dimension: "intent",
      notes,
      expected: expectIntent,
      actual,
      match: expectIntent === "stated in notes" || actual === expectIntent || actual.includes(expectIntent)
    });
  }

  const matches = checks.filter((check) => check.match);
  const mismatches = checks.filter((check) => !check.match);
  return {
    checks,
    matches,
    mismatches,
    agreementRate: checks.length ? Math.round((matches.length / checks.length) * 1000) / 10 : 0
  };
}
