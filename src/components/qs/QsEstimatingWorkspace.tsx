"use client";

import Link from "next/link";
import { useState } from "react";
import { authFetch } from "@/lib/client/authFetch";
import { API_ROUTES } from "@/lib/routes";
import type { QsBoqDocument, QSEstimate, QSEstimateHistory } from "@/types/qs";

type EstimatingWorkspaceProps =
  | {
      view: "list";
      estimates: QSEstimate[];
      boqDocuments: QsBoqDocument[];
    }
  | {
      view: "detail";
      estimate: QSEstimate;
      history: QSEstimateHistory[];
    };

function formatCurrency(value: number | null | undefined) {
  return new Intl.NumberFormat("en-ZA", {
    style: "currency",
    currency: "ZAR",
    maximumFractionDigits: 2,
  }).format(value ?? 0);
}

function formatPercent(value: number) {
  return `${Math.round(value * 1000) / 10}%`;
}

function badgeTone(status: QSEstimate["quoteReadinessStatus"]) {
  if (status === "quoteReady") return "border-emerald-400/25 bg-emerald-400/10 text-emerald-100";
  if (status === "reviewRequired") return "border-amber-400/25 bg-amber-400/10 text-amber-100";
  if (status === "pricingIncomplete") return "border-orange-400/25 bg-orange-400/10 text-orange-100";
  return "border-rose-400/25 bg-rose-400/10 text-rose-100";
}

