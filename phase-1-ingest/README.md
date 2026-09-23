# Phase 1 — Ingest the Google Sheet

**Folder:** `phase-1-ingest/`  
**Job:** Turn the messy Skillcase spreadsheet into 30 typed `RawLead` rows. Do not clean anything.

## What we did

1. Snapshotted the Google Sheet to `data/raw/skillcase_messy_b2c_leads.csv`.
2. Wrote a quoted-CSV parser that keeps commas inside conversation text.
3. Mapped every row to the 13 source columns (`lead_id` … `notes`).
4. Added a quality gate: exactly 30 rows, unique ids L001–L030.

## Why this phase exists

If we “fix” Deepa’s email (`Chennai`) here, later phases cannot prove the sheet was broken. Phase 1 must preserve the mess.

## Contract

| | |
| --- | --- |
| In | Google Sheet snapshot CSV |
| Out | `RawLead[]` length 30 |
| Gate | Unique `lead_id`. Messy cells left as-is. |

## Files

| File | What it does |
| --- | --- |
| `types.ts` | `RawLead`, 13 columns, expected row count |
| `parseCsv.ts` | Quoted CSV parser, no repairs |
| `ingest.ts` | Load snapshot, map rows, `validatePhase1` |
| `ingest.test.ts` | 8 tests for the contract |
| `index.ts` | Public exports |

## Examples we keep messy on purpose

- **L029** email = `Chennai` (city sat in the email column)
- **L007** experience = `Germany job`
- **L005** german_level = `Instagram`
- **L010** name = `MOHIT SHARMA`, goal = `GERMANY`

## How to test

```bash
npm run test:phase1
```

Expected: 8 passed.
