# Phase 8 — Assemble, export, UI, slides

**Folder:** `phase-8-assemble/`  
**Job:** Join Phases 2–7 into one counsellor-ready list, write the files, and ship the desk.

## What we did

1. Mapped every Phase 7 row onto the final `ProcessedLead` schema (all 30 ids kept).
2. Wrote `data/processed/skillcase_leads_enriched.csv` and `.json` (also copied under `public/data/`).
3. Locked the **UI page** contract on the counsellor desk:
   - Re-run the pipeline and show phase progress (including Phase 3 Gemini)
   - Lead list with relevant / priority / review / duplicate filters
   - Lead detail: cleaned fields, reason, profile, intent, need, objection, missing info, priority, next action, outreach, sources, critic notes
   - Human review queue: accept / hold / reject
   - Export CSV and JSON
4. Five slides live only at `/presentation`. They are not attached to the counsellor desk.

Duplicates stay in the file with empty outreach. L029 still has no invented email. L007 still has no invented experience.

## Contract

| | |
| --- | --- |
| In | Phase 7 `OutreachedLead[]` |
| Out | `ProcessedLead[]` + CSV/JSON + UI page + `/presentation` |
| Gate | 30 unique ids. Showcase QC rows survive. No High on Not Relevant. Desk has no presentation attached. |

## How to test

```bash
npm run test:phase8
```

- Counsellor desk: http://localhost:3000
- 5 slides: http://localhost:3000/presentation
