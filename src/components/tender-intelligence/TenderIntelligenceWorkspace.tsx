"use client";

import { useEffect, useMemo, useState } from "react";
import type {
  TenderExtractedLineItem,
  TenderIntelligence,
  TenderLineItemReviewStatus,
  TenderPricingClassification,
} from "@/types/tenderIntelligence";

type Props = {
  dealId: string;
};

type LoadState = "idle" | "loading" | "saving" | "error";

const pricingClassifications: TenderPricingClassification[] = [
  "SEPARATE_BOQ_DOCUMENT",
  "EMBEDDED_BOQ",
  "EMBEDDED_PRICING_SCHEDULE",
  "RATE_SCHEDULE",
  "FORM_OF_OFFER_ONLY",
  "PRICING_REQUIRED_BUT_TEMPLATE_NOT_FOUND",
  "NO_PRICING_REQUIRED",
  "MANUAL_REVIEW_REQUIRED",
];

const reviewStatuses: TenderLineItemReviewStatus[] = ["APPROVED", "REVIEW_REQUIRED", "REJECTED", "MERGED", "NOT_APPLICABLE"];

function statusTone(value: string) {
  if (/APPROVED|COMPLETE|EXTRACTED/.test(value)) return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (/REJECTED|FAILED|MISSING/.test(value)) return "border-red-200 bg-red-50 text-red-700";
  return "border-amber-200 bg-amber-50 text-amber-700";
}

function display(value: string | null | undefined) {
  return value?.trim() || "Not confirmed";
}

