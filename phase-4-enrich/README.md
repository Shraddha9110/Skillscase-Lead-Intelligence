# Phase 4 — Understand and enrich

**Folder:** `phase-4-enrich/`  
**Job:** Turn the cleaned conversation into sales context a counsellor can use.

## What we did

1. Extracted signals from goal + conversation + notes (call ask, exam not taken, ICU, installments, GNM, job guarantee, other course, explore, …).
2. Filled the required fields:
   - Profile
   - Intent
   - Needs
   - Objections
   - Missing information
   - Opportunity
   - Next action
   - Sources (only when a public Skillcase fact is used, with URL)
3. Hard ban: no invented fees, employers, visas, or “we guarantee you a job”.

Deterministic signals stay the always-on fallback. The counsellor desk (`runDesk.ts`) calls Gemini with `ENRICH_SYSTEM` first, using the Phase 3 Gemini client, and records `enrichmentPath` (`ai` / `fallback`) on each row.

## Contract

| | |
| --- | --- |
| In | Phase 2 `CleanLead[]` |
| Out | `EnrichedLead[]` |
| Gate | All 30 rows have every field. L030 must not invent a guarantee. L029 must list the missing email. |

## Files

| File | What it does |
| --- | --- |
| `types.ts` | `Enrichment`, `Signals`, `EnrichedLead` |
| `signals.ts` | Keyword / field signal extraction |
| `sources.ts` | Sourced Skillcase facts + URLs |
| `enrich.ts` | Build the sales context (signal fallback) |
| `geminiEnrich.ts` | Desk Gemini enrich using `ENRICH_SYSTEM` |
| `run.ts` | `runPhase4` + quality gate |
| `enrich.test.ts` | Tests including Gemini parse + path |

## What the tests prove

- Kavya (L013): ready now, documents, call in 24 hours
- Karan (L030): expectation risk, no fake guarantee
- Sneha (L006): installment objection
- Meera (L015): nurture, not a push
- Ritika (L009): B2 + ICU placement
- Farhan (L016): allied-health sources
- Priya S. (L028): merge into L001
- Arjun / Deepa: missing experience / email kept honest

## How to test

```bash
npm run test:phase4
```

Expected: 15 passed.
