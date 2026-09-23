# Phase 2 — Clean, repair, deduplicate

**Folder:** `phase-2-clean/`  
**Job:** Repair the sheet the way a counsellor would in Excel. No LLM.

## What we did

1. **Column-shift repair** (in this order)
   - City sitting in email → shift fields right, email becomes empty (L029).
   - Goal sitting in experience → experience becomes empty (L007).
   - Source sitting in German level → German level becomes empty (L005, L020, L023).
2. **Normalise** names, degrees (`B.Sc Nursing` → `BSc Nursing`), experience (`4 yrs` / `2` → years), goals (`GERMANY` → `Work in Germany`).
3. **Validate** email shape, German level, source, dates.
4. **List missing fields** (email, experience, German level, …).
5. **Dedup** on phone digits + lowercased email. First id is canonical. `Priya S.` still matches Priya Sharma.

## Contract

| | |
| --- | --- |
| In | Phase 1 `RawLead[]` |
| Out | `CleanLead[]` (still 30 rows) |
| Gate | L029 city = Chennai, email empty. L001 / L008 / L028 linked. L007 experience not invented. |

## Files

| File | What it does |
| --- | --- |
| `types.ts` | `CleanLead`, quality flags |
| `detect.ts` | City / email / source / German / date detectors |
| `clean.ts` | Shift + normalise one row |
| `dedupe.ts` | Phone/email duplicates |
| `run.ts` | `runPhase2` + quality gate |
| `clean.test.ts` | 10 tests |

## Results on the 30-row sheet

- 5 column-shift repairs
- 3 duplicates (L008 and L028 → L001, L021 → L004)
- 27 unique people

## How to test

```bash
npm run test:phase2
```

Expected: 10 passed.
