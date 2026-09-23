# Phase 7 — Personalized outreach

**Folder:** `phase-7-outreach/`  
**Job:** Draft a message that could not have been a mail-merge. Empty string otherwise.

## What we did

Wrote a fresh WhatsApp/email draft for every **unique Relevant** lead.

Rules:

- Only if Relevant and not a duplicate.
- 50–70 words. Written per lead, not stitched from shared lines.
- Must use this lead’s city, qualification, and German level.
- Must use the objection they actually raised (cost, GNM, guarantee, confidence, missing email, …).
- End with one next step.
- Empty for duplicates, Not Relevant, and Uncertain.
- Hard ban: invented ₹ amounts and “we guarantee you a job”.

QC rejects and regenerates if:

- a sentence appears twice in one message
- the draft uses internal words (`on file`, `row`, `field`, `CRM`)
- the draft is over 80 words
- the draft states a Skillcase product, employer, or eligibility fact that is not in the lead data or the sourced knowledge file
- a review-queue / GNM lead is told “yes, you can apply” instead of “we will confirm eligibility”

L030 is told Skillcase **does not** guarantee a job. L029 stays on WhatsApp because email is still missing. L028 is blank so Priya is not messaged twice.

Templates stay the always-on fallback. The counsellor desk (`runDesk.ts`) calls Gemini with `OUTREACH_SYSTEM` first, runs every AI draft through `criticOutreach()`, regenerates once on fail, then sends the row to review. `outreachPath` is `ai` or `fallback` (templates only when Gemini fails or quota is hit).

## Contract

| | |
| --- | --- |
| In | Phase 6 `PrioritizedLead[]` |
| Out | `OutreachedLead[]` (`outreach`, word count, critic flags) |
| Gate | Unique Relevant drafts are 50–70 words, personal, and QC-clean. All other rows are blank. No invented price or guarantee. |

## Files

| File | What it does |
| --- | --- |
| `types.ts` | `OutreachDraft`, `OutreachedLead` |
| `critic.ts` | Word count, repeats, jargon, banned-phrase critic |
| `outreach.ts` | Template writer with regenerate-on-fail (fallback) |
| `geminiOutreach.ts` | Desk Gemini drafts + critic + review fallback |
| `run.ts` | `runPhase7` + quality gate |
| `outreach.test.ts` | Tests for blanks, personalization, critic |

## How to test

```bash
npm run test:phase7
```

Expected: 18 passed.
