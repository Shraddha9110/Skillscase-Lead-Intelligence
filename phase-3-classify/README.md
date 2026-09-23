# Phase 3 — Classify with Gemini

**Folder:** `phase-3-classify/`  
**Job:** Label each cleaned lead Relevant / Not Relevant / Uncertain using the Gemini API.

## What we did

1. Locked the Skillcase ICP in `prompt.ts` (nurses + Germany = Relevant; BBA/engineer/Canada/UK = Not Relevant; pharmacist = Uncertain).
2. Called Gemini `generateContent` with JSON output. Auth is `GEMINI_API_KEY` from `.env` (gitignored).
3. Model used: `gemini-flash-latest`.
4. If Gemini fails or returns invalid JSON, the row becomes `Uncertain` and goes to human review. We do not skip it.
5. A thin rule check flags a high-confidence Relevant on a BBA/engineer or Canada/UK-only lead.

CRM notes are hints, not the label.

## Contract

| | |
| --- | --- |
| In | Phase 2 `CleanLead[]` |
| Out | `ClassifiedLead[]` with reason + confidence |
| Gate | Nurse + Germany → Relevant. BBA / Canada / UK → Not Relevant. Pharmacist → Uncertain. |

## Files

| File | What it does |
| --- | --- |
| `types.ts` | Classification + review fields |
| `prompt.ts` | System + user prompt |
| `env.ts` | Loads `.env` without printing the key |
| `gemini.ts` | `generateContent` client, retries on 429/503 |
| `classify.ts` | Parse, fallback, contradiction flags |
| `run.ts` | Classify a list of cleaned leads |
| `classify.test.ts` | Unit tests (no API) |
| `classify.integration.test.ts` | Live Gemini tests |

## How to test

Add `GEMINI_API_KEY` to `.env` (never commit it).

```bash
npm run test:phase3
```

Unit tests always run. Integration tests call Gemini for L005 (BBA) and L004 (B2 nurse).
