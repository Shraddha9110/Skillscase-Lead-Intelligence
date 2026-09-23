import { SCORECARD } from "../phase-6-prioritize/scorecard";

export const RELEVANCE_CRITERIA = [
  "Relevant if the person is a nurse (BSc / GNM / similar) and the goal is Germany or a Germany-linked path.",
  "Not relevant if they are outside healthcare (BBA, engineer) or only want Canada or the UK.",
  "Uncertain if they are listed allied health (pharmacist) or a repaired row is still missing a critical field.",
  "CRM notes are hints, not ground truth."
];

export const PRIORITY_CRITERIA = SCORECARD;

export const PIPELINE_STEPS = [
  { id: "ingest", title: "Ingest", summary: "Load 30 raw rows from the Google Sheet snapshot. Do not repair." },
  { id: "clean", title: "Clean / repair", summary: "Keep empty cells empty, flag missing fields, normalise values, dedupe." },
  {
    id: "classify",
    title: "Classify (Gemini)",
    summary: "Relevant / Not Relevant / Uncertain. Reason cites the lead. Confidence is per-lead, not a category default."
  },
  { id: "enrich", title: "Enrich (Gemini)", summary: "AI sales context. Phase 4 signals only if Gemini fails or quota is hit." },
  { id: "qc", title: "Quality control", summary: "Critic, gates, human review queue. Nothing auto-sent." },
  { id: "prioritize", title: "Prioritize", summary: "Score 0–100 and High / Medium / Low." },
  { id: "outreach", title: "Outreach (Gemini)", summary: "AI 50–70 word draft through criticOutreach. Templates only on Gemini failure." },
  { id: "assemble", title: "Assemble + desk", summary: "Final CSV/JSON, counsellor UI, and 5 slides." }
];
