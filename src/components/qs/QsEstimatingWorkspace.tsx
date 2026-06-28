"use client";

import Link from "next/link";
import { useState } from "react";
import {
  DashboardCard,
  DashboardShell,
  EmptyState,
  ModuleHeader,
  StatusBadge,
} from "@/components/tex/ExecutivePrimitives";
import { ReturnButton } from "@/components/navigation/ReturnButton";
import { authFetch } from "@/lib/client/authFetch";
import { API_ROUTES } from "@/lib/routes";
import type {
  QSCommercialImpactScenario,
  QsBoqDocument,
  QSEstimate,
  QSEstimateHistory,
  QSSupplierContactActionType,
  QSSupplierRecommendation,
} from "@/types/qs";

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
      supplierRecommendations?: QSSupplierRecommendation[];
      commercialScenarios?: QSCommercialImpactScenario[];
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
  if (status === "quoteReady") return "success";
  if (status === "reviewRequired") return "warning";
  if (status === "pricingIncomplete") return "warning";
  return "danger";
}

function Badge({ children, status }: { children: React.ReactNode; status: QSEstimate["quoteReadinessStatus"] }) {
  return <StatusBadge tone={badgeTone(status)}>{children}</StatusBadge>;
}

function Panel({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <DashboardCard>
      <h2 className="text-sm font-semibold text-[color:var(--tex-text-strong)]">{title}</h2>
      {description ? <p className="tex-copy mt-1 text-sm">{description}</p> : null}
      <div className="mt-4">{children}</div>
    </DashboardCard>
  );
}

