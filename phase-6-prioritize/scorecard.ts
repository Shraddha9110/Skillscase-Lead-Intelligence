/** Frozen as-of date for recency. Same as Phase 0 / architecture section 5. */
export const AS_OF_DATE = "2026-09-23";

export const HIGH_MIN = 70;
export const MEDIUM_MIN = 45;

export const DUPLICATE_SCORE = 8;
export const OUT_OF_ICP_SCORE = 12;

export const GERMAN_POINTS = {
  B2: 28,
  B1: 18,
  A2: 10,
  A1: 6,
  unknown: 4
} as const;

export const EXPERIENCE_POINTS = {
  fivePlus: 18,
  threeToFour: 14,
  oneToTwo: 10,
  underOne: 6,
  unknown: 3
} as const;

export const INTENT_POINTS = {
  callOrJobs: 30,
  processOrEligibility: 20,
  exploring: 12,
  cannotAfford: 6
} as const;

export const RECENCY_POINTS = {
  within3: 10,
  within6: 7,
  within10: 4,
  older: 2,
  unknown: 0
} as const;

export const COMPLETENESS_POINTS = 4;

export const PENALTY_POINTS = {
  missingEmail: -8,
  jobGuarantee: -4,
  cannotAfford: -8,
  installment: -3
} as const;

export const SCORECARD = [
  "Score 0–100, then band: High ≥ 70, Medium 45–69, Low < 45.",
  "German: B2 +28, B1 +18, A2 +10, A1 +6, unknown +4.",
  "Experience: 5y+ +18, 3–4y +14, 1–2y +10, <1y +6, unknown +3.",
  "Intent: call/ready or B2+jobs +30; process/eligibility +20; exploring +12; cannot afford now +6.",
  "Recency vs 23 Sep 2026: ≤3 days +10, ≤6 +7, ≤10 +4, older +2.",
  "Email + phone complete +4.",
  "Penalties: missing email −8, job-guarantee ask −4, cannot-afford-now −8, installment worry −3.",
  "Duplicates are forced Low and suppressed from the dialer. Not Relevant is forced Low."
];
