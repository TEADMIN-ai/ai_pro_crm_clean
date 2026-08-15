"use client";

import { useCallback, useEffect, useState } from "react";
import { authFetch } from "@/lib/client/authFetch";
import type { TenderPricingWorkspace as TenderPricingWorkspaceModel } from "@/types/tenderPricing";

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

function tone(value: string) {
  if (/APPROVED|VALIDATED|LOCKED|DOCUMENT_FILLED/.test(value)) return "border-emerald-200 bg-emerald-50 text-emerald-800";
  if (/FAILED|BLOCK|REJECTED|REQUIRED|UNPRICED|RISK/.test(value)) return "border-red-200 bg-red-50 text-red-800";
  return "border-amber-200 bg-amber-50 text-amber-800";
}

function Badge({ value }: { value: string }) {
  return <span className={`rounded border px-2 py-1 text-xs font-semibold ${tone(value)}`}>{value}</span>;
}

export default function TenderPricingWorkspace(props: Props) {
  const [pricing, setPricing] = useState<TenderPricingWorkspaceModel | null>(null);
  const [state, setState] = useState<LoadState>("idle");
  const [message, setMessage] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setState("loading");
    try {
      const response = await authFetch(`/api/tender-pricing?dealId=${encodeURIComponent(props.dealId)}`);
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? "Tender pricing could not be loaded.");
      setPricing(payload.pricing ?? null);
      setState("idle");
    } catch (error) {
      setState("error");
      setMessage(error instanceof Error ? error.message : "Tender pricing failed to load.");
    }
  }, [props.dealId]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void refresh();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [refresh]);
  async function startMapping() {
    setState("saving");
    setMessage(null);
    const response = await authFetch("/api/tender-pricing", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        dealId: props.dealId,
        opportunityId: props.opportunityId,
        workspaceId: props.workspaceId,
        contractorId: props.contractorId,
        contractorName: props.contractorName,
      }),
    });
    const payload = await response.json();
    if (!response.ok) {
      setState("error");
      setMessage(payload.error ?? "Tender pricing could not be started.");
      return;
    }
    setPricing(payload.pricing);
    setState("idle");
    const nextPricing = payload.pricing as TenderPricingWorkspaceModel;
    const mappedLineCount = nextPricing.lineItems.filter(
      (line) => line.mapping?.supplierQuoteId && line.priceSource !== "UNPRICED",
    ).length;
    const approvedQuoteCount = nextPricing.approvedSupplierQuoteIds.length;
    setMessage(
      mappedLineCount > 0
        ? "Tender pricing workspace created from approved supplier quote sources."
        : approvedQuoteCount > 0
          ? "Tender pricing workspace created. BOQ items require supplier-source mapping or manual pricing before validation can pass."
          : "Tender pricing workspace created. No usable approved supplier quote lines are available for automatic mapping.",
    );
  }

  async function action(actionName: string, body: Record<string, unknown> = {}) {
    if (!pricing) return;
    setState("saving");
    setMessage(null);
    const response = await authFetch(`/api/tender-pricing/${encodeURIComponent(pricing.id)}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: actionName, ...body }),
    });
    const payload = await response.json();
    if (!response.ok) {
      setState("error");
      setMessage(payload.error ?? "Tender pricing action failed.");
      return;
    }
    setPricing(payload.pricing);
    setState("idle");
    setMessage("Tender pricing action recorded.");
  }

  async function enterManualPrice() {
    if (!pricing) return;
    const line = pricing.lineItems.find((item) => item.priceSource === "UNPRICED") ?? pricing.lineItems[0];
    if (!line) return;
    const response = await authFetch(`/api/tender-pricing/${encodeURIComponent(pricing.id)}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        manualPrices: [{ tenderLineItemId: line.id, unitPrice: line.tenderUnitPrice || 1, reason: "Manual staff pricing entered from tender pricing workspace." }],
      }),
    });
    const payload = await response.json();
    if (!response.ok) {
      setState("error");
      setMessage(payload.error ?? "Manual price could not be saved.");
      return;
    }
    setPricing(payload.pricing);
    setMessage("Manual price recorded with mandatory reason.");
  }

  const unresolved = pricing?.blockers.filter((item) => item.severity === "BLOCKER") ?? [];
  const rateSchedule = pricing?.pricingAggregationMode !== "FIXED_QUANTITY";
  const rateScheduleLabel = pricing?.pricingAggregationMode === "UNIT_RATE_ONLY" ? "Unit rates only" : "Mixed schedule - fixed totals unavailable";

  return (
    <section className="grid gap-6">
      <div className="rounded-lg border border-[color:var(--tex-border)] bg-white p-5">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="tex-eyebrow">Tender Pricing Workflow</p>
            <h2 className="mt-2 text-xl font-semibold text-[color:var(--tex-text-strong)]">BOQ and pricing schedule workspace</h2>
            <p className="mt-2 text-sm text-[color:var(--tex-text-muted)]">
              Assigned contractor: {props.contractorName}. Suppliers remain pricing and fulfilment sources.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {pricing ? <Badge value={pricing.pricingStatus} /> : <Badge value="NOT_STARTED" />}
            {pricing ? <Badge value={pricing.validationStatus} /> : null}
            {pricing ? <Badge value={pricing.lockStatus} /> : null}
          </div>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={startMapping} disabled={state === "saving"} className="tex-action-button">Start mapping</button>
        <button type="button" onClick={() => action("approve", { role: "staff", notes: "Staff pricing review completed." })} disabled={!pricing} className="tex-action-button tex-action-button--secondary">Submit for manager review</button>
        <button type="button" onClick={() => action("approve", { role: "manager", notes: "Manager commercial approval completed." })} disabled={!pricing} className="tex-action-button tex-action-button--secondary">Approve pricing</button>
        <button type="button" onClick={enterManualPrice} disabled={!pricing} className="tex-action-button tex-action-button--secondary">Enter manual price</button>
        <button type="button" onClick={() => action("generate_document")} disabled={!pricing} className="tex-action-button tex-action-button--secondary">Generate priced document</button>
        <button type="button" onClick={() => action("validate")} disabled={!pricing} className="tex-action-button tex-action-button--secondary">Validate document</button>
        <button type="button" onClick={() => action("lock")} disabled={!pricing} className="tex-action-button tex-action-button--secondary">Lock revision</button>
        <button type="button" onClick={() => action("send_submission_review")} disabled={!pricing} className="tex-action-button">Send to Submission Review</button>
      </div>

      {message ? <p className="text-sm text-[color:var(--tex-text-muted)]">{message}</p> : null}

      {pricing ? (
        <>
          <div className="grid gap-4 md:grid-cols-4">
            <div className="rounded-lg border border-[color:var(--tex-border)] bg-white p-4">
              <p className="tex-metric-label">Total supplier cost</p>
              <p className="tex-metric-value mt-2">{rateSchedule ? "Not applicable - rate schedule" : money(pricing.totalSupplierCost)}</p>
            </div>
            <div className="rounded-lg border border-[color:var(--tex-border)] bg-white p-4">
              <p className="tex-metric-label">Tender value</p>
              <p className="tex-metric-value mt-2">{rateSchedule ? rateScheduleLabel : money(pricing.total)}</p>
            </div>
            <div className="rounded-lg border border-[color:var(--tex-border)] bg-white p-4">
              <p className="tex-metric-label">Gross profit</p>
              <p className="tex-metric-value mt-2">{rateSchedule ? "Not fixed by tender" : money(pricing.grossProfit)}</p>
            </div>
            <div className="rounded-lg border border-[color:var(--tex-border)] bg-white p-4">
              <p className="tex-metric-label">Gross margin</p>
              <p className="tex-metric-value mt-2">{rateSchedule ? "Not fixed by tender" : pricing.grossMarginPercentage?.toFixed(2) + "%"}</p>
            </div>
          </div>

          <div className="grid gap-4 lg:grid-cols-3">
            <section className="rounded-lg border border-[color:var(--tex-border)] bg-white p-5">
              <h3 className="font-semibold text-[color:var(--tex-text-strong)]">Source documents</h3>
              <p className="mt-3 text-sm text-[color:var(--tex-text-muted)]">Pricing schedule: {pricing.sourcePricingDocumentId ?? "Required"}</p>
              <p className="mt-1 text-sm text-[color:var(--tex-text-muted)]">Approved supplier quotes: {pricing.approvedSupplierQuoteIds.length}</p>
              <p className="mt-1 text-sm text-[color:var(--tex-text-muted)]">Revision: {pricing.revision}</p>
            </section>
            <section className="rounded-lg border border-[color:var(--tex-border)] bg-white p-5">
              <h3 className="font-semibold text-[color:var(--tex-text-strong)]">Approvals</h3>
              <div className="mt-3 flex flex-wrap gap-2">
                <Badge value={pricing.commercialReviewStatus} />
                <Badge value={pricing.managementApprovalStatus} />
                <Badge value={pricing.documentFillStatus} />
              </div>
            </section>
            <section className="rounded-lg border border-[color:var(--tex-border)] bg-white p-5">
              <h3 className="font-semibold text-[color:var(--tex-text-strong)]">Next action</h3>
              <p className="mt-3 text-sm text-[color:var(--tex-text-muted)]">{pricing.nextAction}</p>
            </section>
          </div>

          <div className="overflow-x-auto rounded-lg border border-[color:var(--tex-border)] bg-white">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-50 text-left text-xs uppercase text-[color:var(--tex-text-muted)]">
                <tr>
                  <th className="px-4 py-3">Tender line</th>
                  <th className="px-4 py-3">Mapping</th>
                  <th className="px-4 py-3">Supplier</th>
                  <th className="px-4 py-3">{rateSchedule ? "Unit cost" : "Source cost"}</th>
                  <th className="px-4 py-3">Additions</th>
                  <th className="px-4 py-3">Margin</th>
                  <th className="px-4 py-3">{rateSchedule ? "Tender unit rate" : "Final price"}</th>
                  <th className="px-4 py-3">Risk</th>
                </tr>
              </thead>
              <tbody>
                {pricing.lineItems.map((line) => (
                  <tr key={line.id} className="border-t border-[color:var(--tex-border)] align-top">
                    <td className="px-4 py-3">
                      <span className="font-medium">{line.description}</span>
                      <span className="block text-xs text-[color:var(--tex-text-muted)]">{line.quantityMode === "UNIT_RATE_ONLY" ? "Unit rate / " + line.unit : line.quantity + " " + line.unit}</span>
                    </td>
                    <td className="px-4 py-3"><Badge value={line.mapping?.reviewStatus ?? "UNMATCHED"} /></td>
                    <td className="px-4 py-3">{line.mapping?.supplierName || "Manual or unpriced"}</td>
                    <td className="px-4 py-3">{money(line.sourceCost)}</td>
                    <td className="px-4 py-3">{money(line.deliveryAllocation + line.handlingAllocation + line.overheadAllocation + line.riskAllowance + line.contingency)}</td>
                    <td className="px-4 py-3">{money(line.profitMargin)}</td>
                    <td className="px-4 py-3">{line.quantityMode === "UNIT_RATE_ONLY" ? money(line.tenderUnitPrice) : money(line.tenderLineTotal)}</td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1">{line.riskFlags.length ? line.riskFlags.map((flag) => <Badge key={flag} value={flag} />) : <Badge value="CLEAR" />}</div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <section className="rounded-lg border border-[color:var(--tex-border)] bg-white p-5">
            <h3 className="font-semibold text-[color:var(--tex-text-strong)]">Validation results</h3>
            {unresolved.length ? (
              <ul className="mt-3 grid gap-2 text-sm text-red-800">
                {unresolved.map((item, index) => <li key={`${item.code}-${index}`}>{item.message}</li>)}
              </ul>
            ) : (
              <p className="mt-3 text-sm text-[color:var(--tex-text-muted)]">No compulsory pricing blockers are currently recorded.</p>
            )}
          </section>
        </>
      ) : (
        <div className="rounded-lg border border-[color:var(--tex-border)] bg-white p-8 text-sm text-[color:var(--tex-text-muted)]">
          Tender pricing has not been started for this deal.
        </div>
      )}
    </section>
  );
}
