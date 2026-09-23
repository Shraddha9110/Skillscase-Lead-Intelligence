# Skillcase Lead Intelligence — Architecture

**Dataset:** [skillcase_messy_b2c_leads](https://docs.google.com/spreadsheets/d/1Dzjyne7lcdbJ9gnY-KP5RRIllfhzfmQzCRKXk1eOez4/edit?usp=sharing)  
**Product:** Skillcase (Bengaluru) — healthcare-focused German (A1–B2) plus Germany job-pathway support for Indian nurses and other listed healthcare professionals.  
**Goal:** Take 30 messy B2C rows and produce a clean, enriched, prioritized list a counsellor can act on.  
**This document:** architecture and phases only. No new implementation.

The live prototype, if present, should follow these phases rather than a single prompt.

---

## 1. Problem

A counsellor today does this by hand:

1. Clean the sheet (duplicates, missing cells, shifted columns, invalid values).
2. Decide who is a real Skillcase lead.
3. Read unstructured chat and notes to find intent, needs, and objections.
4. Decide who to call first.
5. Write a personal message.
6. Put the result back into a structured list.

The architecture automates steps 1–5 with a **pipeline**, then keeps a **human in the loop** so model output is never auto-accepted.

### What the source sheet actually contains

| Column | Role | Typical mess |
| --- | --- | --- |
| `lead_id` | Stable row id (L001–L030) | Duplicates reuse a person under a new id |
| `name` | Display name | `MOHIT SHARMA`, `Priya S.` |
| `phone`, `email` | Contact | Email column can hold a **city** |
| `city` | Location | Can hold a **degree** after a shift |
| `education` | Qualification | `B.Sc Nursing` / `GNM` / `BBA` / `Engineer` / `BPharm` |
| `experience` | Tenure | `4 yrs`, `2`, or a **goal** (`Germany job`) |
| `goal` | Stated aim | `GERMANY`, `Canada`, `B2 preparation` |
| `german_level` | A1–B2 | Can hold a **source** (`Instagram`) |
| `source` | Channel | Can hold a **date** |
| `last_contacted` | Date | Can hold **conversation** text |
| `conversation` | Unstructured gold | Intent, objection, ask-for-call |
| `notes` | CRM hint | `DUPLICATE of L001`, `Wrong market` — hints, not truth |

Known failure modes the architecture must treat as first-class:

- Column shift (L029: city in email; L007: goal in experience; L005 / L020 / L023: source in German level).
- Exact and fuzzy duplicates (L001 / L008 / L028; L004 / L021).
- Wrong ICP (BBA, software engineer, Canada-only, UK-only).
- Adjacent ICP (pharmacist — listed on Skillcase signup; CRM says “different profession”).
- Expectation risk (job-guarantee question).

---

## 2. Design principles

1. **Pipeline, not one prompt.** Each phase has a single job and a typed output.
2. **Repair before reasoning.** Do not classify a row whose city is sitting in the email column.
3. **Rules for facts, models for language.** Phone, email, date, and column-shift are deterministic. Intent, objections, and outreach may use an LLM.
4. **CRM notes are not ground truth.** Product rules beat a note that says “irrelevant”.
5. **No invented commerce.** No fake price, employer name, visa outcome, or job guarantee.
6. **Every public fact is sourced.** Skillcase pages used for enrichment must appear on the row.
7. **Duplicates are kept, not deleted.** All 30 ids stay in the final dataset; extras are marked and receive no outreach.
8. **Human review is a phase, not a footer.** Low confidence, repairs, and contradictions must queue.

---

## 3. System overview

```
Counsellor desk (UI)
  Pipeline runner · Lead list · Review queue · Export · Slides
        |                                      |
        | run / inspect                        | accept / hold / reject
        v                                      v
  Orchestrator (ordered phase runner)     Review store (human decisions)
        |
        v
  Phase engines (0 through 8)
        |
        v
  Raw sheet --> Clean store --> Intelligence store --> QC store --> Final dataset
        |
        +-- Gemini LLM for Phase 3 classification (Google AI / Gemini API)
        +-- Optional Gemini (or fallback analyst) for enrich, critic, outreach
```

### Logical stores (the “database”)

The Google Sheet is the **system of record for input**. The 30-row prototype does not need Postgres. Treat these as named stores so a later CRM can replace files without changing phases:

| Store | Contents | Prototype form |
| --- | --- | --- |
| Raw | 30 messy rows as in the sheet | `data/raw/skillcase_messy_b2c_leads.csv` |
| Clean | Repaired fields, duplicate links, quality flags | In-memory `CleanLead[]` |
| Intelligence | Classification + enrichment + score + draft outreach | In-memory, then processed file |
| QC | Critic notes, validation errors, review queue | Fields on each processed row |
| Decisions | Human accept / hold / reject | UI state (later: a table) |
| Product facts | Sourced Skillcase claims | `src/lib/product.ts` |

---

## 4. Target output schema

Every input id appears once in the final dataset.

| Field | Meaning |
| --- | --- |
| Lead (`lead_id`, name, phone, email, city, education, experience, goal, german_level, source, last_contacted) | Cleaned identity |
| Relevant | `Relevant` / `Not Relevant` / `Uncertain` |
| Reason | Why that label |
| Confidence | 0–1 |
| Profile | Background a caller can read in 15 seconds |
| Intent | What they are trying to do |
| Need | What Skillcase can help with now |
| Objection | Price, eligibility, confidence, guarantee, etc. |
| Missing information | What sales must collect |
| Opportunity | The real opening (or “do not sell”) |
| Priority | High / Medium / Low plus 0–100 score |
| Next action | Concrete next step |
| Outreach | Personalized draft, or empty |
| QC fields | `is_duplicate`, `duplicate_of`, flags, review reasons, critic notes, sources |

---

## 5. Relevance and priority (product rules)

These rules belong in the architecture so a viva can change them without rewriting the desk.

**Relevant** if the person is a nurse (BSc / GNM / similar) and the goal is Germany or an open Germany-linked path (explore, B2 prep).

**Not relevant** if they are outside healthcare (BBA, engineer) or only want another country (Canada, UK).

**Uncertain** if they are listed allied health (pharmacist, physio, doctor, dentist) or a repaired row is still missing a critical field.

**Priority score (0–100)**

| Signal | Points |
| --- | --- |
| German B2 / B1 / A2 / A1 / unknown | +28 / +18 / +10 / +6 / +4 |
| Experience 5y+ / 3–4 / 1–2 / under 1 / unknown | +18 / +14 / +10 / +6 / +3 |
| Call/ready or B2+jobs / process or eligibility / exploring / cannot afford now | +30 / +20 / +12 / +6 |
| Last contact within 3 / 6 / 10 days (as-of 23 Sep 2026) | +10 / +7 / +4 |
| Email + phone complete | +4 |
| Missing email / job-guarantee ask / cannot-afford-now / installment worry | -8 / -4 / -8 / -3 |

Bands: High >= 70, Medium 45–69, Low < 45. Duplicates are forced Low and never receive a second message.

---

## 6. Project phases

Build and run the system in this order. A later phase must not start until the previous phase’s contract is satisfied.

Code and a write-up for each built phase live at the project root:

- `phase-1-ingest/`
- `phase-2-clean/`
- `phase-3-classify/`
- `phase-4-enrich/`
- `phase-5-qc/`
- `phase-6-prioritize/`
- `phase-7-outreach/`
- `phase-8-assemble/`

See `PHASES.md` for a one-page map.

### Phase 0 — Frame the desk

**Purpose.** Lock ICP, as-of date, and “what good looks like” before touching a model.

**Work**

- Confirm Skillcase is Germany-healthcare, nurse-first.
- Freeze the as-of date for recency (`2026-09-23`).
- Write relevance and priority rules in one place.
- Collect public product facts with URLs (`skillcase.in`, `skillcase.info`).
- Decide: all 30 rows stay in the output.

**Exit.** A one-page ICP + scoring card. No code required beyond config.

---

### Phase 1 — Ingest the Google Sheet

**Purpose.** Make the spreadsheet a typed, replayable raw store.

**Work**

- Export / snapshot the sheet to `data/raw/skillcase_messy_b2c_leads.csv`.
- Parse quoted CSV without “fixing” messy cells.
- Map exactly to `RawLead` (13 source columns).
- Keep a byte-stable copy so judges can diff input vs output.

**Contract in:** Google Sheet  
**Contract out:** `RawLead[]` of length 30  
**Quality gate:** row count = 30; raw `lead_id` values are unique even if people are not.

---

### Phase 2 — Clean, repair, deduplicate

**Purpose.** Restore a row a human would have fixed in Excel.

**Deterministic engines (no LLM)**

1. **Column-shift repair** (apply in this order)
   - Email looks like a city and city looks like a degree → shift fields right; email becomes empty (L029).
   - Experience looks like a goal, goal looks like A1–B2, German level looks like a channel → experience becomes empty (L007).
   - German level looks like a channel and source looks like a date → German level becomes empty (L005, L020, L023).
2. **Normalise** name case, `B.Sc. Nursing` → `BSc Nursing`, `4 yrs` / `2` → years, `GERMANY` → `Work in Germany`.
3. **Validate** email shape, German level in {A1, A2, B1, B2, ...}, source in known channels, date = `YYYY-MM-DD`.
4. **Missing-field list** for blank email, experience, German level, etc.
5. **Dedup** on digits-only phone and lowercased email. First seen id is canonical. Short names (`Priya S.`) still match.

**Contract out:** `CleanLead[]`  
**Quality gate:** L029 city = Chennai and email empty; L001 / L008 / L028 linked; no invented experience years.

---

### Phase 3 — Classify (Gemini LLM)

**Purpose.** Relevant / Not Relevant / Uncertain + reason + confidence.

**Inputs:** cleaned row + Phase 0 rules (ICP, scorecard, sourced product facts).

**Engine: Google Gemini.** Classification is an LLM step, not a local guess. Call the Gemini API (`generateContent`, JSON response) with a locked system prompt and the cleaned lead. Use a current flash-class model (for example `gemini-2.0-flash` or `gemini-1.5-flash`). Auth is `GEMINI_API_KEY`.

The prompt must return only:

```json
{
  "relevant": "Relevant" | "Not Relevant" | "Uncertain",
  "reason": "one or two sentences",
  "confidence": 0.0,
  "criteria": ["rules applied"]
}
```

**Guardrails still apply**

- Phase 0 rules are in the prompt. Gemini must not invent a new ICP.
- Must not trust `notes` as the label.
- If Gemini is unreachable or returns invalid JSON, fail the row into `Uncertain` + human review. Do not silently skip classification.
- A thin rule check after the model (engineer/BBA/Canada/UK cannot be High-confidence Relevant) can flag contradictions for Phase 5.

**Contract out:** `Classification`  
**Quality gate:** engineer / BBA / Canada / UK → Not Relevant; pharmacist → Uncertain; nurse + Germany → Relevant; confidence drops when fields were repaired or are missing.

---

### Phase 4 — Understand and enrich

**Purpose.** Turn conversation + profile into sales context.

Extract signals from `goal` + `conversation` + `notes` (call ask, exam not taken, ICU, installments, GNM worry, job guarantee, other course, explore, etc.).

Then fill:

- Profile
- Intent
- Needs
- Objections
- Missing information
- Opportunity
- Next action
- Sources (only if a public Skillcase fact was used)

**Engine:** deterministic analyst for the always-on path; optional LLM enrich prompt.  
**Hard ban:** inventing fees, employers, visas, or a guaranteed job.

**Contract out:** `Enrichment`

---

### Phase 5 — Quality control (mandatory)

**Purpose.** Stop the pipeline from shipping a bad row.

AI output is **not** auto-accepted. Stack at least:

| Mechanism | What it catches |
| --- | --- |
| Duplicate detector | Same phone/email, different name |
| Rule critic | Outreach on a non-relevant row; High on a non-relevant row; guarantee/price in copy |
| Confidence gate | Review if confidence < 0.70 or label = Uncertain |
| Repair gate | Any `column_shift_*` flag → review |
| Contact gate | Missing email or phone → review |
| Product-vs-CRM conflict | Pharmacist vs “Different profession” |
| Optional second LLM critic | Contradictions the rules missed |
| Human queue | Accept / hold / reject; nothing in queue is auto-sent |

**Required showcase rows (minimum three)**

1. **L029 Deepa Krishnan** — whole-row shift, email missing.
2. **L028 Priya S.** — fuzzy duplicate of L001.
3. **L016 Farhan Ali** — CRM vs product eligibility.
4. **L007 Arjun Nair** (extra) — experience was the goal; do not invent years.

**Contract out:** `QualityReview` + `review_required` on the row.

---

### Phase 6 — Prioritize

**Purpose.** Tell the floor who to call first.

Apply the scorecard from section 5 to cleaned + classified rows. Duplicates inherit Low and a suppress-dial next action.

**Contract out:** `PriorityResult` (`score`, `band`, `rationale`, `breakdown`)

---

### Phase 7 — Personalized outreach

**Purpose.** Draft a message that could not have been a mail-merge.

**Rules**

- Only if `Relevant` and not a duplicate.
- 50–70 words, WhatsApp/email tone. No repeated sentences. No internal words (on file, row, field, CRM). Over 80 words fails QC and regenerates.
- Must use this row’s city, qualification, German level, and the objection they actually raised.
- End with one next step.
- Empty string otherwise.

**Engine:** template-from-signals (always on) or outreach LLM prompt (optional).  
**Quality gate:** critic rejects invented rupee amounts, job guarantees, unsourced product/employer/eligibility claims, and GNM “you can apply” lines. Review-queue GNM drafts must say we will confirm eligibility.

---

### Phase 8 — Assemble, export, UI page, slides

**Purpose.** Make the work usable in a viva and on a Monday morning. This phase ships the **project UI**, not only files.

**Work**

- Join Phases 2–7 into `ProcessedLead` for all 30 ids.
- Write `data/processed/skillcase_leads_enriched.csv` and `.json`.
- **UI page (required).** A counsellor-facing web page is part of this phase. It is the interactive prototype judges open. Minimum surfaces on that page (or as routes from it):
  - Run / re-run the pipeline and show phase progress (including Phase 3 Gemini classification).
  - Lead list with filters (relevant, priority, review, duplicates).
  - Lead detail: cleaned fields, reason, profile, intent, need, objection, missing info, priority, next action, outreach, sources, critic notes.
  - Human review queue with accept / hold / reject.
  - Export CSV and JSON for all 30 leads.
- Five slides only: Input · Architecture · AI processing · Quality checks (with a broken row) · Final output. Link the slides from the UI page.

**Contract out:** UI page + runnable prototype + final dataset + 5-slide walkthrough.

---

## 7. Phase dependency map

```
Phase 0  Frame
   |
Phase 1  Ingest sheet
   |
Phase 2  Clean / repair / dedupe          (automatic, rules only)
   |
   +---------------+
   |               |
Phase 3 Classify   Phase 4 Enrich         (Phase 3 = Gemini LLM)
   |               |
   +-------+-------+
           |
Phase 5  QC / critic / queue              (must run before send)
           |
Phase 6  Prioritize
           |
Phase 7  Outreach (relevant + unique only)
           |
Phase 8  Final dataset + UI page + slides
```

Phases 3 and 4 may run in parallel on a cleaned row. Phase 5 must see both. Phase 7 must see Phases 3, 4, 5, and 6.

---

## 8. Runtime and interfaces

### Gemini path (Phase 3)

Phase 3 calls the **Gemini API** with `GEMINI_API_KEY`. The classify prompt lives in one file so a viva can change a requirement without hunting through the UI.

If Gemini fails or returns invalid JSON, the row is `Uncertain`, `review_required` is set, and the rest of the pipeline still finishes all 30 rows.

Phases 4 / 5 / 7 may also use Gemini, or a deterministic analyst, as long as Phase 3 remains a Gemini step.

### UI path (Phase 8)

The last phase is not export-only. Judges open a **UI page**, run the pipeline, inspect leads, work the review queue, and download the final dataset.

### Suggested module boundaries

| Module | Phase | Responsibility |
| --- | --- | --- |
| `product` | 0 | ICP, scorecard, sourced facts |
| `csv` / `load` | 1 | Sheet → `RawLead[]` |
| `clean` + `dedupe` | 2 | Repair and identity |
| `classify` | 3 | Relevance via **Gemini LLM** |
| `understand` | 4 | Enrichment + sources |
| `qc` / critic | 5 | Validation + queue |
| `prioritize` | 6 | Score |
| `outreach` | 7 | Draft or empty |
| `pipeline` orchestrator | all | Order, mode, summaries |
| `prompts` + Gemini client | 3 | Classify (and optionally 4 / 5 / 7) |
| UI page + `/presentation` | 8 | Counsellor page, review queue, export, slides |

---

## 9. What “done” means per phase

| Phase | Done when |
| --- | --- |
| 0 | ICP and scorecard written; sources listed |
| 1 | 30 raw rows load without silent drops |
| 2 | Shifted rows repaired; 3 duplicate copies linked; missing fields listed |
| 3 | Every row classified by Gemini: Relevant / Not / Uncertain + reason + confidence |
| 4 | Every row has profile, intent, need, objection, missing info, opportunity, next action |
| 5 | At least 3 documented catches; review queue non-empty; no auto-send from the queue |
| 6 | Every unique relevant row has a score and band; duplicates are Low |
| 7 | Relevant unique rows have a specific draft; others are blank |
| 8 | UI page live; CSV/JSON for all 30; 5 slides linked from the UI |

---

## 10. Out of scope (on purpose)

- Live write-back to the Google Sheet.
- A production CRM, auth, or multi-user permissions.
- Scraping personal social profiles of named leads.
- Guaranteeing a German job or quoting a fee the sheet does not contain.
- Deleting duplicate ids from the submitted file.

Those can sit behind a later “CRM sync” phase; they are not required to prove the workflow.

---

## 11. Viva change points

The architecture is built so a reviewer can ask for a small change without a rewrite:

- Change a relevance rule → Phase 0 / `product`.
- Change a prompt → `prompts` only.
- Add a validation (“reject outreach that mentions a city not on the cleaned row”) → Phase 5.
- Explain an API call → Gemini `generateContent` in the Phase 3 client.
- Debug a bad row → show Raw vs Clean vs QC on that `lead_id`.
