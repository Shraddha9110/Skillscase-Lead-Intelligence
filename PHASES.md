# Phase folders

Each phase is a **top-level folder** you can open from the project root.

```
Skillscase-Lead-Intelligence/
  phase-1-ingest/      Ingest the Google Sheet (do not clean)
  phase-2-clean/       Repair columns, normalise, dedupe
  phase-3-classify/    Gemini: Relevant / Not Relevant / Uncertain
  phase-4-enrich/      Profile, intent, need, objection, next step
  phase-5-qc/          Critic, gates, human review queue
  phase-6-prioritize/  Score 0–100 → High / Medium / Low
  phase-7-outreach/    Personalized draft, or empty
  phase-8-assemble/    Final dataset, UI page, 5 slides
```

Open the `README.md` inside a folder for what we built, the contract, files, and how to test.

```bash
npm run test:phase1
npm run test:phase2
npm run test:phase3    # needs GEMINI_API_KEY in .env
npm run test:phase4
npm run test:phase5
npm run test:phase6
npm run test:phase7
npm run test:phase8
```
