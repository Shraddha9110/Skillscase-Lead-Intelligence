# Phase 6 — Prioritize

**Folder:** `phase-6-prioritize/`  
**Job:** Tell the floor who to call first. Score 0–100, then High / Medium / Low.

## What we did

Applied the Phase 0 scorecard (architecture section 5) to every Phase 5 row:

| Signal | Points |
| --- | --- |
| German B2 / B1 / A2 / A1 / unknown | +28 / +18 / +10 / +6 / +4 |
| Experience 5y+ / 3–4 / 1–2 / under 1 / unknown | +18 / +14 / +10 / +6 / +3 |
| Call/ready or B2+jobs / process or eligibility / exploring / cannot afford now | +30 / +20 / +12 / +6 |
| Last contact within 3 / 6 / 10 days (as-of 23 Sep 2026) | +10 / +7 / +4 |
| Email + phone complete | +4 |
| Missing email / job-guarantee ask / cannot-afford-now / installment | −8 / −4 / −8 / −3 |

Bands: **High ≥ 70**, **Medium 45–69**, **Low < 45**.

Hard floors:

- Duplicates (L008, L021, L028) are **Low**, `dialSuppressed`, next action is merge + suppress-dial.
- Not Relevant (BBA, engineer, Canada, UK) is **Low**. Never High.
- Unique Relevant rows keep a real score and a call-list rank.

This phase is deterministic. It does not call Gemini.

## Contract

| | |
| --- | --- |
| In | Phase 5 `ReviewedLead[]` |
| Out | `PrioritizedLead[]` (`score`, `band`, `rationale`, `breakdown`, `callOrder`) |
| Gate | 30 rows. Duplicates Low. No High on Not Relevant. At least one unique Relevant High. |

## Files

| File | What it does |
| --- | --- |
| `types.ts` | `PriorityResult`, `PrioritizedLead` |
| `scorecard.ts` | Frozen points and as-of date |
| `prioritize.ts` | Score one row + call order |
| `run.ts` | `runPhase6` + quality gate |
| `prioritize.test.ts` | Tests for bands, floors, penalties |

## How to test

```bash
npm run test:phase6
```

Expected: 12 passed.
