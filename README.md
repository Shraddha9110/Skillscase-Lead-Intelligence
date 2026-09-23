# Skillcase Lead Intelligence

Working prototype that turns the messy `skillcase_messy_b2c_leads` spreadsheet (30 B2C rows) into a clean, enriched, prioritized sales list with personalized outreach.

Skillcase helps Indian healthcare professionals — mainly nurses — learn German (A1–B2) and pursue healthcare jobs in Germany. This workflow automates the desk work a counsellor currently does by hand.

## Run the prototype

```bash
npm install
npm run process    # writes data/processed/ for all 30 leads
npm run dev        # open http://localhost:3000
```

- Counsellor desk: [http://localhost:3000](http://localhost:3000)
- 5-slide presentation (separate page): [http://localhost:3000/presentation](http://localhost:3000/presentation)

`npm run process` writes the final dataset. The desk also re-runs the pipeline when you click **Re-run pipeline**.

## What the workflow does

```
Raw CSV
  → Clean / repair shifted columns, invalid fields, missing values
  → Deduplicate on phone + email (including “Priya S.”)
  → Classify Relevant / Not Relevant / Uncertain + confidence
  → Understand: profile, intent, needs, objections, opportunity, next step
  → Quality control: critic, schema checks, human review queue
  → Prioritize 0–100 → High / Medium / Low
  → Personalized outreach (blank for non-relevant and duplicates)
  → Final dataset
```

## Relevance criteria

- **Relevant:** nursing qualification (BSc / GNM / similar) and a Germany (or open) goal.
- **Not relevant:** non-healthcare (BBA, engineer) or a Canada-only / UK-only ask.
- **Uncertain:** listed allied health (e.g. pharmacist) or a repaired row that is still incomplete.
- CRM notes are hints, not truth. Skillcase signup lists pharmacists, so “Different profession” is not auto-discarded.

## Priority criteria

Score 0–100. High ≥ 70, Medium 45–69, Low < 45.

Duplicates inherit a Low score and never get a second outreach.

## Quality control

AI output is not auto-accepted. Four problems the system catches:

1. **L029 Deepa Krishnan** — city in the email column; seven fields repaired; email still missing.
2. **L028 Priya S.** — same phone/email as L001 under a shortened name; outreach suppressed.
3. **L016 Farhan Ali** — CRM says “Different profession”; product lists pharmacists.
4. **L007 Arjun Nair** — “Germany job” sat in experience; experience left blank on purpose.

## Final dataset

All 30 leads: `data/processed/skillcase_leads_enriched.csv` and `.json` (also under `public/data/`).

## Repo map

- `data/raw/skillcase_messy_b2c_leads.csv` — original messy sheet
- `phase-1-ingest/` … `phase-8-assemble/` — one folder per phase
- `src/components/Prototype.tsx` — counsellor desk
- `src/app/presentation/page.tsx` — 5 slides (not on the home page)
