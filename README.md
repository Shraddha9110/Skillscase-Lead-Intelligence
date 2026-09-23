# Skillcase Lead Intelligence

Working prototype that turns the messy `skillcase_messy_b2c_leads` spreadsheet (30 B2C rows) into a clean, enriched, prioritized sales list with personalized outreach.

Skillcase helps Indian healthcare professionals — mainly nurses — learn German (A1–B2) and pursue healthcare jobs in Germany. This workflow automates the desk work a counsellor currently does by hand.

## Run the prototype

```bash
npm install
npm run process    # writes data/processed/ for all 30 leads
npm run dev        # open http://localhost:3000
```

- App: [http://localhost:3000](http://localhost:3000)
- 5-slide presentation: [http://localhost:3000/presentation](http://localhost:3000/presentation)

`npm run process` is the automatic path. The same pipeline also runs in the browser when you click **Re-run pipeline**.

Optional LLM mode (classification, enrichment, critic, outreach):

```bash
cp .env.example .env.local
# add OPENAI_API_KEY
npm run process
```

Without a key, a deterministic analyst + rule critic still produces the full dataset. Prompts live in `src/lib/prompts.ts`.

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

| Signal | Points |
| --- | --- |
| German B2 / B1 / A2 / A1 / unknown | +28 / +18 / +10 / +6 / +4 |
| Experience 5y+ / 3–4 / 1–2 / <1 / unknown | +18 / +14 / +10 / +6 / +3 |
| Call/ready or B2+jobs / process questions / exploring / cannot afford now | +30 / +20 / +12 / +6 |
| Contacted in last 3 / 6 / 10 days | +10 / +7 / +4 |
| Missing email, job-guarantee ask, cannot-afford-now | −8 / −4 / −8 |

Duplicates inherit a Low score and never get a second outreach.

## Quality control

AI output is not auto-accepted. The system uses:

1. Duplicate detection on phone/email
2. Column-shift and field-type validation
3. Confidence threshold (review if &lt; 0.70)
4. Schema checks (no outreach for non-relevant; no High for non-relevant; no invented price or job guarantee)
5. A second critic pass
6. A human review queue in the UI

Four problems the system catches (more than the required three):

1. **L029 Deepa Krishnan** — city in the email column; seven fields repaired; email still missing; review forced.
2. **L028 Priya S.** — same phone/email as L001 under a shortened name; outreach suppressed.
3. **L016 Farhan Ali** — CRM says “Different profession”; product lists pharmacists; marked Uncertain.
4. **L007 Arjun Nair** — “Germany job” sat in experience; experience left blank on purpose.

After `npm run process` the current sheet is: 30 rows, 27 unique people, 22 unique relevant leads, 3 duplicates, 5 column-shifted rows repaired, 10 rows in the human review queue.

## Final dataset

All 30 leads: `data/processed/skillcase_leads_enriched.csv` and `.json` (also under `public/data/`).

Columns include Lead, Relevant, Reason, Intent, Profile, Need, Objection, Missing information, Priority, Next action, Outreach, plus QC fields and public sources.

## Repo map

- `data/raw/skillcase_messy_b2c_leads.csv` — original messy sheet
- `src/lib/pipeline.ts` — clean, classify, enrich, score, outreach, critic
- `src/lib/prompts.ts` — LLM prompts (safe to edit in a viva)
- `src/components/Prototype.tsx` — interactive desk
- `src/app/presentation/page.tsx` — 5 slides

## Public sources used for enrichment

- https://skillcase.in/ — healthcare German A1–B2, exam prep, career guidance
- https://skillcase.in/create-account-new — qualification list (includes GNM and pharmacists)
- https://www.skillcase.info/ — placements, interviews, visa timing
- https://skillcase.in/blog-view?id=13 — GNM / BSc eligibility notes
