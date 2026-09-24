# Skillcase Lead Intelligence

Working prototype that turns the messy `skillcase_messy_b2c_leads` spreadsheet (30 B2C rows) into a clean, enriched, prioritized sales list with personalized outreach.

Skillcase helps Indian healthcare professionals — mainly nurses — learn German (A1–B2) and pursue healthcare jobs in Germany. This workflow automates the desk work a counsellor currently does by hand.

The raw sheet has **empty cells**, not shifted columns. Empty stays empty. Missing fields are flagged, not invented.

## Live

- **Deployed desk:** [https://skillscase-lead-intelligence.onrender.com](https://skillscase-lead-intelligence.onrender.com) (Render free tier; first load can take about a minute)
- **Deployed slides:** [https://skillscase-lead-intelligence.onrender.com/presentation](https://skillscase-lead-intelligence.onrender.com/presentation)
- Local desk: [http://localhost:3000](http://localhost:3000)
- Local slides: [http://localhost:3000/presentation](http://localhost:3000/presentation)

### Deploy on Render

This is a Node **web service** (not a static site) because `/api/pipeline` must stay server-side.

1. Open [Render Blueprint](https://dashboard.render.com/blueprint/new) and connect `Shraddha9110/Skillscase-Lead-Intelligence`, or use [Deploy to Render](https://render.com/deploy?repo=https://github.com/Shraddha9110/Skillscase-Lead-Intelligence).
2. Set `GEMINI_API_KEY` in the Render dashboard. Do not commit `.env`.
3. `render.yaml` already sets Node 20, `GEMINI_MODEL`, build (`npm ci --include=dev && npm run build`), and start (`npm start`).

## Run the prototype

```bash
npm install
npm run process    # writes data/processed/ for all 30 leads
npm run dev        # open http://localhost:3000
```

`npm run process` writes the final dataset. The desk also re-runs the pipeline when you click **Re-run pipeline**.

## What the workflow does

```
Raw CSV
  → Clean: keep empty cells empty, flag missing/invalid values, normalise, dedupe
  → Deduplicate on phone + email (including “Priya S.”)
  → Classify with Gemini (rules if quota)
  → Enrich with Gemini (signals fallback)
  → Quality control: critic, schema checks, human review queue
  → Prioritize 0–100 → High / Medium / Low
  → Outreach with Gemini through criticOutreach (templates fallback)
  → Final dataset
```

## Relevance criteria

Same rules as `phase-3-classify/prompt.ts`:

- **Relevant:** nursing qualification (BSc Nursing, GNM, ANM, MSc Nursing) **and** a Germany or open Germany-linked goal (explore, B2 prep).
- **Not Relevant:** non-healthcare (engineer, generic BBA) **or** only asking for Canada / UK / another market.
- **Uncertain:** listed allied health (pharmacist, doctor, physio, dentist), mixed destination, or a critical field is still missing.

A pharmacist is **Uncertain**, not Not Relevant. Signup lists pharmacists. Do not invent a new ICP.

## Priority criteria

Score 0–100. High ≥ 70, Medium 45–69, Low < 45.

Duplicates inherit a Low score and never get a second outreach.

## Quality control

AI output is not auto-accepted. Four problems the system catches:

1. **L029 Deepa Krishnan** — email cell is empty; it stays empty; WhatsApp only until an address is collected.
2. **L028 Priya S.** — same phone/email as L001 under a shortened name; outreach suppressed.
3. **L016 Farhan Ali** — BPharm / pharmacist is allied health, so Uncertain; human decides the track.
4. **L007 Arjun Nair** — experience cell is empty; it stays empty; do not invent years of work.

## Final dataset

All 30 leads: `data/processed/skillcase_leads_enriched.csv` and `.json` (also under `public/data/`).

## Repo map

- `data/raw/skillcase_messy_b2c_leads.csv` — original messy sheet (empty cells left empty)
- `phase-1-ingest/` … `phase-8-assemble/` — one folder per phase
- `src/components/Prototype.tsx` — counsellor desk
- `src/app/presentation/page.tsx` — 5 slides (not on the home page)
