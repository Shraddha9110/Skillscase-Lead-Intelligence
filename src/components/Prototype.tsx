"use client";

import { OUTPUT_COLUMNS, toCsv } from "@/lib/csv";
import { loadRawLeads } from "@/lib/load";
import type { PipelineResult, ProcessedLead, RawLead } from "@/lib/types";
import { useEffect, useMemo, useState } from "react";

type View = "leads" | "review" | "output" | "pipeline" | "evaluation";
type Filter = "all" | "relevant" | "not" | "uncertain" | "high" | "review" | "duplicate";
type Decision = "accepted" | "held" | "rejected";

const rawLeads = loadRawLeads();

function isCallFirst(lead: ProcessedLead, decisions: Record<string, Decision> = {}) {
  if (lead.priority !== "High" || lead.is_duplicate) return false;
  if (lead.review_required && decisions[lead.lead_id] !== "accepted") return false;
  return true;
}

function badge(value: string) {
  if (value === "High" || value === "Relevant") return "bg-teal-soft text-teal-deep";
  if (value === "Medium" || value === "Uncertain") return "bg-amber-50 text-clay";
  if (value === "Low" || value === "Not Relevant") return "bg-rose-50 text-rose";
  if (String(value).startsWith("Duplicate of")) return "bg-slate-100 text-muted";
  return "bg-slate-100 text-muted";
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
  const [view, setView] = useState<View>("leads");
  const [filter, setFilter] = useState<Filter>("all");
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState("L013");
  const [decisions, setDecisions] = useState<Record<string, Decision>>({});

  async function run() {
    setRunning(true);
    setActiveStep(0);
    for (let i = 0; i < 7; i += 1) {
      setActiveStep(i);
      await new Promise((resolve) => setTimeout(resolve, 160));
    }
    try {
      const response = await fetch("/api/pipeline", { method: "POST" });
      const next = await response.json();
      if (!response.ok) throw new Error(next.error || "Pipeline failed");
      setResult(next);
    } catch (error) {
      console.error(error);
    }
    setRunning(false);
    setActiveStep(-1);
  }

  useEffect(() => {
    run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const tabTitle =
    view === "review" ? "Review" : view === "output" ? "Dataset" : view === "evaluation" ? "Evaluation" : view === "pipeline" ? "Run log" : "Lead list";

  useEffect(() => {
    document.title = `${tabTitle} · Skillcase desk`;
  }, [tabTitle]);

  const leads = result?.leads || [];
  const selected = leads.find((lead) => lead.lead_id === selectedId) || leads[0];
  const rawSelected = rawLeads.find((lead) => lead.lead_id === selected?.lead_id);
  const reviewQueue = leads.filter((lead) => lead.review_required);

  const filtered = useMemo(() => {
    return leads.filter((lead) => {
      const hay = `${lead.lead_id} ${lead.name} ${lead.city} ${lead.education} ${lead.intent}`.toLowerCase();
      if (query && !hay.includes(query.toLowerCase())) return false;
      if (filter === "relevant") return lead.relevant === "Relevant" && !lead.is_duplicate;
      if (filter === "not") return lead.relevant === "Not Relevant";
      if (filter === "uncertain") return lead.relevant === "Uncertain";
      if (filter === "high") return isCallFirst(lead, decisions);
      if (filter === "review") return lead.review_required;
      if (filter === "duplicate") return lead.is_duplicate;
      return true;
    });
  }, [leads, filter, query, decisions]);

  return (
    <div className="min-h-screen bg-[#f3f5f4] text-ink">
      <header className="sticky top-0 z-20 border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-[1400px] items-center justify-between gap-4 px-4 py-3">
          <div>
            <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-teal">Skillcase desk</p>
            <h1 className="text-lg font-semibold tracking-tight">{tabTitle}</h1>
          </div>
          <nav className="flex flex-wrap items-center gap-1">
            {(
              [
                ["leads", "Lead list"],
                ["review", `Review${result ? ` (${reviewQueue.length})` : ""}`],
                ["output", "Dataset"],
                ["evaluation", "Evaluation"],
                ["pipeline", "Run log"]
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                onClick={() => setView(id)}
                className={`rounded-lg px-3 py-1.5 text-sm ${
                  view === id ? "bg-ink text-white" : "text-muted hover:bg-slate-100 hover:text-ink"
                }`}
              >
                {label}
              </button>
            ))}
          </nav>
          <button
            onClick={run}
            disabled={running}
            className="rounded-lg bg-teal px-3.5 py-2 text-sm font-medium text-white disabled:opacity-60"
          >
            {running ? "Running…" : "Re-run pipeline"}
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-[1400px] px-4 py-4">
        <section className="mb-4 grid grid-cols-2 gap-2 md:grid-cols-6">
          <Stat label="Rows" value={result?.inputCount ?? 30} />
          <Stat label="Unique" value={result?.uniquePeople ?? "—"} />
          <Stat label="Relevant" value={result?.relevantCount ?? "—"} />
          <Stat label="Call first" value={leads.filter((lead) => isCallFirst(lead, decisions)).length || "—"} />
          <Stat label="Review" value={result?.reviewCount ?? "—"} />
          <Stat label="Duplicates" value={result?.duplicateCount ?? "—"} />
        </section>

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
        {view === "evaluation" && result && <EvaluationView result={result} />}
        {view === "pipeline" && <PipelineView result={result} activeStep={activeStep} running={running} />}
      </main>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white px-3 py-2.5">
      <p className="text-[11px] uppercase tracking-[0.12em] text-muted">{label}</p>
      <p className="mt-0.5 text-xl font-semibold">{value}</p>
    </div>
  );
}

function PipelineView({
  result,
  activeStep,
  running
}: {
  result: PipelineResult | null;
  activeStep: number;
  running: boolean;
}) {
  const steps = result?.steps || [
    { id: "clean", title: "Clean / repair", summary: "Keep empty cells empty and flag missing fields." },
    { id: "dedupe", title: "Deduplicate", summary: "Phone + email, including shortened names." },
    { id: "classify", title: "Classify (Gemini)", summary: "Phase 3 Gemini: Relevant / Not Relevant / Uncertain." },
    { id: "enrich", title: "Enrich (Gemini)", summary: "AI sales context; signals only if Gemini fails." },
    { id: "qc", title: "Quality control", summary: "Critic and review queue." },
    { id: "prioritize", title: "Prioritize", summary: "0–100 score, High / Medium / Low." },
    { id: "outreach", title: "Outreach (Gemini)", summary: "AI draft through criticOutreach; templates only on quota." }
  ];
  const modes = result?.stepModes;

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold">Pipeline run log</h2>
          <p className="text-sm text-muted">
            {running
              ? "Running the 30-row sheet now."
              : result
                ? modes
                  ? `Last run: Classify ${modes.classify === "ai" ? "AI" : "rules"} · Enrich ${modes.enrich === "ai" ? "AI" : "fallback"} · Outreach ${modes.outreach === "ai" ? "AI" : "fallback"} · model ${result.model || "unknown"}.`
                  : `Last run: ${result.mode === "llm" ? "AI" : "rules"} mode · model ${result.model || "unknown"}.`
                : "Waiting for first run."}
          </p>
        </div>
      </div>
      <div className="grid gap-2 md:grid-cols-7">
        {steps.map((step, index) => (
          <div
            key={step.id}
            className={`rounded-lg border px-2.5 py-2 ${
              activeStep === index ? "border-teal bg-teal-soft" : "border-slate-200 bg-slate-50"
            }`}
          >
            <p className="text-[11px] text-muted">{index + 1}</p>
            <p className="text-sm font-medium leading-tight">{step.title}</p>
            <p className="mt-1 text-xs text-muted">{step.summary}</p>
          </div>
        ))}
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
    <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_380px]">
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 px-3 py-2.5">
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
              className={`rounded-md px-2.5 py-1 text-xs ${
                filter === id ? "bg-ink text-white" : "bg-slate-100 text-muted"
              }`}
            >
              {label}
            </button>
          ))}
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search name, city, intent"
            className="ml-auto w-full rounded-md border border-slate-200 bg-white px-3 py-1.5 text-sm sm:w-56"
          />
        </div>
        <div className="max-h-[720px] overflow-auto">
          <table className="w-full text-left text-sm">
            <thead className="sticky top-0 bg-slate-50 text-[11px] uppercase tracking-wider text-muted">
              <tr>
                <th className="px-3 py-2.5">Lead</th>
                <th>Relevant</th>
                <th>Priority</th>
                <th className="pr-3">Next action</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((lead) => (
                <tr
                  key={lead.lead_id}
                  onClick={() => onSelect(lead.lead_id)}
                  className={`cursor-pointer border-t border-slate-100 ${
                    selected?.lead_id === lead.lead_id ? "bg-teal-soft/70" : "hover:bg-slate-50"
                  }`}
                >
                  <td className="px-3 py-2.5">
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
                    {lead.is_duplicate || !lead.priority ? (
                      <span className="text-muted">—</span>
                    ) : (
                      <span className={`rounded-full px-2 py-0.5 text-xs ${badge(lead.priority)}`}>
                        {lead.priority} {lead.priority_score}
                      </span>
                    )}
                  </td>
                  <td className="max-w-[240px] truncate pr-3 text-xs text-muted">{lead.next_action}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {selected && (
        <aside className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-[11px] uppercase tracking-[0.14em] text-teal">{selected.lead_id}</p>
          <h3 className="text-xl font-semibold">{selected.name}</h3>
          <p className="text-sm text-muted">
            {selected.phone} · {selected.email || "email missing"} · {selected.city}
          </p>
          <div className="mt-3 flex flex-wrap gap-2 text-xs">
            <span className={`rounded-full px-2 py-1 ${badge(selected.relevant)}`}>{selected.relevant}</span>
            {selected.is_duplicate || !selected.priority ? (
              <span className="rounded-full bg-slate-100 px-2 py-1">—</span>
            ) : (
              <span className={`rounded-full px-2 py-1 ${badge(selected.priority)}`}>
                {selected.priority} · {selected.priority_score}
              </span>
            )}
            <span className="rounded-full bg-slate-100 px-2 py-1">
              Confidence {selected.confidence ? selected.confidence.toFixed(2) : "—"}
            </span>
            {selected.is_duplicate && (
              <span className="rounded-full bg-slate-100 px-2 py-1">Duplicate of {selected.duplicate_of}</span>
            )}
            {selected.review_required && <span className="rounded-full bg-amber-50 px-2 py-1 text-clay">Needs review</span>}
            <span className="rounded-full bg-slate-100 px-2 py-1">
              Enrich {selected.enrichment_path === "ai" ? "AI" : "fallback"}
            </span>
            <span className="rounded-full bg-slate-100 px-2 py-1">
              Outreach {selected.outreach_path === "ai" ? "AI" : "fallback"}
            </span>
          </div>
          <Field label="Reason" value={selected.reason} />
          <Field label="Profile" value={selected.profile} />
          <Field label="Intent" value={selected.intent} />
          <Field label="Need" value={selected.need || "—"} />
          <Field label="Objection" value={selected.objection || "—"} />
          <Field label="Missing information" value={selected.missing_information} />
          <Field label="Opportunity" value={selected.opportunity} />
          <Field label="Next action" value={selected.next_action} />
          {selected.outreach ? (
            <div className="mt-3 rounded-lg bg-slate-50 p-3 text-sm">
              <p className="text-[11px] uppercase tracking-[0.12em] text-muted">Outreach</p>
              <p className="mt-1 whitespace-pre-wrap leading-relaxed">{selected.outreach}</p>
            </div>
          ) : (
            <p className="mt-3 text-sm text-muted">No outreach — not relevant, a duplicate, or held for review.</p>
          )}
          {selected.sources && /https?:\/\//.test(selected.sources) && (
            <Field label="Sources" value={selected.sources} />
          )}
          {selected.critic_notes && <Field label="Critic / QC" value={selected.critic_notes} />}
          {rawSelected && rawSelected.email && selected.email && rawSelected.email !== selected.email && (
            <p className="mt-3 text-xs text-clay">
              Cleaner normalised the email. Raw cell was “{rawSelected.email}”.
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
      <p className="text-[11px] uppercase tracking-[0.12em] text-muted">{label}</p>
      <p className="mt-1 text-sm leading-relaxed">{value}</p>
    </div>
  );
}

function ReviewView({
  reviewQueue,
  decisions,
  setDecisions,
  onOpen
}: {
  reviewQueue: ProcessedLead[];
  decisions: Record<string, Decision>;
  setDecisions: (value: Record<string, Decision>) => void;
  onOpen: (id: string) => void;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white">
      <div className="border-b border-slate-200 px-4 py-3">
        <h2 className="text-base font-semibold">Human review queue</h2>
        <p className="text-sm text-muted">Accept, hold, or reject. Nothing here is auto-sent.</p>
      </div>
      <div className="divide-y divide-slate-100">
        {reviewQueue.map((lead) => (
          <div key={lead.lead_id} className="flex flex-col gap-3 px-4 py-3 md:flex-row md:items-center">
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
                  className={`rounded-md px-2.5 py-1 text-xs capitalize ${
                    decisions[lead.lead_id] === decision ? "bg-ink text-white" : "bg-slate-100 text-muted"
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
  );
}

function OutputView({ result }: { result: PipelineResult }) {
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3">
        <div>
          <h2 className="text-base font-semibold">Final dataset · all 30 leads</h2>
          <p className="text-sm text-muted">Same file as data/processed after `npm run process`.</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => download("skillcase_leads_enriched.csv", toCsv(result.leads, OUTPUT_COLUMNS), "text/csv")}
            className="rounded-lg bg-ink px-3 py-2 text-sm text-white"
          >
            Download CSV
          </button>
          <button
            onClick={() =>
              download("skillcase_leads_enriched.json", JSON.stringify(result, null, 2), "application/json")
            }
            className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
          >
            Download JSON
          </button>
        </div>
      </div>
      <div className="overflow-auto rounded-xl border border-slate-200 bg-white">
        <table className="min-w-[1200px] text-left text-xs">
          <thead className="bg-slate-50 text-[11px] uppercase tracking-wider text-muted">
            <tr>
              {["Lead", "Relevant", "Confidence", "Reason", "Intent", "Need", "Objection", "Priority", "Next action", "Outreach"].map((h) => (
                <th key={h} className="px-3 py-2.5">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {result.leads.map((lead) => (
              <tr key={lead.lead_id} className="border-t border-slate-100 align-top">
                <td className="px-3 py-2.5 font-medium">
                  {lead.lead_id}
                  <div className="font-normal text-muted">{lead.name}</div>
                </td>
                <td className="px-3 py-2.5">{lead.relevant}</td>
                <td className="px-3 py-2.5">{lead.confidence ? lead.confidence.toFixed(2) : "—"}</td>
                <td className="max-w-[220px] px-3 py-2.5">{lead.reason}</td>
                <td className="max-w-[200px] px-3 py-2.5">{lead.intent}</td>
                <td className="max-w-[220px] px-3 py-2.5">{lead.need || "—"}</td>
                <td className="max-w-[200px] px-3 py-2.5">{lead.objection || "—"}</td>
                <td className="px-3 py-2.5">
                  {lead.is_duplicate || !lead.priority ? "—" : `${lead.priority} (${lead.priority_score})`}
                </td>
                <td className="max-w-[200px] px-3 py-2.5">{lead.next_action}</td>
                <td className="max-w-[240px] px-3 py-2.5">{lead.outreach || "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function EvaluationView({ result }: { result: PipelineResult }) {
  const evaluation = result.evaluation;
  if (!evaluation) {
    return <p className="text-sm text-muted">No evaluation for this run.</p>;
  }
  return (
    <div className="space-y-3">
      <div className="rounded-xl border border-slate-200 bg-white px-4 py-3">
        <h2 className="text-base font-semibold">Notes vs pipeline</h2>
        <p className="text-sm text-muted">
          Compared duplicates, relevance and intent to the CRM notes column. Agreement {evaluation.agreementRate}% ·{" "}
          {evaluation.matches.length} matches · {evaluation.mismatches.length} mismatches.
        </p>
      </div>
      <div className="overflow-auto rounded-xl border border-slate-200 bg-white">
        <table className="min-w-[900px] text-left text-xs">
          <thead className="bg-slate-50 text-[11px] uppercase tracking-wider text-muted">
            <tr>
              {["Lead", "Dimension", "Notes", "Expected", "Actual", "Result"].map((header) => (
                <th key={header} className="px-3 py-2.5">
                  {header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {evaluation.checks.map((check) => (
              <tr key={`${check.lead_id}-${check.dimension}`} className="border-t border-slate-100 align-top">
                <td className="px-3 py-2.5 font-medium">{check.lead_id}</td>
                <td className="px-3 py-2.5">{check.dimension}</td>
                <td className="max-w-[220px] px-3 py-2.5">{check.notes || "—"}</td>
                <td className="px-3 py-2.5">{check.expected}</td>
                <td className="px-3 py-2.5">{check.actual}</td>
                <td className="px-3 py-2.5">{check.match ? "Match" : "Mismatch"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
