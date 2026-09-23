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
  gnm: {
    fact: "A 3-year nursing qualification such as GNM is described as eligible for the Germany nursing pathway, subject to recognition.",
    source: "https://skillcase.in/blog-view?id=13"
  }
} as const;

export type SourceKey = keyof typeof PRODUCT_SOURCES;

export function formatSource(key: SourceKey): string {
  const item = PRODUCT_SOURCES[key];
  return `${item.fact} — ${item.source}`;
}
