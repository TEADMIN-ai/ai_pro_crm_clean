"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import Badge from "@/components/ui/Badge";
import Card, { IdentityCardHeader } from "@/components/ui/Card";
import Table from "@/components/ui/Table";
import { authFetch } from "@/lib/client/authFetch";

type PartnerQuote = { supplierQuoteId: string; procurementCaseId: string; vehicleDescription: string; quotedAmount: number; availability: string; supplierReference?: string | null; colourSpecification?: string | null; partnerVisibleStatus: string; renderedPartnerMessage?: string | null; stockAvailability?: string | null; expectedDeliveryDate?: string | null; colourSpecificationConfirmed?: boolean; partnerNotes?: string | null; revisionRequestOpen?: boolean; supportingDocuments: Array<{ documentId: string; fileName: string; fileUrl?: string | null; storagePath?: string | null; uploadedAt: string }>; updatedAt: string };
type PartnerCase = { procurementCaseId: string; internalReference: string; vehicleQuantity: number; make: string; model: string; variant?: string | null; requiredSpecifications?: string | null; condition: string; purchaseMethod: string; requiredDeliveryDate?: string | null; partnerVisibleStatus: string; quoteIds: string[]; updatedAt: string };
type PartnerOverview = { supplier: { supplierId: string; legalName: string; tradingName?: string | null; relationshipStatus: string; brandsRepresented?: string[]; geographicCoverage?: string | null }; procurementCases: PartnerCase[]; supplierQuotes: PartnerQuote[]; timeline: Array<{ id: string; status: string; timestamp: string; note: string }> };

const EMPTY_OVERVIEW: PartnerOverview = { supplier: { supplierId: "", legalName: "", relationshipStatus: "" }, procurementCases: [], supplierQuotes: [], timeline: [] };

function money(value: number) { return "R" + value.toLocaleString("en-ZA"); }
function dateLabel(value?: string | null) { if (!value) return "Not recorded"; const parsed = new Date(value); return Number.isNaN(parsed.getTime()) ? "Not recorded" : parsed.toLocaleDateString("en-ZA", { year: "numeric", month: "short", day: "numeric" }); }
export function PartnerPublishedMessage({ message }: { message?: string | null }) {
  return message ? <p className="mt-1 text-xs text-slate-300">{message}</p> : <p className="mt-1 text-xs text-slate-500">No approved partner message has been published.</p>;
}

