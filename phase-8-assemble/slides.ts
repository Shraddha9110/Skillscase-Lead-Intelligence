export const SLIDES = [
  { id: "input", kicker: "01 · Input", title: "30 messy B2C leads" },
  { id: "architecture", kicker: "02 · Architecture", title: "A pipeline, not a single prompt" },
  { id: "ai", kicker: "03 · AI processing", title: "Relevance and copy from the lead’s situation" },
  { id: "qc", kicker: "04 · Quality checks", title: "Catch a broken row before it ships" },
  { id: "output", kicker: "05 · Final output", title: "A list a counsellor can work on Monday" }
] as const;

export const UI_SURFACES = {
  home: "src/app/page.tsx",
  desk: "src/components/Prototype.tsx",
  slides: "src/app/presentation/page.tsx"
} as const;

export const DESK_MUST_INCLUDE = [
  "Re-run pipeline",
  "Lead list",
  "accepted",
  "held",
  "rejected",
  "Download CSV",
  "Download JSON",
  "Gemini"
];
