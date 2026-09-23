"use client";

import { OUTPUT_COLUMNS, toCsv } from "@/lib/csv";
import { loadRawLeads } from "@/lib/load";
import { runPipeline } from "@/lib/pipeline";
import type { PipelineResult, ProcessedLead, RawLead } from "@/lib/types";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

type View = "pipeline" | "leads" | "review" | "output";
type Filter = "all" | "relevant" | "not" | "uncertain" | "high" | "review" | "duplicate";
type Decision = "accepted" | "held" | "rejected";

const rawLeads = loadRawLeads();

function badge(value: string) {
  if (value === "High" || value === "Relevant") return "bg-teal-soft text-teal-deep";
  if (value === "Medium" || value === "Uncertain") return "bg-amber-50 text-clay";
  if (value === "Low" || value === "Not Relevant") return "bg-rose-50 text-rose";
  return "bg-paper text-muted";
}

function download(name: string, body: string, type: string) {
  const url = URL.createObjectURL(new Blob([body], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

export function Prototype() {
  const [result, setResult] = useState<PipelineResult | null>(null);
  const [running, setRunning] = useState(false);
  const [activeStep, setActiveStep] = useState(-1);
  const [view, setView] = useState<View>("pipeline");
  const [filter, setFilter] = useState<Filter>("all");
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState("L013");
  const [decisions, setDecisions] = useState<Record<string, Decision>>({});

  async function run() {
    setRunning(true);
    setActiveStep(0);
    for (let i = 0; i < 7; i += 1) {
      setActiveStep(i);
      await new Promise((resolve) => setTimeout(resolve, 220));
    }
    const next = await runPipeline(rawLeads);
    setResult(next);
    setRunning(false);
    setActiveStep(-1);
  }

  useEffect(() => {
    run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const leads = result?.leads || [];
  const selected = leads.find((lead) => lead.lead_id === selectedId) || leads[0];
  const rawSelected = rawLeads.find((lead) => lead.lead_id === selected?.lead_id);

  const filtered = useMemo(() => {
    return leads.filter((lead) => {
      const hay = `${lead.lead_id} ${lead.name} ${lead.city} ${lead.education} ${lead.intent}`.toLowerCase();
      if (query && !hay.includes(query.toLowerCase())) return false;
      if (filter === "relevant") return lead.relevant === "Relevant" && !lead.is_duplicate;
      if (filter === "not") return lead.relevant === "Not Relevant";
      if (filter === "uncertain") return lead.relevant === "Uncertain";
      if (filter === "high") return lead.priority === "High" && !lead.is_duplicate;
      if (filter === "review") return lead.review_required;
      if (filter === "duplicate") return lead.is_duplicate;
      return true;
    });
  }, [leads, filter, query]);

  const reviewQueue = leads.filter((lead) => lead.review_required);

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-20 border-b border-line/80 bg-paper/85 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-5 py-3">
          <div>
            <p className="text-[11px] uppercase tracking-[0.18em] text-teal">Skillcase · B2C</p>
            <h1 className="font-display text-xl font-semibold tracking-tight">Lead Intelligence</h1>
          </div>
          <nav className="hidden items-center gap-1 md:flex">
            {(
              [
                ["pipeline", "Pipeline"],
                ["leads", "Lead list"],
                ["review", "Quality checks"],
                ["output", "Final dataset"]
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                onClick={() => setView(id)}
                className={`rounded-full px-3 py-1.5 text-sm ${view === id ? "bg-ink text-card" : "text-muted hover:text-ink"}`}
              >
                {label}
              </button>
            ))}
            <Link href="/presentation" className="rounded-full px-3 py-1.5 text-sm text-muted hover:text-ink">
              5 slides
            </Link>
          </nav>
          <div className="flex gap-2">
            <button
              onClick={run}
              disabled={running}
              className="rounded-full bg-teal px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
            >
              {running ? "Running…" : "Re-run pipeline"}
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-5 py-6">
        <section className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
          <Stat label="Input rows" value={result?.inputCount ?? 30} />
          <Stat label="Unique people" value={result?.uniquePeople ?? "—"} />
          <Stat label="Relevant" value={result?.relevantCount ?? "—"} />
          <Stat label="Duplicates" value={result?.duplicateCount ?? "—"} />
          <Stat label="Repaired rows" value={result?.repairedCount ?? "—"} />
          <Stat label="Human review" value={result?.reviewCount ?? "—"} />
        </section>

        {view === "pipeline" && <PipelineView result={result} activeStep={activeStep} rawLeads={rawLeads} />}
        {view === "leads" && (
          <LeadsView
            filtered={filtered}
            selected={selected}
            rawSelected={rawSelected}
            filter={filter}
            setFilter={setFilter}
            query={query}
            setQuery={setQuery}
            onSelect={setSelectedId}
          />
        )}
        {view === "review" && (
          <ReviewView
            result={result}
            reviewQueue={reviewQueue}
            decisions={decisions}
            setDecisions={setDecisions}
            onOpen={(id) => {
              setSelectedId(id);
              setView("leads");
            }}
          />
        )}
        {view === "output" && result && <OutputView result={result} />}
      </main>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-2xl border border-line bg-card px-4 py-3 shadow-card">
      <p className="text-[11px] uppercase tracking-[0.14em] text-muted">{label}</p>
      <p className="mt-1 font-display text-2xl">{value}</p>
    </div>
  );
}

function PipelineView({
  result,
  activeStep,
  rawLeads
}: {
  result: PipelineResult | null;
  activeStep: number;
  rawLeads: RawLead[];
}) {
  const steps = result?.steps || [
    { id: "clean", title: "Clean / repair", summary: "Fix shifted columns, missing fields, inconsistent values." },
    { id: "dedupe", title: "Deduplicate", summary: "Phone + email, including shortened names." },
    { id: "classify", title: "Classify", summary: "Relevant / Not Relevant / Uncertain." },
    { id: "understand", title: "Understand + enrich", summary: "Profile, intent, needs, objections, sources." },
    { id: "qc", title: "Quality control", summary: "Critic, schema checks, review queue." },
    { id: "prioritize", title: "Prioritize", summary: "0–100 score and High / Medium / Low." },
    { id: "outreach", title: "Outreach", summary: "Personalized message, or blank if not relevant." }
  ];

  const messy = rawLeads.find((l) => l.lead_id === "L029");

  return (
    <div className="space-y-6">
      <div className="rounded-3xl border border-line bg-card p-6 shadow-card">
        <p className="text-[11px] uppercase tracking-[0.16em] text-teal">Automatic workflow</p>
        <h2 className="mt-1 font-display text-3xl">Messy sheet in. Actionable list out.</h2>
        <p className="mt-2 max-w-3xl text-muted">
          The 30-row Skillcase spreadsheet is cleaned, classified, enriched, scored and drafted for outreach. AI output is
          not trusted blindly — a second critic plus rules send doubtful rows to a human queue.
        </p>
        <div className="mt-6 grid gap-3 md:grid-cols-7">
          {steps.map((step, index) => (
            <div
              key={step.id}
              className={`rounded-2xl border px-3 py-3 ${
                activeStep === index ? "border-teal bg-teal-soft" : "border-line bg-paper"
              }`}
            >
              <p className="text-[11px] text-muted">0{index + 1}</p>
              <p className="font-medium leading-tight">{step.title}</p>
              <p className="mt-1 text-xs text-muted">{step.summary}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-3xl border border-line bg-card p-5 shadow-card">
          <h3 className="font-display text-xl">What the sheet actually contained</h3>
          <p className="mt-1 text-sm text-muted">L029 Deepa Krishnan arrived with the city sitting in the email column.</p>
          <div className="mt-4 overflow-x-auto text-xs">
            <table className="w-full min-w-[520px] text-left">
              <thead className="text-muted">
                <tr>
                  {["email", "city", "education", "experience", "goal", "german"].map((h) => (
                    <th key={h} className="pb-2 font-medium">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <tr className="align-top text-rose">
                  <td className="pr-3">{messy?.email}</td>
                  <td className="pr-3">{messy?.city}</td>
                  <td className="pr-3">{messy?.education}</td>
                  <td className="pr-3">{messy?.experience}</td>
                  <td className="pr-3">{messy?.goal}</td>
                  <td>{messy?.german_level}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
        <div className="rounded-3xl border border-line bg-card p-5 shadow-card">
          <h3 className="font-display text-xl">Relevance and priority, in the open</h3>
          <ul className="mt-3 space-y-2 text-sm text-muted">
            {(result?.relevanceCriteria || []).slice(0, 3).map((item) => (
              <li key={item}>• {item}</li>
            ))}
          </ul>
          <p className="mt-4 text-sm text-muted">
            High ≥ 70, Medium 45–69, Low &lt; 45. German level, experience, intent, recency, and penalties for missing
            email or a job-guarantee ask.
          </p>
        </div>
      </div>
    </div>
  );
}

function LeadsView({
  filtered,
  selected,
  rawSelected,
  filter,
  setFilter,
  query,
  setQuery,
  onSelect
}: {
  filtered: ProcessedLead[];
  selected?: ProcessedLead;
  rawSelected?: RawLead;
  filter: Filter;
  setFilter: (value: Filter) => void;
  query: string;
  setQuery: (value: string) => void;
  onSelect: (id: string) => void;
}) {
  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_380px]">
      <div className="rounded-3xl border border-line bg-card shadow-card">
        <div className="flex flex-wrap items-center gap-2 border-b border-line px-4 py-3">
          {(
            [
              ["all", "All"],
              ["high", "Call first"],
              ["relevant", "Relevant"],
              ["uncertain", "Uncertain"],
              ["review", "Review"],
              ["duplicate", "Duplicates"],
              ["not", "Not relevant"]
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              onClick={() => setFilter(id)}
              className={`rounded-full px-3 py-1 text-xs ${filter === id ? "bg-ink text-card" : "bg-paper text-muted"}`}
            >
              {label}
            </button>
          ))}
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search name, city, intent"
            className="ml-auto w-full rounded-full border border-line bg-paper px-3 py-1.5 text-sm sm:w-56"
          />
        </div>
        <div className="max-h-[680px] overflow-auto">
          <table className="w-full text-left text-sm">
            <thead className="sticky top-0 bg-card text-xs uppercase tracking-wider text-muted">
              <tr>
                <th className="px-4 py-3">Lead</th>
                <th>Relevant</th>
                <th>Priority</th>
                <th>Intent</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((lead) => (
                <tr
                  key={lead.lead_id}
                  onClick={() => onSelect(lead.lead_id)}
                  className={`cursor-pointer border-t border-line/70 ${
                    selected?.lead_id === lead.lead_id ? "bg-teal-soft/60" : "hover:bg-paper"
                  }`}
                >
                  <td className="px-4 py-3">
                    <p className="font-medium">
                      {lead.lead_id} · {lead.name}
                    </p>
                    <p className="text-xs text-muted">
                      {lead.city || "—"} · {lead.education} · {lead.german_level || "German?"}
                    </p>
                  </td>
                  <td>
                    <span className={`rounded-full px-2 py-0.5 text-xs ${badge(lead.relevant)}`}>{lead.relevant}</span>
                  </td>
                  <td>
                    <span className={`rounded-full px-2 py-0.5 text-xs ${badge(lead.priority)}`}>
                      {lead.priority} {lead.priority_score}
                    </span>
                  </td>
                  <td className="max-w-[220px] truncate pr-3 text-xs text-muted">{lead.intent}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {selected && (
        <aside className="slide-enter rounded-3xl border border-line bg-card p-5 shadow-card">
          <p className="text-[11px] uppercase tracking-[0.16em] text-teal">{selected.lead_id}</p>
          <h3 className="font-display text-2xl">{selected.name}</h3>
          <p className="text-sm text-muted">
            {selected.phone} · {selected.email || "email missing"} · {selected.city}
          </p>
          <div className="mt-3 flex flex-wrap gap-2 text-xs">
            <span className={`rounded-full px-2 py-1 ${badge(selected.relevant)}`}>{selected.relevant}</span>
            <span className={`rounded-full px-2 py-1 ${badge(selected.priority)}`}>
              {selected.priority} · {selected.priority_score}
            </span>
            {selected.is_duplicate && (
              <span className="rounded-full bg-paper px-2 py-1">Duplicate of {selected.duplicate_of}</span>
            )}
            {selected.review_required && <span className="rounded-full bg-amber-50 px-2 py-1 text-clay">Needs review</span>}
          </div>
          <Field label="Reason" value={selected.reason} />
          <Field label="Profile" value={selected.profile} />
          <Field label="Intent" value={selected.intent} />
          <Field label="Need" value={selected.need} />
          <Field label="Objection" value={selected.objection} />
          <Field label="Missing information" value={selected.missing_information} />
          <Field label="Opportunity" value={selected.opportunity} />
          <Field label="Next action" value={selected.next_action} />
          {selected.outreach ? (
            <div className="mt-4 rounded-2xl bg-paper p-3 text-sm">
              <p className="text-[11px] uppercase tracking-[0.14em] text-muted">Outreach</p>
              <p className="mt-1 whitespace-pre-wrap">{selected.outreach}</p>
            </div>
          ) : (
            <p className="mt-4 text-sm text-muted">No outreach — not relevant, or a duplicate.</p>
          )}
          {selected.sources && <Field label="Public sources used" value={selected.sources} />}
          {selected.critic_notes && <Field label="Critic / QC" value={selected.critic_notes} />}
          {rawSelected && rawSelected.email !== selected.email && (
            <p className="mt-3 text-xs text-clay">
              Cleaner repaired this row. Raw email cell was “{rawSelected.email || "empty"}”.
            </p>
          )}
        </aside>
      )}
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="mt-3">
      <p className="text-[11px] uppercase tracking-[0.14em] text-muted">{label}</p>
      <p className="mt-1 text-sm leading-relaxed">{value}</p>
    </div>
  );
}

function ReviewView({
  result,
  reviewQueue,
  decisions,
  setDecisions,
  onOpen
}: {
  result: PipelineResult | null;
  reviewQueue: ProcessedLead[];
  decisions: Record<string, Decision>;
  setDecisions: (value: Record<string, Decision>) => void;
  onOpen: (id: string) => void;
}) {
  return (
    <div className="space-y-5">
      <div className="rounded-3xl border border-line bg-card p-6 shadow-card">
        <h2 className="font-display text-3xl">AI output is not auto-accepted</h2>
        <p className="mt-2 max-w-3xl text-muted">
          Every row goes through duplicate detection, structured-field validation, confidence thresholds, and a second
          critic. These are four cases where the system caught a problem instead of trusting the first pass.
        </p>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        {(result?.qcExamples || []).map((example) => (
          <article key={example.id} className="rounded-3xl border border-line bg-card p-5 shadow-card">
            <p className="text-[11px] uppercase tracking-[0.16em] text-clay">{example.leadId}</p>
            <h3 className="mt-1 font-display text-xl">{example.title}</h3>
            <p className="mt-3 text-sm">
              <span className="font-medium">Problem. </span>
              {example.problem}
            </p>
            <p className="mt-2 text-sm text-muted">
              <span className="font-medium text-ink">How it was handled. </span>
              {example.handling}
            </p>
            <button onClick={() => onOpen(example.leadId)} className="mt-4 text-sm text-teal">
              Open this lead →
            </button>
          </article>
        ))}
      </div>
      <div className="rounded-3xl border border-line bg-card shadow-card">
        <div className="border-b border-line px-5 py-4">
          <h3 className="font-display text-xl">Human review queue</h3>
          <p className="text-sm text-muted">Accept, hold, or reject. Nothing in this queue is auto-sent.</p>
        </div>
        <div className="divide-y divide-line">
          {reviewQueue.map((lead) => (
            <div key={lead.lead_id} className="flex flex-col gap-3 px-5 py-4 md:flex-row md:items-center">
              <button onClick={() => onOpen(lead.lead_id)} className="text-left md:w-56">
                <p className="font-medium">
                  {lead.lead_id} · {lead.name}
                </p>
                <p className="text-xs text-muted">{lead.review_reasons || "Flagged by critic"}</p>
              </button>
              <p className="flex-1 text-sm text-muted">{lead.critic_notes || lead.reason}</p>
              <div className="flex gap-2">
                {(["accepted", "held", "rejected"] as const).map((decision) => (
                  <button
                    key={decision}
                    onClick={() => setDecisions({ ...decisions, [lead.lead_id]: decision })}
                    className={`rounded-full px-3 py-1 text-xs capitalize ${
                      decisions[lead.lead_id] === decision ? "bg-ink text-card" : "bg-paper text-muted"
                    }`}
                  >
                    {decision}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function OutputView({ result }: { result: PipelineResult }) {
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-3xl border border-line bg-card px-5 py-4 shadow-card">
        <div>
          <h2 className="font-display text-2xl">Final dataset · all 30 leads</h2>
          <p className="text-sm text-muted">Same file written by `npm run process` into data/processed/.</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => download("skillcase_leads_enriched.csv", toCsv(result.leads, OUTPUT_COLUMNS), "text/csv")}
            className="rounded-full bg-ink px-4 py-2 text-sm text-card"
          >
            Download CSV
          </button>
          <button
            onClick={() =>
              download("skillcase_leads_enriched.json", JSON.stringify(result, null, 2), "application/json")
            }
            className="rounded-full border border-line px-4 py-2 text-sm"
          >
            Download JSON
          </button>
        </div>
      </div>
      <div className="overflow-auto rounded-3xl border border-line bg-card shadow-card">
        <table className="min-w-[1400px] text-left text-xs">
          <thead className="bg-paper text-[11px] uppercase tracking-wider text-muted">
            <tr>
              {["Lead", "Relevant", "Reason", "Intent", "Need", "Objection", "Priority", "Next action"].map((h) => (
                <th key={h} className="px-3 py-3">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {result.leads.map((lead) => (
              <tr key={lead.lead_id} className="border-t border-line/70 align-top">
                <td className="px-3 py-3 font-medium">
                  {lead.lead_id}
                  <div className="font-normal text-muted">{lead.name}</div>
                </td>
                <td className="px-3 py-3">{lead.relevant}</td>
                <td className="max-w-[220px] px-3 py-3">{lead.reason}</td>
                <td className="max-w-[200px] px-3 py-3">{lead.intent}</td>
                <td className="max-w-[220px] px-3 py-3">{lead.need}</td>
                <td className="max-w-[200px] px-3 py-3">{lead.objection}</td>
                <td className="px-3 py-3">
                  {lead.priority} ({lead.priority_score})
                </td>
                <td className="max-w-[200px] px-3 py-3">{lead.next_action}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
