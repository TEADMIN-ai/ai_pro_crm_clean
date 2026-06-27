"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { authFetch } from "@/lib/client/authFetch";
import { API_ROUTES } from "@/lib/routes";
import type {
  QSCommercialImpactScenario,
  QSEstimate,
  QSSupplierContactActionType,
  QSSupplierProductOffer,
  QSSupplierProfile,
  QSSupplierRecommendation,
} from "@/types/qs";

type SupplierWorkspaceProps =
  | {
      view: "list";
      suppliers: QSSupplierProfile[];
      offers: QSSupplierProductOffer[];
      estimates: QSEstimate[];
    }
  | {
      view: "detail";
      supplier: QSSupplierProfile;
      offers: QSSupplierProductOffer[];
    };

function formatCurrency(value: number | null | undefined) {
  return new Intl.NumberFormat("en-ZA", { style: "currency", currency: "ZAR", maximumFractionDigits: 2 }).format(value ?? 0);
}

function scoreTone(score: number) {
  if (score >= 80) return "text-emerald-100";
  if (score >= 60) return "text-amber-100";
  return "text-rose-100";
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

function Header() {
  const nav = [
    { href: "/dashboard/qs", label: "QS Home" },
    { href: "/dashboard/qs/estimates", label: "Estimating" },
    { href: "/dashboard/qs/suppliers", label: "Supplier Intelligence" },
    { href: "/dashboard/qs/materials", label: "Materials" },
  ];

  return (
    <header className="space-y-5">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-200">Operation Atlas | QS Engine Phase 3</p>
        <h1 className="mt-3 text-2xl font-semibold text-white">AI Supplier Intelligence</h1>
        <p className="mt-2 max-w-3xl text-sm text-slate-400">
          Compare supplier price, quality, delivery, stock, reliability, transport exposure, margin impact, and commercial risk.
        </p>
      </div>
      <nav className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4" aria-label="QS supplier intelligence navigation">
        {nav.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={`rounded-lg border p-3 text-sm font-semibold transition ${
              item.href === "/dashboard/qs/suppliers"
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

function RecommendationCards({
  recommendations,
  onContact,
}: {
  recommendations: QSSupplierRecommendation[];
  onContact: (recommendation: QSSupplierRecommendation, actionType: QSSupplierContactActionType) => void;
}) {
  const topRecommendations = useMemo(() => {
    const byCategory = new Map<string, QSSupplierRecommendation>();
    for (const recommendation of recommendations) {
      if (!byCategory.has(recommendation.category)) byCategory.set(recommendation.category, recommendation);
    }
    return Array.from(byCategory.values());
  }, [recommendations]);

  if (!topRecommendations.length) {
    return <p className="text-sm text-slate-500">Generate recommendations from an estimate to populate commercial supplier intelligence.</p>;
  }

  return (
    <div className="grid gap-3 lg:grid-cols-2">
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
              <span className={`rounded-full border border-white/10 bg-white/[0.04] px-2 py-1 text-xs font-semibold ${scoreTone(recommendation.score)}`}>{recommendation.score}% score</span>
            </div>
          </div>
          <p className="mt-3 text-sm text-slate-300">{recommendation.explanation}</p>
          <dl className="mt-4 grid gap-2 text-sm sm:grid-cols-3">
            <div><dt className="text-slate-500">Landed Cost</dt><dd className="font-semibold text-slate-100">{formatCurrency(recommendation.landedCostInclVat)}</dd></div>
            <div><dt className="text-slate-500">Margin Impact</dt><dd className="font-semibold text-slate-100">{formatCurrency(recommendation.marginImpact)}</dd></div>
            <div><dt className="text-slate-500">Risk</dt><dd className="font-semibold text-slate-100">{recommendation.riskLevel}</dd></div>
          </dl>
          <ul className="mt-3 space-y-1 text-xs text-amber-100">
            {recommendation.tradeOffs.map((tradeOff) => <li key={tradeOff}>{tradeOff}</li>)}
          </ul>
          <div className="mt-4 flex flex-wrap gap-2">
            <button type="button" onClick={() => onContact(recommendation, "REQUEST_QUOTE")} className="rounded-lg border border-cyan-400/20 bg-cyan-400/10 px-3 py-2 text-sm font-semibold text-cyan-100">Request Quote</button>
            <button type="button" onClick={() => onContact(recommendation, "REQUEST_DELIVERY_COST")} className="rounded-lg border border-white/10 px-3 py-2 text-sm font-semibold text-slate-200">Delivery Cost</button>
            <button type="button" onClick={() => onContact(recommendation, "SAVE_SUPPLIER")} className="rounded-lg border border-white/10 px-3 py-2 text-sm font-semibold text-slate-200">Save Supplier</button>
          </div>
        </article>
      ))}
    </div>
  );
}

function ListView({ suppliers, offers, estimates }: Extract<SupplierWorkspaceProps, { view: "list" }>) {
  const [estimateId, setEstimateId] = useState(estimates[0]?.estimateId ?? "");
  const [message, setMessage] = useState("Select an estimate to generate supplier recommendations.");
  const [loading, setLoading] = useState(false);
  const [recommendations, setRecommendations] = useState<QSSupplierRecommendation[]>([]);
  const [scenarios, setScenarios] = useState<QSCommercialImpactScenario[]>([]);

  async function generateRecommendations() {
    if (!estimateId) {
      setMessage("An estimate is required.");
      return;
    }
    setLoading(true);
    setMessage("Generating supplier intelligence...");
    try {
      const response = await authFetch(API_ROUTES.QS_SUPPLIER_RECOMMENDATIONS(estimateId), { method: "POST" });
      const payload = (await response.json()) as { recommendations?: QSSupplierRecommendation[]; scenarios?: QSCommercialImpactScenario[]; error?: string };
      if (!response.ok) throw new Error(payload.error ?? "Recommendation generation failed.");
      setRecommendations(payload.recommendations ?? []);
      setScenarios(payload.scenarios ?? []);
      setMessage(`Generated ${payload.recommendations?.length ?? 0} supplier recommendations.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Recommendation generation failed.");
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
          notes: `${actionType} logged from Operation Atlas recommendation ${recommendation.recommendationId}.`,
        }),
      });
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(payload.error ?? "Contact action logging failed.");
      setMessage(`${actionType.replaceAll("_", " ")} logged for ${recommendation.supplierName}.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Contact action logging failed.");
    }
  }

  return (
    <>
      <Panel title="Generate Supplier Recommendations" description="Runs explainable scoring against supplier offers and persists recommendation and impact records.">
        <div className="grid gap-3 lg:grid-cols-[1fr_auto]">
          <select value={estimateId} onChange={(event) => setEstimateId(event.target.value)} className="rounded-lg border border-white/10 bg-slate-950/60 px-3 py-2 text-sm text-white">
            {estimates.length ? null : <option value="">No estimates available</option>}
            {estimates.map((estimate) => (
              <option key={estimate.estimateId} value={estimate.estimateId}>
                {estimate.projectName ?? estimate.estimateId} | {formatCurrency(estimate.totalEstimatedProjectValue)} | {estimate.quoteReadinessStatus}
              </option>
            ))}
          </select>
          <button type="button" disabled={loading || !estimateId} onClick={() => void generateRecommendations()} className="rounded-lg border border-cyan-400/20 bg-cyan-400/10 px-4 py-2 text-sm font-semibold text-cyan-100 disabled:opacity-60">
            {loading ? "Generating..." : "Generate Recommendations"}
          </button>
        </div>
        <p className="mt-3 text-sm text-slate-400">{message}</p>
      </Panel>

      <Panel title="Recommendation Cards" description="Commercial impact is explained separately from sponsored supplier visibility.">
        <RecommendationCards recommendations={recommendations} onContact={(recommendation, actionType) => void logContact(recommendation, actionType)} />
      </Panel>

      <Panel title="Commercial Impact Scenarios" description="Shows estimate, profit, transport, delivery, and risk impact for supplier selection changes.">
        {!scenarios.length ? (
          <p className="text-sm text-slate-500">No scenarios generated yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="border-b border-white/10 text-xs uppercase tracking-[0.16em] text-slate-500">
                <tr>{["Supplier", "Category", "New Total", "Saving", "Increase", "Profit Impact", "Delivery", "Risk"].map((column) => <th key={column} className="px-3 py-3 font-semibold">{column}</th>)}</tr>
              </thead>
              <tbody className="divide-y divide-white/10 text-slate-300">
                {scenarios.map((scenario) => (
                  <tr key={scenario.scenarioId}>
                    <td className="px-3 py-3 text-slate-100">{scenario.supplierName}</td>
                    <td className="px-3 py-3">{scenario.recommendationCategory}</td>
                    <td className="px-3 py-3">{formatCurrency(scenario.newEstimateTotal)}</td>
                    <td className="px-3 py-3 text-emerald-100">{formatCurrency(scenario.costSaving)}</td>
                    <td className="px-3 py-3 text-rose-100">{formatCurrency(scenario.costIncrease)}</td>
                    <td className="px-3 py-3">{formatCurrency(scenario.profitImpact)}</td>
                    <td className="px-3 py-3">{scenario.deliveryImpactDays}d</td>
                    <td className="px-3 py-3">{scenario.riskImpact}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      <div className="grid gap-4 xl:grid-cols-2">
        <Panel title="Supplier Profiles" description="Preferred and sponsored markers are visible; AI scoring remains independent.">
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="border-b border-white/10 text-xs uppercase tracking-[0.16em] text-slate-500">
                <tr>{["Supplier", "Score", "Quality", "Reliability", "Delivery", "Status", "Open"].map((column) => <th key={column} className="px-3 py-3 font-semibold">{column}</th>)}</tr>
              </thead>
              <tbody className="divide-y divide-white/10 text-slate-300">
                {suppliers.map((supplier) => (
                  <tr key={supplier.supplierId}>
                    <td className="px-3 py-3 text-slate-100">{supplier.supplierName}{supplier.isSponsoredSupplier ? <span className="ml-2 rounded-full border border-violet-400/30 px-2 py-0.5 text-xs text-violet-100">Sponsored</span> : null}</td>
                    <td className={`px-3 py-3 font-semibold ${scoreTone(supplier.overallSupplierScore)}`}>{supplier.overallSupplierScore}%</td>
                    <td className="px-3 py-3">{supplier.qualityScore}%</td>
                    <td className="px-3 py-3">{supplier.reliabilityScore}%</td>
                    <td className="px-3 py-3">{supplier.deliveryScore}%</td>
                    <td className="px-3 py-3">{supplier.status}</td>
                    <td className="px-3 py-3"><Link className="text-cyan-200" href={`/dashboard/qs/suppliers/${supplier.supplierId}`}>Open</Link></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>

        <Panel title="Supplier Offers" description="Offer-level price, stock, delivery, quality, and warranty data used by Operation Atlas.">
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="border-b border-white/10 text-xs uppercase tracking-[0.16em] text-slate-500">
                <tr>{["Material", "Supplier", "Unit", "Price Ex VAT", "Stock", "Lead Time", "Delivery"].map((column) => <th key={column} className="px-3 py-3 font-semibold">{column}</th>)}</tr>
              </thead>
              <tbody className="divide-y divide-white/10 text-slate-300">
                {offers.slice(0, 100).map((offer) => (
                  <tr key={offer.offerId}>
                    <td className="px-3 py-3 text-slate-100">{offer.materialName}</td>
                    <td className="px-3 py-3 font-mono text-xs">{offer.supplierId}</td>
                    <td className="px-3 py-3">{offer.unit}</td>
                    <td className="px-3 py-3">{formatCurrency(offer.unitPriceExVat)}</td>
                    <td className="px-3 py-3">{offer.stockStatus}</td>
                    <td className="px-3 py-3">{offer.leadTimeDays ?? "-"}d</td>
                    <td className="px-3 py-3">{formatCurrency(offer.deliveryFee)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
      </div>
    </>
  );
}

function DetailView({ supplier, offers }: Extract<SupplierWorkspaceProps, { view: "detail" }>) {
  return (
    <>
      <Panel title="Supplier Profile" description="Commercial, operational, monetisation, and performance profile.">
        <div className="grid gap-3 md:grid-cols-4">
          {[
            ["Quality", `${supplier.qualityScore}%`],
            ["Reliability", `${supplier.reliabilityScore}%`],
            ["Delivery", `${supplier.deliveryScore}%`],
            ["Overall", `${supplier.overallSupplierScore}%`],
            ["B-BBEE", supplier.bbbeeLevel ?? "-"],
            ["Payment Terms", supplier.paymentTerms ?? "-"],
            ["Lead Fee", supplier.leadFeeEnabled ? formatCurrency(supplier.leadFeeAmount) : "Disabled"],
            ["Subscription", supplier.supplierSubscriptionTier],
          ].map(([label, value]) => (
            <div key={label} className="rounded-lg border border-white/10 bg-slate-950/50 p-3">
              <p className="text-xs uppercase tracking-[0.16em] text-slate-500">{label}</p>
              <p className="mt-2 text-sm font-semibold text-slate-100">{value}</p>
            </div>
          ))}
        </div>
      </Panel>
      <Panel title="Branches and Delivery" description="Used for future regional pricing and transport optimisation.">
        <div className="grid gap-3 md:grid-cols-2">
          {supplier.branches.map((branch) => (
            <div key={branch.branchId} className="rounded-lg border border-white/10 bg-slate-950/50 p-3 text-sm text-slate-300">
              <p className="font-semibold text-slate-100">{branch.branchName}</p>
              <p className="mt-1">{branch.city ?? "Unknown city"} | {branch.province}</p>
              <p className="mt-1 text-slate-500">{branch.deliveryRadiusKm ?? 0}km radius | {formatCurrency(branch.standardDeliveryFee)}</p>
            </div>
          ))}
        </div>
      </Panel>
      <Panel title="Supplier Offer Catalogue" description="Active material offers linked to this supplier.">
        <div className="grid gap-3 md:grid-cols-2">
          {offers.map((offer) => (
            <div key={offer.offerId} className="rounded-lg border border-white/10 bg-slate-950/50 p-3 text-sm text-slate-300">
              <p className="font-semibold text-slate-100">{offer.materialName}</p>
              <p className="mt-1">{formatCurrency(offer.unitPriceExVat)} / {offer.unit} | {offer.stockStatus}</p>
              <p className="mt-1 text-slate-500">{offer.brand ?? "No brand"} | {offer.qualityGrade ?? "Standard"} | {offer.leadTimeDays ?? "-"}d lead time</p>
            </div>
          ))}
        </div>
      </Panel>
    </>
  );
}

export default function QsSupplierIntelligenceWorkspace(props: SupplierWorkspaceProps) {
  return (
    <div className="p-6 text-white">
      <div className="max-w-7xl space-y-6">
        <Header />
        {props.view === "list" ? <ListView {...props} /> : <DetailView {...props} />}
      </div>
    </div>
  );
}
