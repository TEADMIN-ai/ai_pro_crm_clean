"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import type { SupplierQuote, SupplierQuoteComparison } from "@/types/supplierQuote";

type Props = {
  dealId: string;
  opportunityId: string;
  workspaceId?: string | null;
  contractorId?: string | null;
  contractorName: string;
};

type LoadState = "idle" | "loading" | "saving" | "error";

function money(value: number | null | undefined) {
  return `R${(value ?? 0).toLocaleString("en-ZA", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function statusTone(value: string) {
  if (value.includes("APPROVED") || value.includes("LOW")) return "text-emerald-700 bg-emerald-50 border-emerald-200";
  if (value.includes("REJECTED") || value.includes("HIGH")) return "text-red-700 bg-red-50 border-red-200";
  return "text-amber-700 bg-amber-50 border-amber-200";
}

export default function SupplierQuoteWorkspace(props: Props) {
  const [quotes, setQuotes] = useState<SupplierQuote[]>([]);
  const [comparison, setComparison] = useState<SupplierQuoteComparison | null>(null);
  const [state, setState] = useState<LoadState>("idle");
  const [message, setMessage] = useState<string | null>(null);

  async function refresh() {
    setState("loading");
    try {
      const [quotesResponse, comparisonResponse] = await Promise.all([
        fetch(`/api/supplier-quotes?dealId=${encodeURIComponent(props.dealId)}`),
        fetch(`/api/supplier-quotes?dealId=${encodeURIComponent(props.dealId)}&view=comparison`),
      ]);
      const quotesPayload = await quotesResponse.json();
      const comparisonPayload = await comparisonResponse.json();
      if (!quotesResponse.ok) throw new Error(quotesPayload.error ?? "Supplier quotes could not be loaded.");
      if (!comparisonResponse.ok) throw new Error(comparisonPayload.error ?? "Comparison could not be loaded.");
      setQuotes(quotesPayload.quotes ?? []);
      setComparison(comparisonPayload.comparison ?? null);
      setState("idle");
    } catch (error) {
      setState("error");
      setMessage(error instanceof Error ? error.message : "Supplier quote workspace failed to load.");
    }
  }

  useEffect(() => {
    void refresh();
  }, [props.dealId]);

  async function upload(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);
    formData.set("dealId", props.dealId);
    formData.set("opportunityId", props.opportunityId);
    if (props.workspaceId) formData.set("workspaceId", props.workspaceId);
    if (props.contractorId) formData.set("contractorId", props.contractorId);
    formData.set("contractorName", props.contractorName);
    setState("saving");
    setMessage(null);
    const response = await fetch("/api/supplier-quotes", { method: "POST", body: formData });
    const payload = await response.json();
    if (!response.ok) {
      setState("error");
      setMessage(payload.error ?? "Supplier quote upload failed.");
      return;
    }
    form.reset();
    setMessage(payload.duplicate ? "Duplicate quote detected. Existing record was reused." : "Supplier quote uploaded for review.");
    await refresh();
  }

  async function decide(quoteId: string, action: "approve" | "reject" | "request_clarification") {
    setState("saving");
    const response = await fetch(`/api/supplier-quotes/${encodeURIComponent(quoteId)}/approval`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action, note: action === "approve" ? "Approved from supplier quote workspace." : undefined }),
    });
    const payload = await response.json();
    if (!response.ok) {
      setState("error");
      setMessage(payload.error ?? "Supplier quote decision failed.");
      return;
    }
    setMessage("Supplier quote decision recorded.");
    await refresh();
  }

  async function sendToPricing(quoteId: string) {
    setState("saving");
    const response = await fetch(`/api/supplier-quotes/${encodeURIComponent(quoteId)}/pricing`, { method: "POST" });
    const payload = await response.json();
    if (!response.ok) {
      setState("error");
      setMessage(payload.error ?? "Pricing handoff failed.");
      return;
    }
    setMessage("Approved supplier pricing sent to the tender pricing workflow.");
    await refresh();
  }

  const recommendedQuoteId = comparison?.recommendedSupplier?.quoteId ?? null;
  const canUpload = useMemo(() => Boolean(props.contractorId), [props.contractorId]);

  return (
    <section className="grid gap-6">
      <div className="rounded-lg border border-[color:var(--tex-border)] bg-white p-5">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="tex-eyebrow">Supplier Quote Intake</p>
            <h2 className="mt-2 text-xl font-semibold text-[color:var(--tex-text-strong)]">External supplier pricing</h2>
            <p className="mt-2 text-sm text-[color:var(--tex-text-muted)]">
              Bidding contractor: {props.contractorName}. Supplier quotes are fulfilment and pricing sources only.
            </p>
          </div>
          <span className="w-fit rounded border border-[color:var(--tex-border)] px-3 py-1 text-xs font-semibold text-[color:var(--tex-text-muted)]">
            {quotes.length} quote{quotes.length === 1 ? "" : "s"}
          </span>
        </div>
      </div>

      <form onSubmit={upload} className="grid gap-4 rounded-lg border border-[color:var(--tex-border)] bg-white p-5">
        <div className="grid gap-4 md:grid-cols-3">
          <label className="grid gap-1 text-sm font-medium">
            Supplier
            <input name="supplierName" required className="rounded-md border border-[color:var(--tex-border)] px-3 py-2" />
          </label>
          <label className="grid gap-1 text-sm font-medium">
            Registration number
            <input name="supplierRegistrationNumber" className="rounded-md border border-[color:var(--tex-border)] px-3 py-2" />
          </label>
          <label className="grid gap-1 text-sm font-medium">
            Contact email
            <input name="supplierEmail" type="email" className="rounded-md border border-[color:var(--tex-border)] px-3 py-2" />
          </label>
          <label className="grid gap-1 text-sm font-medium">
            Quote number
            <input name="quotationNumber" className="rounded-md border border-[color:var(--tex-border)] px-3 py-2" />
          </label>
          <label className="grid gap-1 text-sm font-medium">
            Validity date
            <input name="validityDate" type="date" className="rounded-md border border-[color:var(--tex-border)] px-3 py-2" />
          </label>
          <label className="grid gap-1 text-sm font-medium">
            Total
            <input name="total" inputMode="decimal" className="rounded-md border border-[color:var(--tex-border)] px-3 py-2" />
          </label>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          <label className="grid gap-1 text-sm font-medium">
            Payment terms
            <input name="paymentTerms" className="rounded-md border border-[color:var(--tex-border)] px-3 py-2" />
          </label>
          <label className="grid gap-1 text-sm font-medium">
            Delivery period
            <input name="deliveryPeriod" className="rounded-md border border-[color:var(--tex-border)] px-3 py-2" />
          </label>
          <label className="grid gap-1 text-sm font-medium">
            PDF quote
            <input name="file" type="file" accept="application/pdf" className="rounded-md border border-[color:var(--tex-border)] px-3 py-2" />
          </label>
        </div>
        <button disabled={!canUpload || state === "saving"} className="tex-action-button w-fit disabled:opacity-50">
          Upload supplier quote
        </button>
        {!canUpload ? <p className="text-sm text-red-700">Assign Torque Empire as bidding contractor before uploading supplier quotes.</p> : null}
        {message ? <p className="text-sm text-[color:var(--tex-text-muted)]">{message}</p> : null}
      </form>

      <div className="grid gap-4">
        {quotes.map((quote) => (
          <article key={quote.id} className="rounded-lg border border-[color:var(--tex-border)] bg-white p-5">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <h3 className="text-lg font-semibold text-[color:var(--tex-text-strong)]">{quote.supplierName}</h3>
                <p className="mt-1 text-sm text-[color:var(--tex-text-muted)]">Quote {quote.quotationNumber ?? "number pending"} · {money(quote.total)}</p>
                <p className="mt-1 text-xs text-[color:var(--tex-text-muted)]">Supplier source for {quote.contractorName}; contractor assignment remains unchanged.</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <span className={`rounded border px-2 py-1 text-xs font-semibold ${statusTone(quote.workflowStatus)}`}>{quote.workflowStatus}</span>
                <span className={`rounded border px-2 py-1 text-xs font-semibold ${statusTone(quote.approvalStatus)}`}>{quote.approvalStatus}</span>
                {recommendedQuoteId === quote.id ? <span className="rounded border border-blue-200 bg-blue-50 px-2 py-1 text-xs font-semibold text-blue-700">Recommended</span> : null}
              </div>
            </div>
            <div className="mt-4 grid gap-3 md:grid-cols-4">
              <p className="text-sm"><span className="block text-xs text-[color:var(--tex-text-muted)]">VAT</span>{money(quote.vat)}</p>
              <p className="text-sm"><span className="block text-xs text-[color:var(--tex-text-muted)]">Delivery</span>{money(quote.deliveryCost)}</p>
              <p className="text-sm"><span className="block text-xs text-[color:var(--tex-text-muted)]">Validity</span>{quote.validityDate ?? "Missing"}</p>
              <p className="text-sm"><span className="block text-xs text-[color:var(--tex-text-muted)]">Line items</span>{quote.lineItems.length}</p>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <button onClick={() => decide(quote.id, "approve")} className="tex-action-button tex-action-button--secondary" type="button">Approve</button>
              <button onClick={() => decide(quote.id, "request_clarification")} className="tex-action-button tex-action-button--secondary" type="button">Clarification</button>
              <button onClick={() => decide(quote.id, "reject")} className="tex-action-button tex-action-button--secondary" type="button">Reject</button>
              <button onClick={() => sendToPricing(quote.id)} className="tex-action-button" type="button" disabled={quote.approvalStatus !== "APPROVED"}>Send to pricing</button>
            </div>
          </article>
        ))}
      </div>

      {comparison?.rows.length ? (
        <div className="overflow-x-auto rounded-lg border border-[color:var(--tex-border)] bg-white">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase text-[color:var(--tex-text-muted)]">
              <tr>
                <th className="px-4 py-3">Supplier</th>
                <th className="px-4 py-3">Total</th>
                <th className="px-4 py-3">Coverage</th>
                <th className="px-4 py-3">Risk</th>
                <th className="px-4 py-3">Reason</th>
              </tr>
            </thead>
            <tbody>
              {comparison.rows.map((row) => (
                <tr key={row.quoteId} className="border-t border-[color:var(--tex-border)]">
                  <td className="px-4 py-3 font-medium">{row.supplierName}</td>
                  <td className="px-4 py-3">{money(row.quoteTotal)}</td>
                  <td className="px-4 py-3">{row.lineItemCoverage}%</td>
                  <td className="px-4 py-3"><span className={`rounded border px-2 py-1 text-xs font-semibold ${statusTone(row.commercialRisk)}`}>{row.commercialRisk}</span></td>
                  <td className="px-4 py-3 text-[color:var(--tex-text-muted)]">{row.recommendationReason}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </section>
  );
}