export default function SupplyChainPartnerPortal() {
  const [overview, setOverview] = useState<PartnerOverview>(EMPTY_OVERVIEW);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedQuoteId, setSelectedQuoteId] = useState("");
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({ action: "UPDATE_AVAILABILITY", quotedAmount: "", availability: "", stockAvailability: "", expectedDeliveryDate: "", colourSpecification: "", colourSpecificationConfirmed: false, supplierReference: "", partnerNotes: "", documentFileName: "", documentUrl: "" });

  const loadOverview = useCallback(async () => {
    try {
      setLoading(true);
      const response = await authFetch("/api/vehicle-finance/partner/overview", { cache: "no-store" });
      const payload = (await response.json().catch(() => null)) as PartnerOverview & { error?: string } | null;
      if (!response.ok || !payload) throw new Error(payload?.error ?? "Partner portal unavailable");
      setOverview(payload);
      setSelectedQuoteId((current) => current || payload.supplierQuotes[0]?.supplierQuoteId || "");
      setError(null);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Partner portal unavailable");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void loadOverview(); }, [loadOverview]);

  async function submitAction(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedQuoteId) return;
    try {
      setBusy(true);
      const body: Record<string, unknown> = { action: form.action, availability: form.availability, stockAvailability: form.stockAvailability, expectedDeliveryDate: form.expectedDeliveryDate, colourSpecification: form.colourSpecification, colourSpecificationConfirmed: form.colourSpecificationConfirmed, supplierReference: form.supplierReference, partnerNotes: form.partnerNotes };
      if (form.quotedAmount) body.quotedAmount = Number(form.quotedAmount);
      if (form.documentFileName || form.documentUrl) body.document = { fileName: form.documentFileName, fileUrl: form.documentUrl };
      const response = await authFetch("/api/vehicle-finance/partner/quotes/" + encodeURIComponent(selectedQuoteId), { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const payload = (await response.json().catch(() => null)) as { error?: string } | null;
      if (!response.ok) throw new Error(payload?.error ?? "Partner quote update failed");
      setForm({ action: "UPDATE_AVAILABILITY", quotedAmount: "", availability: "", stockAvailability: "", expectedDeliveryDate: "", colourSpecification: "", colourSpecificationConfirmed: false, supplierReference: "", partnerNotes: "", documentFileName: "", documentUrl: "" });
      await loadOverview();
    } catch (updateError) {
      setError(updateError instanceof Error ? updateError.message : "Partner quote update failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-950 px-4 py-6 text-slate-100 md:px-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <header className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-800 pb-5">
          <div><p className="text-xs font-semibold uppercase tracking-[0.24em] text-cyan-300">Supply Chain Partner Portal</p><h1 className="mt-2 text-2xl font-semibold text-white">{overview.supplier.legalName || "Partner workspace"}</h1><p className="mt-2 max-w-3xl text-sm text-slate-400">Partner-scoped procurement visibility for quotations, availability updates, supporting documents, and approved timeline activity.</p></div>
          <Badge tone={overview.supplier.relationshipStatus === "PREFERRED" || overview.supplier.relationshipStatus === "CONFIRMED" ? "success" : "neutral"}>{overview.supplier.relationshipStatus || "Pending"}</Badge>
        </header>
        {error ? <div className="rounded-lg border border-rose-500/40 bg-rose-950/40 px-4 py-3 text-sm text-rose-100">{error}</div> : null}
        {loading ? <Card><p className="text-sm text-slate-400">Loading partner procurement workspace...</p></Card> : null}
        {!loading ? <>
          <div className="grid gap-4 md:grid-cols-4"><Card><p className="text-xs uppercase tracking-[0.18em] text-slate-500">Visible Cases</p><p className="mt-2 text-2xl font-semibold">{overview.procurementCases.length}</p></Card><Card><p className="text-xs uppercase tracking-[0.18em] text-slate-500">Own Quotes</p><p className="mt-2 text-2xl font-semibold">{overview.supplierQuotes.length}</p></Card><Card><p className="text-xs uppercase tracking-[0.18em] text-slate-500">Revision Requests</p><p className="mt-2 text-2xl font-semibold">{overview.supplierQuotes.filter((quote) => quote.revisionRequestOpen).length}</p></Card><Card><p className="text-xs uppercase tracking-[0.18em] text-slate-500">Pending Delivery</p><p className="mt-2 text-2xl font-semibold">{overview.procurementCases.filter((item) => item.partnerVisibleStatus === "DELIVERY_PENDING").length}</p></Card></div>
          <div className="grid gap-6 xl:grid-cols-[1.3fr_0.7fr]"><Card><IdentityCardHeader title="Partner Procurement Cases" subtitle="Cases are visible only when linked through your supplier quotations" /><Table className="mt-4"><thead><tr><th>Reference</th><th>Requirement</th><th>Status</th><th>Delivery</th></tr></thead><tbody>{overview.procurementCases.map((item) => <tr key={item.procurementCaseId}><td>{item.internalReference}</td><td>{item.vehicleQuantity} x {item.make} {item.model}<p className="text-xs text-slate-500">{item.requiredSpecifications || item.condition}</p></td><td><Badge tone="info">{item.partnerVisibleStatus}</Badge></td><td>{dateLabel(item.requiredDeliveryDate)}</td></tr>)}</tbody></Table></Card><Card><IdentityCardHeader title="Quote Action" subtitle="Supplier updates do not change internal lifecycle status" /><form className="mt-4 grid gap-3" onSubmit={submitAction}><label className="grid gap-1 text-sm text-slate-300"><span>Quote</span><select value={selectedQuoteId} onChange={(event) => setSelectedQuoteId(event.target.value)} className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white"><option value="">Select quote</option>{overview.supplierQuotes.map((quote) => <option key={quote.supplierQuoteId} value={quote.supplierQuoteId}>{quote.vehicleDescription}</option>)}</select></label><label className="grid gap-1 text-sm text-slate-300"><span>Action</span><select value={form.action} onChange={(event) => setForm((current) => ({ ...current, action: event.target.value }))} className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white"><option value="UPDATE_AVAILABILITY">Update availability</option><option value="REVISE_QUOTE">Upload revised quotation</option><option value="RESPOND_REVISION">Respond to revision request</option><option value="UPLOAD_DOCUMENT">Upload supporting document</option></select></label>{[["quotedAmount", "Revised Amount"], ["availability", "Availability"], ["stockAvailability", "Stock Availability"], ["expectedDeliveryDate", "Expected Delivery Date"], ["colourSpecification", "Colour / Specification"], ["supplierReference", "Supplier Reference"], ["partnerNotes", "Partner Notes"], ["documentFileName", "Supporting Document Name"], ["documentUrl", "Supporting Document URL"]].map(([field, label]) => <label key={field} className="grid gap-1 text-sm text-slate-300"><span>{label}</span><input value={form[field as keyof typeof form] as string} onChange={(event) => setForm((current) => ({ ...current, [field]: event.target.value }))} type={field === "quotedAmount" ? "number" : field === "expectedDeliveryDate" ? "date" : "text"} className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white" /></label>)}<label className="flex items-center gap-2 text-sm text-slate-300"><input type="checkbox" checked={form.colourSpecificationConfirmed} onChange={(event) => setForm((current) => ({ ...current, colourSpecificationConfirmed: event.target.checked }))} /> Colour and specification available</label><button type="submit" disabled={!selectedQuoteId || busy} className="rounded-lg bg-cyan-600 px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:bg-slate-700">{busy ? "Submitting..." : "Submit Partner Update"}</button></form></Card></div>
          <Card><IdentityCardHeader title="Own Quotations" subtitle="Competitor identities and pricing are excluded from this view" /><Table className="mt-4"><thead><tr><th>Vehicle</th><th>Amount</th><th>Availability</th><th>Status</th><th>Documents</th></tr></thead><tbody>{overview.supplierQuotes.map((quote) => <tr key={quote.supplierQuoteId}><td>{quote.vehicleDescription}<p className="text-xs text-slate-500">{quote.supplierReference || "No supplier reference"}</p></td><td>{money(quote.quotedAmount)}</td><td>{quote.stockAvailability || quote.availability}</td><td><Badge tone={quote.partnerVisibleStatus === "SELECTED" ? "success" : quote.partnerVisibleStatus === "NOT_SELECTED" ? "warning" : "neutral"}>{quote.partnerVisibleStatus}</Badge><PartnerPublishedMessage message={quote.renderedPartnerMessage} /></td><td>{quote.supportingDocuments.length}</td></tr>)}</tbody></Table></Card>
          <Card><IdentityCardHeader title="Partner Activity Timeline" subtitle="Sanitised status history visible to this supplier only" /><div className="mt-4 space-y-3">{overview.timeline.map((entry) => <div key={entry.id} className="rounded-lg border border-slate-800 bg-slate-950/70 p-3"><div className="flex flex-wrap items-center justify-between gap-2"><Badge tone="info">{entry.status}</Badge><span className="text-xs text-slate-500">{dateLabel(entry.timestamp)}</span></div><p className="mt-2 text-sm text-slate-300">{entry.note}</p></div>)}{overview.timeline.length === 0 ? <p className="text-sm text-slate-400">No partner-visible activity yet.</p> : null}</div></Card>
        </> : null}
      </div>
    </div>
  );
}