function Badge({ children, status }: { children: React.ReactNode; status: QSEstimate["quoteReadinessStatus"] }) {
  return <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${badgeTone(status)}`}>{children}</span>;
}

function Panel({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <section className="rounded-lg border border-white/10 bg-white/[0.03] p-4">
      <h2 className="text-sm font-semibold text-slate-100">{title}</h2>
      {description ? <p className="mt-1 text-sm text-slate-500">{description}</p> : null}
      <div className="mt-4">{children}</div>
    </section>
  );
}

function Header({ active }: { active: "list" | "detail" }) {
  const nav = [
    { href: "/dashboard/qs", label: "QS Home" },
    { href: "/dashboard/qs/boq", label: "BOQ Intelligence" },
    { href: "/dashboard/qs/estimates", label: "Estimating", active: true },
    { href: "/dashboard/qs/materials", label: "Materials" },
  ];

  return (
    <header className="space-y-5">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-200">TE QS Engine Phase 2</p>
        <h1 className="mt-3 text-2xl font-semibold text-white">Intelligent Estimating Engine</h1>
        <p className="mt-2 max-w-3xl text-sm text-slate-400">
          Convert reviewed BOQ intelligence into costed estimates with material pricing, labour, allowances,
          overhead, profit, risk, VAT, confidence, and quote readiness.
        </p>
      </div>
      <nav className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4" aria-label="QS estimating navigation">
        {nav.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={`rounded-lg border p-3 text-sm font-semibold transition ${
              item.active || active === "detail"
                ? "border-cyan-400/30 bg-cyan-400/10 text-cyan-100"
                : "border-white/10 bg-white/[0.03] text-slate-300 hover:border-white/20"
            }`}
          >
            {item.label}
          </Link>
        ))}
      </nav>
    </header>
  );
}

function EstimateCreatePanel({ boqDocuments }: { boqDocuments: QsBoqDocument[] }) {
  const [boqDocumentId, setBoqDocumentId] = useState(boqDocuments[0]?.boqDocumentId ?? "");
  const [message, setMessage] = useState("Select a BOQ document and generate a priced estimate.");
  const [loading, setLoading] = useState(false);

  async function createEstimate() {
    if (!boqDocumentId) {
      setMessage("A BOQ document is required.");
      return;
    }

    setLoading(true);
    setMessage("Calculating QS estimate...");
    try {
      const response = await authFetch(API_ROUTES.QS_ESTIMATES, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ boqDocumentId }),
      });
      const payload = (await response.json()) as { estimate?: QSEstimate; error?: string };
      if (!response.ok || !payload.estimate) {
        throw new Error(payload.error ?? "Estimate generation failed.");
      }

      window.location.href = `/dashboard/qs/estimates/${encodeURIComponent(payload.estimate.estimateId)}`;
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Estimate generation failed.");
      setLoading(false);
    }
  }

  return (
    <Panel title="Generate Estimate From BOQ" description="Uses existing extracted line items and Material Intelligence Centre pricing.">
      <div className="grid gap-3 lg:grid-cols-[1fr_auto]">
        <select
          value={boqDocumentId}
          onChange={(event) => setBoqDocumentId(event.target.value)}
          className="rounded-lg border border-white/10 bg-slate-950/60 px-3 py-2 text-sm text-white"
        >
          {boqDocuments.length ? null : <option value="">No BOQ documents available</option>}
          {boqDocuments.map((document) => (
            <option key={document.boqDocumentId} value={document.boqDocumentId}>
              {document.projectName ?? document.fileName} | {document.itemCount} items | {document.reviewStatus}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={() => void createEstimate()}
          disabled={loading || !boqDocumentId}
          className="rounded-lg border border-cyan-400/20 bg-cyan-400/10 px-4 py-2 text-sm font-semibold text-cyan-100 disabled:opacity-60"
        >
          {loading ? "Calculating..." : "Generate Estimate"}
        </button>
      </div>
      <p className="mt-3 text-sm text-slate-400">{message}</p>
    </Panel>
  );
}

function EstimateList({ estimates }: { estimates: QSEstimate[] }) {
  return (
    <Panel title="Estimate Register" description="Current estimate records with version, readiness, value, and confidence.">
      {!estimates.length ? (
        <div className="rounded-lg border border-dashed border-white/10 p-6 text-center text-sm text-slate-500">No QS estimates have been generated yet.</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-white/10 text-xs uppercase tracking-[0.16em] text-slate-500">
              <tr>
                {["Estimate", "Project", "Source BOQ", "Value", "Confidence", "Readiness", "Version", "Open"].map((column) => (
                  <th key={column} className="whitespace-nowrap px-3 py-3 font-semibold">{column}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-white/10 text-slate-300">
              {estimates.map((estimate) => (
                <tr key={estimate.estimateId}>
                  <td className="whitespace-nowrap px-3 py-3 font-mono text-xs text-cyan-100">{estimate.estimateId}</td>
                  <td className="min-w-48 px-3 py-3 text-slate-100">{estimate.projectName ?? "Unassigned project"}</td>
                  <td className="whitespace-nowrap px-3 py-3 font-mono text-xs">{estimate.sourceBoqId}</td>
                  <td className="whitespace-nowrap px-3 py-3">{formatCurrency(estimate.totalEstimatedProjectValue)}</td>
                  <td className="whitespace-nowrap px-3 py-3">{estimate.confidenceScore}%</td>
                  <td className="whitespace-nowrap px-3 py-3"><Badge status={estimate.quoteReadinessStatus}>{estimate.quoteReadinessStatus}</Badge></td>
                  <td className="whitespace-nowrap px-3 py-3">v{estimate.version}</td>
                  <td className="whitespace-nowrap px-3 py-3">
                    <Link className="text-cyan-200 hover:text-cyan-100" href={`/dashboard/qs/estimates/${estimate.estimateId}`}>Open</Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Panel>
  );
}

function BreakdownCards({ estimate }: { estimate: QSEstimate }) {
  const cards = [
    ["Material", estimate.breakdown.materialCost],
    ["Labour", estimate.breakdown.labourCost],
    ["Plant", estimate.breakdown.plantAllowance],
    ["Transport", estimate.breakdown.transportAllowance],
    ["Waste", estimate.breakdown.wasteAllowance],
    ["Overhead", estimate.breakdown.overhead],
    ["Profit", estimate.breakdown.profit],
    ["Risk", estimate.breakdown.riskAllowance],
    ["VAT", estimate.breakdown.vatAmount],
    ["Total", estimate.breakdown.totalInclVat],
  ];

  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
      {cards.map(([label, value]) => (
        <section key={label} className="rounded-lg border border-white/10 bg-white/[0.03] p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">{label}</p>
          <p className="mt-3 text-xl font-semibold text-white">{formatCurrency(Number(value))}</p>
        </section>
      ))}
    </div>
  );
}

function AssumptionsPanel({ estimate }: { estimate: QSEstimate }) {
  const [message, setMessage] = useState("Update assumptions and recalculate a new estimate version.");
  const [loading, setLoading] = useState(false);

  async function updateAssumptions(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setMessage("Updating estimate assumptions...");
    const formData = new FormData(event.currentTarget);
    const percent = (name: string) => Number(formData.get(name) ?? 0) / 100;
    const assumptions = {
      vatRate: percent("vatRate"),
      overheadPercentage: percent("overheadPercentage"),
      profitPercentage: percent("profitPercentage"),
      riskPercentage: percent("riskPercentage"),
      waste: { mode: "percentage", value: percent("wastePercentage") },
      transport: { mode: "percentage", value: percent("transportPercentage") },
      plant: { mode: "percentage", value: percent("plantPercentage") },
    };

    try {
      const response = await authFetch(API_ROUTES.QS_ESTIMATE_DETAIL(estimate.estimateId), {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assumptions }),
      });
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(payload.error ?? "Assumption update failed.");
      window.location.reload();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Assumption update failed.");
      setLoading(false);
    }
  }

  async function recalculate() {
    setLoading(true);
    setMessage("Recalculating current estimate version...");
    try {
      const response = await authFetch(API_ROUTES.QS_ESTIMATE_DETAIL(estimate.estimateId), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "recalculate" }),
      });
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(payload.error ?? "Recalculation failed.");
      window.location.reload();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Recalculation failed.");
      setLoading(false);
    }
  }

  return (
    <Panel title="Assumptions and Controls" description="Defaults are centralised in the QS estimating service and can be adjusted per estimate.">
      <form onSubmit={(event) => void updateAssumptions(event)} className="grid gap-3 md:grid-cols-4">
        <label className="text-sm text-slate-300">VAT %<input name="vatRate" type="number" step="0.1" defaultValue={estimate.assumptions.vatRate * 100} className="mt-2 w-full rounded-lg border border-white/10 bg-slate-950/60 px-3 py-2 text-sm text-white" /></label>
        <label className="text-sm text-slate-300">Overhead %<input name="overheadPercentage" type="number" step="0.1" defaultValue={estimate.assumptions.overheadPercentage * 100} className="mt-2 w-full rounded-lg border border-white/10 bg-slate-950/60 px-3 py-2 text-sm text-white" /></label>
        <label className="text-sm text-slate-300">Profit %<input name="profitPercentage" type="number" step="0.1" defaultValue={estimate.assumptions.profitPercentage * 100} className="mt-2 w-full rounded-lg border border-white/10 bg-slate-950/60 px-3 py-2 text-sm text-white" /></label>
        <label className="text-sm text-slate-300">Risk %<input name="riskPercentage" type="number" step="0.1" defaultValue={estimate.assumptions.riskPercentage * 100} className="mt-2 w-full rounded-lg border border-white/10 bg-slate-950/60 px-3 py-2 text-sm text-white" /></label>
        <label className="text-sm text-slate-300">Waste %<input name="wastePercentage" type="number" step="0.1" defaultValue={estimate.assumptions.waste.value * 100} className="mt-2 w-full rounded-lg border border-white/10 bg-slate-950/60 px-3 py-2 text-sm text-white" /></label>
        <label className="text-sm text-slate-300">Transport %<input name="transportPercentage" type="number" step="0.1" defaultValue={estimate.assumptions.transport.value * 100} className="mt-2 w-full rounded-lg border border-white/10 bg-slate-950/60 px-3 py-2 text-sm text-white" /></label>
        <label className="text-sm text-slate-300">Plant %<input name="plantPercentage" type="number" step="0.1" defaultValue={estimate.assumptions.plant.value * 100} className="mt-2 w-full rounded-lg border border-white/10 bg-slate-950/60 px-3 py-2 text-sm text-white" /></label>
        <div className="flex items-end gap-2">
          <button disabled={loading} className="rounded-lg border border-cyan-400/20 bg-cyan-400/10 px-4 py-2 text-sm font-semibold text-cyan-100 disabled:opacity-60">Update</button>
          <button type="button" onClick={() => void recalculate()} disabled={loading} className="rounded-lg border border-white/10 px-4 py-2 text-sm font-semibold text-slate-200 disabled:opacity-60">Recalculate</button>
        </div>
      </form>
      <p className="mt-3 text-sm text-slate-400">{message}</p>
    </Panel>
  );
}

function EstimateLinesTable({ estimate }: { estimate: QSEstimate }) {
  return (
    <Panel title="Line Item Pricing" description="BOQ line pricing with matched materials, allowances, margins, VAT, confidence, and warnings.">
      <div className="overflow-x-auto">
        <table className="min-w-full text-left text-sm">
          <thead className="border-b border-white/10 text-xs uppercase tracking-[0.16em] text-slate-500">
            <tr>
              {["Trade", "Description", "Qty", "Unit", "Material", "Labour", "Allowances", "Margin/Risk", "VAT", "Total", "Confidence", "Warnings"].map((column) => (
                <th key={column} className="whitespace-nowrap px-3 py-3 font-semibold">{column}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-white/10 text-slate-300">
            {estimate.lines.map((line) => (
              <tr key={line.estimateLineId}>
                <td className="whitespace-nowrap px-3 py-3">{line.trade}</td>
                <td className="min-w-72 px-3 py-3 text-slate-100">{line.description}</td>
                <td className="whitespace-nowrap px-3 py-3">{line.quantity}</td>
                <td className="whitespace-nowrap px-3 py-3">{line.unit ?? "-"}</td>
                <td className="whitespace-nowrap px-3 py-3">{formatCurrency(line.materialTotal)}<br /><span className="text-xs text-slate-500">{line.pricingSource}</span></td>
                <td className="whitespace-nowrap px-3 py-3">{formatCurrency(line.labourTotal)}<br /><span className="text-xs text-slate-500">{line.labourHours}h @ {formatCurrency(line.labourRate)}</span></td>
                <td className="whitespace-nowrap px-3 py-3">{formatCurrency(line.plantEquipmentCost + line.transportAllowance + line.wasteAllowance)}</td>
                <td className="whitespace-nowrap px-3 py-3">{formatCurrency(line.profitAmount + line.riskAmount + line.overheadAmount)}</td>
                <td className="whitespace-nowrap px-3 py-3">{formatCurrency(line.vatAmount)}</td>
                <td className="whitespace-nowrap px-3 py-3 text-slate-100">{formatCurrency(line.lineTotal)}</td>
                <td className="whitespace-nowrap px-3 py-3">{line.confidenceScore}%</td>
                <td className="min-w-64 px-3 py-3 text-xs text-amber-100">{line.warnings.length ? line.warnings.join(" | ") : "Clear"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Panel>
  );
}

function DetailView({ estimate, history }: { estimate: QSEstimate; history: QSEstimateHistory[] }) {
  return (
    <>
      <div className="grid gap-3 lg:grid-cols-[1fr_auto] lg:items-start">
        <section>
          <h2 className="text-xl font-semibold text-white">{estimate.projectName ?? "QS Estimate"}</h2>
          <p className="mt-1 text-sm text-slate-400">
            {estimate.estimateId} | Source BOQ {estimate.sourceBoqId} | v{estimate.version} | VAT {formatPercent(estimate.assumptions.vatRate)}
          </p>
        </section>
        <div className="flex flex-wrap gap-2">
          <Badge status={estimate.quoteReadinessStatus}>{estimate.quoteReadinessStatus}</Badge>
          <span className="rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-xs font-semibold text-slate-200">{estimate.confidenceScore}% confidence</span>
        </div>
      </div>
      <BreakdownCards estimate={estimate} />
      <AssumptionsPanel estimate={estimate} />
      <Panel title="Missing Pricing and Readiness Warnings" description="Warnings must be cleared or accepted before quote issue.">
        {estimate.missingPricingWarnings.length ? (
          <ul className="space-y-2 text-sm text-amber-100">
            {estimate.missingPricingWarnings.slice(0, 20).map((warning) => <li key={warning}>{warning}</li>)}
          </ul>
        ) : (
          <p className="text-sm text-emerald-100">No missing pricing warnings.</p>
        )}
      </Panel>
      <EstimateLinesTable estimate={estimate} />
      <Panel title="Estimate Version History" description="Critical estimate recalculations are snapshotted for audit traceability.">
        <div className="grid gap-2 md:grid-cols-3">
          {history.map((entry) => (
            <div key={entry.estimateHistoryId} className="rounded-lg border border-white/10 bg-slate-950/50 p-3 text-sm text-slate-300">
              <p className="font-semibold text-slate-100">v{entry.version} {entry.reason}</p>
              <p className="mt-1 text-xs text-slate-500">{entry.createdAt}</p>
            </div>
          ))}
        </div>
      </Panel>
    </>
  );
}

export default function QsEstimatingWorkspace(props: EstimatingWorkspaceProps) {
  return (
    <div className="p-6 text-white">
      <div className="max-w-7xl space-y-6">
        <Header active={props.view} />
        {props.view === "list" ? (
          <>
            <EstimateCreatePanel boqDocuments={props.boqDocuments} />
            <EstimateList estimates={props.estimates} />
          </>
        ) : (
          <DetailView estimate={props.estimate} history={props.history} />
        )}
      </div>
    </div>
  );
}