export default function TenderIntelligenceWorkspace({ dealId }: Props) {
  const [intelligence, setIntelligence] = useState<TenderIntelligence | null>(null);
  const [state, setState] = useState<LoadState>("idle");
  const [message, setMessage] = useState<string | null>(null);

  async function refresh() {
    setState("loading");
    setMessage(null);
    try {
      const response = await fetch(`/api/tender-intelligence/${encodeURIComponent(dealId)}`);
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? "Tender intelligence could not be loaded.");
      setIntelligence(payload.intelligence ?? null);
      setState("idle");
    } catch (error) {
      setState("error");
      setMessage(error instanceof Error ? error.message : "Tender intelligence failed to load.");
    }
  }

  useEffect(() => {
    void refresh();
  }, [dealId]);

  async function startAnalysis(refreshAfterAmendment = false) {
    setState("saving");
    setMessage(null);
    const endpoint = refreshAfterAmendment
      ? `/api/tender-intelligence/${encodeURIComponent(dealId)}/refresh`
      : `/api/tender-intelligence/${encodeURIComponent(dealId)}`;
    const response = await fetch(endpoint, { method: "POST" });
    const payload = await response.json();
    if (!response.ok) {
      setState("error");
      setMessage(payload.error ?? "Analysis could not be started.");
      return;
    }
    setIntelligence(payload.intelligence);
    setState("idle");
    setMessage(refreshAfterAmendment ? "Amendment refresh completed and requires review." : "Analysis completed and requires review.");
  }

  async function updateReview(body: Record<string, unknown>) {
    setState("saving");
    const response = await fetch(`/api/tender-intelligence/${encodeURIComponent(dealId)}/review`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    const payload = await response.json();
    if (!response.ok) {
      setState("error");
      setMessage(payload.error ?? "Review update failed.");
      return;
    }
    setIntelligence(payload.intelligence);
    setState("idle");
    setMessage("Review update saved.");
  }

  async function approve() {
    setState("saving");
    const response = await fetch(`/api/tender-intelligence/${encodeURIComponent(dealId)}/approve`, { method: "POST" });
    const payload = await response.json();
    if (!response.ok) {
      setState("error");
      setMessage(payload.error ?? "Approval failed.");
      return;
    }
    setIntelligence(payload.intelligence);
    setState("idle");
    setMessage("Tender intelligence approved for pricing handoff.");
  }

  async function reject() {
    setState("saving");
    const response = await fetch(`/api/tender-intelligence/${encodeURIComponent(dealId)}/reject`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ reason: "Rejected from tender intelligence workspace." }),
    });
    const payload = await response.json();
    if (!response.ok) {
      setState("error");
      setMessage(payload.error ?? "Rejection failed.");
      return;
    }
    setIntelligence(payload.intelligence);
    setState("idle");
    setMessage("Tender intelligence rejected.");
  }

  function updateLine(line: TenderExtractedLineItem, patch: Partial<TenderExtractedLineItem>) {
    void updateReview({ lineItems: [{ id: line.id, ...patch }] });
  }

  const lowConfidenceCount = useMemo(
    () => intelligence?.extractedLineItems.filter((item) => item.reviewStatus === "REVIEW_REQUIRED").length ?? 0,
    [intelligence],
  );

  return (
    <section className="grid gap-6">
      <div className="rounded-lg border border-[color:var(--tex-border)] bg-white p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="tex-eyebrow">Tender Document Intelligence</p>
            <h2 className="mt-2 text-xl font-semibold text-[color:var(--tex-text-strong)]">
              Complete tender document set analysis
            </h2>
            <p className="mt-2 text-sm text-[color:var(--tex-text-muted)]">
              Staff approval is required before extracted pricing lines are handed to final pricing.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" className="tex-action-button" disabled={state === "saving"} onClick={() => startAnalysis(false)}>
              Start analysis
            </button>
            <button type="button" className="tex-action-button tex-action-button--secondary" disabled={state === "saving"} onClick={() => startAnalysis(true)}>
              Refresh after amendment
            </button>
          </div>
        </div>
        {message ? <p className={`mt-3 text-sm ${state === "error" ? "text-red-700" : "text-[color:var(--tex-text-muted)]"}`}>{message}</p> : null}
      </div>

      {!intelligence ? (
        <div className="rounded-lg border border-[color:var(--tex-border)] bg-white p-5 text-sm text-[color:var(--tex-text-muted)]">
          No tender intelligence analysis exists for this deal yet.
        </div>
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-4">
            <div className="rounded-lg border border-[color:var(--tex-border)] bg-white p-4">
              <p className="text-xs uppercase text-[color:var(--tex-text-muted)]">Analysis</p>
              <span className={`mt-2 inline-flex rounded border px-2 py-1 text-xs font-semibold ${statusTone(intelligence.analysisStatus)}`}>{intelligence.analysisStatus}</span>
            </div>
            <div className="rounded-lg border border-[color:var(--tex-border)] bg-white p-4">
              <p className="text-xs uppercase text-[color:var(--tex-text-muted)]">Pricing</p>
              <span className={`mt-2 inline-flex rounded border px-2 py-1 text-xs font-semibold ${statusTone(intelligence.boqClassification)}`}>{intelligence.boqClassification}</span>
            </div>
            <div className="rounded-lg border border-[color:var(--tex-border)] bg-white p-4">
              <p className="text-xs uppercase text-[color:var(--tex-text-muted)]">Line items</p>
              <p className="mt-2 text-lg font-semibold">{intelligence.extractedLineItems.length}</p>
            </div>
            <div className="rounded-lg border border-[color:var(--tex-border)] bg-white p-4">
              <p className="text-xs uppercase text-[color:var(--tex-text-muted)]">Low confidence</p>
              <p className="mt-2 text-lg font-semibold">{lowConfidenceCount}</p>
            </div>
          </div>

          <div className="grid gap-4 rounded-lg border border-[color:var(--tex-border)] bg-white p-5">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="tex-eyebrow">Classification</p>
                <h3 className="mt-1 text-lg font-semibold">BOQ and pricing decision</h3>
              </div>
              <select
                className="rounded-md border border-[color:var(--tex-border)] px-3 py-2 text-sm"
                value={intelligence.boqClassification}
                onChange={(event) => updateReview({ pricingClassification: event.target.value })}
              >
                {pricingClassifications.map((classification) => <option key={classification}>{classification}</option>)}
              </select>
            </div>
            <div className="flex flex-wrap gap-2">
              <button type="button" className="tex-action-button tex-action-button--secondary" onClick={() => updateReview({ markPricingNotApplicable: true })}>
                Mark pricing not applicable
              </button>
              <button type="button" className="tex-action-button tex-action-button--secondary" onClick={() => updateReview({ missingPricingTemplate: true })}>
                Mark missing pricing template
              </button>
            </div>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <SummaryPanel title="Executive summary" rows={intelligence.executiveSummary} />
            <SummaryPanel title="Detailed submission summary" rows={intelligence.detailedSubmissionSummary} />
          </div>

          <div className="rounded-lg border border-[color:var(--tex-border)] bg-white p-5">
            <p className="tex-eyebrow">Source documents</p>
            <div className="mt-4 grid gap-3">
              {intelligence.documentAnalyses.map((document) => (
                <div key={document.documentId} className="rounded-md border border-[color:var(--tex-border)] p-3">
                  <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                    <div>
                      <p className="font-medium">{document.filename}</p>
                      <p className="text-xs text-[color:var(--tex-text-muted)]">{document.documentCategory} · pages {document.pageCount} · {document.extractionStatus}</p>
                    </div>
                    <span className={`w-fit rounded border px-2 py-1 text-xs font-semibold ${statusTone(document.amendmentStatus)}`}>{document.amendmentStatus}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="overflow-x-auto rounded-lg border border-[color:var(--tex-border)] bg-white">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-50 text-left text-xs uppercase text-[color:var(--tex-text-muted)]">
                <tr>
                  <th className="px-4 py-3">Source</th>
                  <th className="px-4 py-3">Description</th>
                  <th className="px-4 py-3">Qty</th>
                  <th className="px-4 py-3">Unit</th>
                  <th className="px-4 py-3">Total</th>
                  <th className="px-4 py-3">Review</th>
                </tr>
              </thead>
              <tbody>
                {intelligence.extractedLineItems.map((line) => (
                  <tr key={line.id} className="border-t border-[color:var(--tex-border)] align-top">
                    <td className="px-4 py-3 text-xs text-[color:var(--tex-text-muted)]">Page {line.sourcePage}, row {line.sourceRow}</td>
                    <td className="px-4 py-3">
                      <input
                        className="w-full rounded border border-[color:var(--tex-border)] px-2 py-1"
                        value={line.description}
                        onChange={(event) => updateLine(line, { description: event.target.value })}
                      />
                      <p className="mt-1 text-xs text-[color:var(--tex-text-muted)]">{line.rawText}</p>
                    </td>
                    <td className="px-4 py-3">
                      <input
                        className="w-24 rounded border border-[color:var(--tex-border)] px-2 py-1"
                        value={line.quantity ?? ""}
                        onChange={(event) => updateLine(line, { quantity: event.target.value ? Number(event.target.value) : null })}
                      />
                    </td>
                    <td className="px-4 py-3">
                      <input
                        className="w-24 rounded border border-[color:var(--tex-border)] px-2 py-1"
                        value={line.unit ?? ""}
                        onChange={(event) => updateLine(line, { unit: event.target.value || null })}
                      />
                    </td>
                    <td className="px-4 py-3">{line.tenderLineTotal ?? "Pending"}</td>
                    <td className="px-4 py-3">
                      <select
                        className="rounded border border-[color:var(--tex-border)] px-2 py-1"
                        value={line.reviewStatus}
                        onChange={(event) => updateLine(line, { reviewStatus: event.target.value as TenderLineItemReviewStatus })}
                      >
                        {reviewStatuses.map((status) => <option key={status}>{status}</option>)}
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex flex-wrap gap-2 rounded-lg border border-[color:var(--tex-border)] bg-white p-5">
            <button type="button" className="tex-action-button" disabled={state === "saving"} onClick={approve}>
              Approve final intelligence
            </button>
            <button type="button" className="tex-action-button tex-action-button--secondary" disabled={state === "saving"} onClick={reject}>
              Reject analysis
            </button>
          </div>
        </>
      )}
    </section>
  );
}

function SummaryPanel({ title, rows }: { title: string; rows: TenderIntelligence["executiveSummary"] }) {
  return (
    <div className="rounded-lg border border-[color:var(--tex-border)] bg-white p-5">
      <h3 className="text-lg font-semibold">{title}</h3>
      <div className="mt-4 grid gap-3">
        {rows.map((row) => (
          <div key={`${row.label}-${row.value}`} className="border-t border-[color:var(--tex-border)] pt-3 first:border-t-0 first:pt-0">
            <p className="text-xs uppercase text-[color:var(--tex-text-muted)]">{row.label}</p>
            <p className="mt-1 text-sm">{display(row.value)}</p>
            {row.evidence.length ? (
              <p className="mt-1 text-xs text-[color:var(--tex-text-muted)]">
                {row.evidence.map((item) => `${item.sourceDocumentName ?? item.sourceDocumentId}${item.sourcePage ? ` p.${item.sourcePage}` : ""}`).join("; ")}
              </p>
            ) : null}
          </div>
        ))}
      </div>
    </div>
  );
}

