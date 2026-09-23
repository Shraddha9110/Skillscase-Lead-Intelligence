"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

const slides = [
  {
    kicker: "01 · Input",
    title: "30 messy B2C leads. A counsellor should not have to clean this by hand.",
    body: "The Skillcase sheet mixes duplicates, shifted columns, missing email, inconsistent degrees, and conversations that hide the real objection.",
    points: [
      "L029: city sat in the email column. Seven fields slid left.",
      "L001 / L008 / L028: same Priya, three names and one phone.",
      "L005 / L020 / L023: Instagram written where German level should be.",
      "Useful signal is in the chat: cost, GNM recognition, job guarantee, “call tomorrow”."
    ]
  },
  {
    kicker: "02 · Architecture",
    title: "A pipeline, not a single prompt.",
    body: "Each step has a job. Rules repair the sheet. Analyst steps interpret the person. A critic refuses to auto-send.",
    points: [
      "Raw CSV → Clean / repair → Deduplicate",
      "Classify (Relevant / Not / Uncertain + confidence)",
      "Understand: profile, intent, need, objection, missing info, opportunity",
      "Evaluate + human queue → Prioritize 0–100 → Personalized outreach → Final dataset"
    ]
  },
  {
    kicker: "03 · AI processing",
    title: "Relevance and copy come from the lead’s situation, not a mail merge.",
    body: "Skillcase is Germany healthcare: language A1–B2, documents, interviews, employer match. Nurses first; pharmacists are listed but not auto-approved.",
    points: [
      "Relevant: nursing + Germany. Not relevant: engineer, BBA, Canada-only, UK-only.",
      "Priority: German level, experience, intent, recency. Penalties for missing email or “do you guarantee a job?”",
      "Outreach names the actual worry — GNM, installments, ICU + B2, exam not taken.",
      "Public facts are sourced: skillcase.in, skillcase.info. No invented prices or job guarantees."
    ]
  },
  {
    kicker: "04 · Quality checks",
    title: "The system is built to catch itself.",
    body: "AI-generated output is not accepted automatically. Duplicate keys, schema checks, confidence < 0.70, and a second critic all create a review queue.",
    points: [
      "Problem: Deepa’s row would have looked like a person named Deepa whose city is “BSc Nursing”.",
      "Handling: column-shift repair, email left blank, WhatsApp-only next step, human review forced.",
      "Also caught: Priya S. as a fuzzy duplicate; Farhan the pharmacist vs a CRM note that said “irrelevant”.",
      "Arjun’s “Germany job” was sitting in experience — we do not invent years of work."
    ]
  },
  {
    kicker: "05 · Final output",
    title: "A list a salesperson can work on Monday morning.",
    body: "All 30 rows are kept. Duplicates are marked, not deleted. High-priority B2 nurses go first. Non-fits get a clean close.",
    points: [
      "Schema: Lead, Relevant, Reason, Intent, Profile, Need, Objection, Missing information, Priority, Next action, Outreach.",
      "Call first: ready-now and B2 job-ready nurses (Kavya, Neha, Ritika, Sonal, Pooja, Deepa).",
      "Do not dial: duplicates, software/BBA, Canada-only, UK-only.",
      "Re-run live in the prototype. Export CSV / JSON. Change a prompt in src/lib/prompts.ts."
    ]
  }
];

export default function PresentationPage() {
  const [index, setIndex] = useState(0);
  const slide = slides[index];

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "ArrowRight" || event.key === " ") setIndex((i) => Math.min(slides.length - 1, i + 1));
      if (event.key === "ArrowLeft") setIndex((i) => Math.max(0, i - 1));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <div className="paper-grid min-h-screen px-6 py-6">
      <div className="mx-auto flex max-w-6xl items-center justify-between">
        <Link href="/" className="text-sm text-muted">
          ← Prototype
        </Link>
        <p className="text-sm text-muted">
          {index + 1} / {slides.length} · arrow keys
        </p>
      </div>
      <article className="slide-enter mx-auto mt-8 flex min-h-[78vh] max-w-6xl flex-col justify-between rounded-[32px] border border-line bg-card px-8 py-10 shadow-card md:px-16 md:py-14">
        <div>
          <p className="text-[12px] uppercase tracking-[0.22em] text-teal">{slide.kicker}</p>
          <h1 className="mt-4 max-w-4xl font-display text-4xl leading-tight md:text-5xl">{slide.title}</h1>
          <p className="mt-5 max-w-3xl text-lg text-muted">{slide.body}</p>
          <ul className="mt-8 grid gap-3 md:grid-cols-2">
            {slide.points.map((point) => (
              <li key={point} className="rounded-2xl bg-paper px-4 py-3 text-sm leading-relaxed">
                {point}
              </li>
            ))}
          </ul>
        </div>
        <div className="mt-10 flex items-center justify-between">
          <button
            onClick={() => setIndex((i) => Math.max(0, i - 1))}
            className="rounded-full border border-line px-4 py-2 text-sm disabled:opacity-40"
            disabled={index === 0}
          >
            Back
          </button>
          <div className="flex gap-2">
            {slides.map((item, i) => (
              <button
                key={item.kicker}
                onClick={() => setIndex(i)}
                className={`h-2.5 w-2.5 rounded-full ${i === index ? "bg-teal" : "bg-line"}`}
              />
            ))}
          </div>
          <button
            onClick={() => setIndex((i) => Math.min(slides.length - 1, i + 1))}
            className="rounded-full bg-teal px-4 py-2 text-sm text-white disabled:opacity-40"
            disabled={index === slides.length - 1}
          >
            Next
          </button>
        </div>
      </article>
    </div>
  );
}