function Header({ active }: { active: "list" | "detail" }) {
  const nav = [
    { href: "/dashboard/qs", label: "QS Home" },
    { href: "/dashboard/qs/boq", label: "BOQ Intelligence" },
    { href: "/dashboard/qs/estimates", label: "Estimating", active: true },
    { href: "/dashboard/qs/suppliers", label: "Supplier Intelligence" },
    { href: "/dashboard/qs/materials", label: "Materials" },
  ];

  return (
    <header className="space-y-5">
      <ModuleHeader
        eyebrow="TE QS Engine Phase 2"
        title="Intelligent Estimating Engine"
        description="Convert reviewed BOQ intelligence into costed estimates with material pricing, labour, allowances, overhead, profit, risk, VAT, confidence, and quote readiness."
      />
      <nav className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4" aria-label="QS estimating navigation">
        {nav.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={`rounded-lg border p-3 text-sm font-semibold transition ${
              item.active || active === "detail"
                ? "border-[color:var(--tex-accent)] bg-[color:var(--tex-accent-soft)] text-[color:var(--tex-accent-strong)]"
                : "border-[color:var(--tex-border)] bg-[color:var(--tex-card)] text-[color:var(--tex-text)] hover:border-[color:var(--tex-border-strong)]"
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
          className="rounded-lg border border-[color:var(--tex-border)] bg-[color:var(--tex-card-strong)] px-3 py-2 text-sm text-[color:var(--tex-text)]"
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
          className="tex-action-button disabled:opacity-60"
        >
          {loading ? "Calculating..." : "Generate Estimate"}
        </button>
      </div>
      <p className="tex-copy mt-3 text-sm">{message}</p>
    </Panel>
  );
}

function EstimateList({ estimates }: { estimates: QSEstimate[] }) {
  return (
    <Panel title="Estimate Register" description="Current estimate records with version, readiness, value, and confidence.">
      {!estimates.length ? (
        <EmptyState title="No QS estimates have been generated yet." />
      ) : (
        <div className="tex-table-wrap">
          <table className="tex-table min-w-full">
            <thead>
              <tr>
                {["Estimate", "Project", "Source BOQ", "Value", "Confidence", "Readiness", "Version", "Open"].map((column) => (
                  <th key={column} className="whitespace-nowrap px-3 py-3 font-semibold">{column}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {estimates.map((estimate) => (
                <tr key={estimate.estimateId}>
                  <td className="whitespace-nowrap px-3 py-3 font-mono text-xs text-[color:var(--tex-accent-strong)]">{estimate.estimateId}</td>
                  <td className="min-w-48 px-3 py-3 text-[color:var(--tex-text-strong)]">{estimate.projectName ?? "Unassigned project"}</td>
                  <td className="whitespace-nowrap px-3 py-3 font-mono text-xs">{estimate.sourceBoqId}</td>
                  <td className="whitespace-nowrap px-3 py-3">{formatCurrency(estimate.totalEstimatedProjectValue)}</td>
                  <td className="whitespace-nowrap px-3 py-3">{estimate.confidenceScore}%</td>
                  <td className="whitespace-nowrap px-3 py-3"><Badge status={estimate.quoteReadinessStatus}>{estimate.quoteReadinessStatus}</Badge></td>
                  <td className="whitespace-nowrap px-3 py-3">v{estimate.version}</td>
                  <td className="whitespace-nowrap px-3 py-3">
                    <Link className="font-semibold text-[color:var(--tex-accent)]" href={`/dashboard/qs/estimates/${estimate.estimateId}`}>Open</Link>
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
        <section key={label} className="tex-metric-card">
          <p className="tex-metric-label">{label}</p>
          <p className="mt-3 text-xl font-semibold text-[color:var(--tex-text-strong)]">{formatCurrency(Number(value))}</p>
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

function SupplierRecommendationsPanel({
  estimate,
  initialRecommendations,
  initialScenarios,
}: {
  estimate: QSEstimate;
  initialRecommendations: QSSupplierRecommendation[];
  initialScenarios: QSCommercialImpactScenario[];
}) {
  const [recommendations, setRecommendations] = useState(initialRecommendations);
  const [scenarios, setScenarios] = useState(initialScenarios);
  const [message, setMessage] = useState("Generate or refresh Operation Atlas supplier recommendations for this estimate.");
  const [loading, setLoading] = useState(false);

  async function generateRecommendations() {
    setLoading(true);
    setMessage("Generating supplier recommendations...");
    try {
      const response = await authFetch(API_ROUTES.QS_SUPPLIER_RECOMMENDATIONS(estimate.estimateId), { method: "POST" });
      const payload = (await response.json()) as { recommendations?: QSSupplierRecommendation[]; scenarios?: QSCommercialImpactScenario[]; error?: string };
      if (!response.ok) throw new Error(payload.error ?? "Supplier recommendation generation failed.");
      setRecommendations(payload.recommendations ?? []);
      setScenarios(payload.scenarios ?? []);
      setMessage(`Generated ${payload.recommendations?.length ?? 0} supplier recommendations and ${payload.scenarios?.length ?? 0} impact scenarios.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Supplier recommendation generation failed.");
    } finally {
      setLoading(false);
    }
  }

  async function logContact(recommendation: QSSupplierRecommendation, actionType: QSSupplierContactActionType) {
    setMessage("Logging supplier contact action...");
    try {
      const response = await authFetch(API_ROUTES.QS_SUPPLIER_CONTACT_ACTIONS, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          actionType,
          supplierId: recommendation.supplierId,
          supplierName: recommendation.supplierName,
          estimateId: recommendation.estimateId,
          estimateLineId: recommendation.estimateLineId,
          materialId: recommendation.materialId,
          boqLineItemId: recommendation.boqLineItemId,
          notes: `${actionType} logged from estimate supplier recommendation ${recommendation.recommendationId}.`,
        }),
      });
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(payload.error ?? "Supplier contact action failed.");
      setMessage(`${actionType.replaceAll("_", " ")} logged for ${recommendation.supplierName}.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Supplier contact action failed.");
    }
  }

  const topRecommendations = recommendations.slice(0, 10);

  return (
    <Panel title="Supplier Recommendations" description="Operation Atlas compares supplier cost, quality, delivery, stock, reliability, transport, risk, and margin impact.">
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" disabled={loading} onClick={() => void generateRecommendations()} className="rounded-lg border border-cyan-400/20 bg-cyan-400/10 px-4 py-2 text-sm font-semibold text-cyan-100 disabled:opacity-60">
          {loading ? "Generating..." : "Generate Supplier Recommendations"}
        </button>
        <Link href="/dashboard/qs/suppliers" className="rounded-lg border border-white/10 px-4 py-2 text-sm font-semibold text-slate-200">Open Supplier Intelligence</Link>
      </div>
      <p className="mt-3 text-sm text-slate-400">{message}</p>

      {!topRecommendations.length ? (
        <div className="mt-4 rounded-lg border border-dashed border-white/10 p-6 text-center text-sm text-slate-500">
          No supplier recommendations exist for this estimate yet.
        </div>
      ) : (
        <div className="mt-4 grid gap-3 lg:grid-cols-2">
          {topRecommendations.map((recommendation) => (
            <article key={recommendation.recommendationId} className="rounded-lg border border-white/10 bg-slate-950/50 p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-cyan-200">{recommendation.category.replaceAll("_", " ")}</p>
                  <h3 className="mt-2 text-base font-semibold text-white">{recommendation.supplierName}</h3>
                  <p className="mt-1 text-sm text-slate-400">{recommendation.materialName}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {recommendation.isSponsoredSupplier ? <span className="rounded-full border border-violet-400/30 bg-violet-400/10 px-2 py-1 text-xs font-semibold text-violet-100">Sponsored</span> : null}
                  <span className="rounded-full border border-white/10 bg-white/[0.04] px-2 py-1 text-xs font-semibold text-slate-100">{recommendation.score}% score</span>
                </div>
              </div>
              <p className="mt-3 text-sm text-slate-300">{recommendation.explanation}</p>
              <div className="mt-3 grid gap-2 text-sm sm:grid-cols-3">
                <p><span className="text-slate-500">Landed </span>{formatCurrency(recommendation.landedCostInclVat)}</p>
                <p><span className="text-slate-500">Margin </span>{formatCurrency(recommendation.marginImpact)}</p>
                <p><span className="text-slate-500">Risk </span>{recommendation.riskLevel}</p>
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                <button type="button" onClick={() => void logContact(recommendation, "REQUEST_QUOTE")} className="rounded-lg border border-cyan-400/20 bg-cyan-400/10 px-3 py-2 text-sm font-semibold text-cyan-100">Request Quote</button>
                <button type="button" onClick={() => void logContact(recommendation, "COMPARE_SUPPLIER")} className="rounded-lg border border-white/10 px-3 py-2 text-sm font-semibold text-slate-200">Compare</button>
              </div>
            </article>
          ))}
        </div>
      )}

      {scenarios.length ? (
        <div className="mt-4 overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-white/10 text-xs uppercase tracking-[0.16em] text-slate-500">
              <tr>{["Supplier", "Category", "New Total", "Saving", "Increase", "Profit", "Delivery", "Readiness"].map((column) => <th key={column} className="px-3 py-3 font-semibold">{column}</th>)}</tr>
            </thead>
            <tbody className="divide-y divide-white/10 text-slate-300">
              {scenarios.slice(0, 20).map((scenario) => (
                <tr key={scenario.scenarioId}>
                  <td className="px-3 py-3 text-slate-100">{scenario.supplierName}</td>
                  <td className="px-3 py-3">{scenario.recommendationCategory}</td>
                  <td className="px-3 py-3">{formatCurrency(scenario.newEstimateTotal)}</td>
                  <td className="px-3 py-3 text-emerald-100">{formatCurrency(scenario.costSaving)}</td>
                  <td className="px-3 py-3 text-rose-100">{formatCurrency(scenario.costIncrease)}</td>
                  <td className="px-3 py-3">{formatCurrency(scenario.profitImpact)}</td>
                  <td className="px-3 py-3">{scenario.deliveryImpactDays}d</td>
                  <td className="px-3 py-3">{scenario.quoteReadinessImpact}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </Panel>
  );
}

function DetailView({
  estimate,
  history,
  supplierRecommendations = [],
  commercialScenarios = [],
}: {
  estimate: QSEstimate;
  history: QSEstimateHistory[];
  supplierRecommendations?: QSSupplierRecommendation[];
  commercialScenarios?: QSCommercialImpactScenario[];
}) {
  return (
    <>
      <div className="grid gap-3 lg:grid-cols-[1fr_auto] lg:items-start">
        <section>
          <ReturnButton fallbackHref="/dashboard/qs/estimates" label="Back to Estimates" />
          <h2 className="text-xl font-semibold text-[color:var(--tex-text-strong)]">{estimate.projectName ?? "QS Estimate"}</h2>
          <p className="tex-copy mt-1 text-sm">
            {estimate.estimateId} | Source BOQ {estimate.sourceBoqId} | v{estimate.version} | VAT {formatPercent(estimate.assumptions.vatRate)}
          </p>
        </section>
        <div className="flex flex-wrap gap-2">
          <Badge status={estimate.quoteReadinessStatus}>{estimate.quoteReadinessStatus}</Badge>
          <StatusBadge tone="info">{estimate.confidenceScore}% confidence</StatusBadge>
        </div>
      </div>
      <BreakdownCards estimate={estimate} />
      <AssumptionsPanel estimate={estimate} />
      <SupplierRecommendationsPanel estimate={estimate} initialRecommendations={supplierRecommendations} initialScenarios={commercialScenarios} />
      <Panel title="Missing Pricing and Readiness Warnings" description="Warnings must be cleared or accepted before quote issue.">
        {estimate.missingPricingWarnings.length ? (
          <ul className="space-y-2 text-sm text-[color:var(--tex-warning)]">
            {estimate.missingPricingWarnings.slice(0, 20).map((warning) => <li key={warning}>{warning}</li>)}
          </ul>
        ) : (
          <p className="text-sm text-[color:var(--tex-success)]">No missing pricing warnings.</p>
        )}
      </Panel>
      <EstimateLinesTable estimate={estimate} />
      <Panel title="Estimate Version History" description="Critical estimate recalculations are snapshotted for audit traceability.">
        <div className="grid gap-2 md:grid-cols-3">
          {history.map((entry) => (
            <div key={entry.estimateHistoryId} className="rounded-lg border border-[color:var(--tex-border)] bg-[color:var(--tex-surface)] p-3 text-sm text-[color:var(--tex-text)]">
              <p className="font-semibold text-[color:var(--tex-text-strong)]">v{entry.version} {entry.reason}</p>
              <p className="mt-1 text-xs text-[color:var(--tex-text-muted)]">{entry.createdAt}</p>
            </div>
          ))}
        </div>
      </Panel>
    </>
  );
}

export default function QsEstimatingWorkspace(props: EstimatingWorkspaceProps) {
  return (
    <DashboardShell module="qs" focus>
      <div className="max-w-7xl space-y-6">
        <Header active={props.view} />
        {props.view === "list" ? (
          <>
            <EstimateCreatePanel boqDocuments={props.boqDocuments} />
            <EstimateList estimates={props.estimates} />
          </>
        ) : (
          <DetailView
            estimate={props.estimate}
            history={props.history}
            supplierRecommendations={props.supplierRecommendations}
            commercialScenarios={props.commercialScenarios}
          />
        )}
      </div>
    </DashboardShell>
  );
}
