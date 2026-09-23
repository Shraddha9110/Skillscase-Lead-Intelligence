# Phase 5 — Quality control

**Folder:** `phase-5-qc/`  
**Job:** Stop a bad row from being auto-accepted. AI output is not trusted.

## What we did

Stacked these checks on every Phase 4 enriched lead:

| Mechanism | What it catches |
| --- | --- |
| Duplicate detector | Same phone/email, different name (Priya S.) |
| Repair gate | Any `column_shift_*` flag |
| Contact gate | Missing email or phone |
| Product-vs-CRM | Pharmacist vs “Different profession” |
| GNM recognition | Relevant GNM only. Not Relevant UK/Canada GNM (L025) is not queued for recognition. |
| Rule critic | Invented ₹ price or “guarantee you a job” |
| Confidence gate | Uncertain or confidence &lt; 0.70 (when Phase 3 ran) |
| Guarantee gate | L030 job-guarantee expectation risk — hold, do not auto-dial |
| Human queue | pending / accepted / held / rejected — nothing in queue is auto-sent. Call first waits until accepted. |

## Showcase rows (required)

1. **L029 Deepa** — email cell is empty; report as a missing field.
2. **L028 Priya S.** — fuzzy duplicate of L001.
3. **L016 Farhan** — CRM says different profession; product lists pharmacists.
4. **L007 Arjun** — experience was the goal; do not invent years.

## Contract

| | |
| --- | --- |
| In | Phase 4 `EnrichedLead[]` (optional Phase 3 classification) |
| Out | `ReviewedLead[]` + review queue + QC examples |
| Gate | The four showcase rows are `reviewRequired`, queue status `pending`, not auto-accepted. |

## Files

| File | What it does |
| --- | --- |
| `types.ts` | `QualityReview`, `ReviewedLead`, queue status |
| `examples.ts` | The four documented problem cases |
| `review.ts` | Rule critic + gates |
| `run.ts` | `runPhase5` + quality gate |
| `review.test.ts` | Tests for the gates and the queue |

## How to test

```bash
npm run test:phase5
```
