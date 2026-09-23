/** Public Skillcase facts used for enrichment. Every claim is tagged with a source. */

export const AS_OF_DATE = "2026-09-23";

export const RELEVANCE_CRITERIA = [
  "Relevant if the person is a healthcare professional Skillcase actually serves (nurses first; also pharmacists, doctors, physiotherapists, dentists) and is exploring Germany or a Germany-linked pathway.",
  "Not relevant if the person is outside healthcare (engineering, generic BBA) or is only asking for a non-Germany market (Canada-only, UK-only).",
  "Uncertain if the profession is adjacent, the destination is mixed, or repaired fields still leave a critical gap.",
  "CRM notes are treated as hints, not ground truth — they can be wrong (e.g. pharmacists are listed on Skillcase signup)."
];

export const PRIORITY_CRITERIA = [
  "Score 0–100, then band: High ≥ 70, Medium 45–69, Low < 45.",
  "German readiness: B2 +28, B1 +18, A2 +10, A1 +6, unknown +4.",
  "Experience: 5y+ +18, 3–4y +14, 1–2y +10, <1y +6, unknown +3.",
  "Intent: asked for a call / ready to start / jobs+interviews +30; process/docs/timeline +20; exploring +12; later/cannot afford now +6.",
  "Recency vs 23 Sep 2026: last 2 days +10, 3–5 days +7, 6–10 days +4, older +2.",
  "Penalties: missing email −8, job-guarantee expectation −4, cannot-afford-now −8, hard price worry −3, confidence worry −2.",
  "Not relevant leads are capped at 22. Duplicate copies inherit the canonical score but are never High for outreach."
];

export const PRODUCT_SOURCES = {
  language: {
    fact: "Skillcase teaches healthcare-focused German from A1 to B2, with TELC/Goethe exam prep and live classes.",
    source: "https://skillcase.in/"
  },
  b2Required: {
    fact: "B2 German is commonly required for healthcare careers in Germany; B1 is often the point where job conversations start.",
    source: "https://skillcase.in/"
  },
  notOnlyNurses: {
    fact: "Programs are primarily for nurses but also support other healthcare professionals preparing for Germany.",
    source: "https://skillcase.in/"
  },
  qualifications: {
    fact: "Signup lists GNM, BSc, Post-Basic BSc, MSc, ANM Nursing, physiotherapists, doctors, pharmacists and dentists.",
    source: "https://skillcase.in/create-account-new"
  },
  placements: {
    fact: "skillcase.info markets job search, employer matching, interview support, visa and documentation help for healthcare roles in Germany.",
    source: "https://www.skillcase.info/"
  },
  timeline: {
    fact: "After language training, Skillcase cites ~2–3 weeks to interview/offer and another 7–8 weeks for visa/documentation.",
    source: "https://www.skillcase.info/"
  },
  demand: {
    fact: "Skillcase cites 500,000+ healthcare professionals required in Germany by 2030.",
    source: "https://skillcase.in/"
  },
  zeroRecruit: {
    fact: "Job-side signup copy says “zero recruitment cost”; language-course fees are a separate conversation and must not be invented.",
    source: "https://skillcase.in/create-account-new"
  },
  gnm: {
    fact: "A 3-year nursing qualification such as GNM is described as eligible for the Germany nursing pathway, subject to recognition.",
    source: "https://skillcase.in/blog-view?id=13"
  }
};

export const NURSING_DEGREES = [
  "bsc nursing",
  "b.sc nursing",
  "b.sc. nursing",
  "gnm",
  "anm",
  "msc nursing",
  "post basic"
];

export const HEALTHCARE_DEGREES = [
  ...NURSING_DEGREES,
  "bpharm",
  "b.pharm",
  "pharmacist",
  "mbbs",
  "doctor",
  "physiotherapist",
  "dentist",
  "bds"
];

export const NON_HEALTHCARE = ["bba", "engineer", "engineering", "btech", "b.tech", "mba", "commerce"];

export const KNOWN_SOURCES = ["instagram", "whatsapp", "referral", "website", "facebook"];
export const GERMAN_LEVELS = ["a1", "a2", "b1", "b2", "c1", "c2"];
export const INDIAN_CITIES = [
  "bangalore",
  "bengaluru",
  "hyderabad",
  "delhi",
  "mumbai",
  "pune",
  "chennai",
  "kolkata",
  "kochi",
  "ahmedabad",
  "lucknow",
  "jaipur",
  "noida",
  "chandigarh",
  "patna"
];
