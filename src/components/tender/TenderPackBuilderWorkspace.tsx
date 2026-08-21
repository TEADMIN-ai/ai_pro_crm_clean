"use client";

import { useCallback, useEffect, useState } from "react";
import { EnterpriseActionButton, EnterpriseCard, EnterpriseEmptyState, EnterprisePanel, EnterpriseStatusBadge } from "@/components/ui/EnterpriseUI";
import type { TenderPackWorkspaceState } from "@/server/services/tenderPackWorkspaceService";

type Props = { dealId?: string; requestId?: string };
type Result = { packId?: string; tenderPackDocumentId?: string; error?: string; message?: string };

function text(value: string | null | undefined, fallback = "Pending") { return value && value.trim() ? value : fallback; }
function tone(status: string) { return status === "READY" ? "success" : "warning"; }

export default function TenderPackBuilderWorkspace({ dealId, requestId }: Props) {
  const [state, setState] = useState<TenderPackWorkspaceState | null>(null);
  const [loading, setLoading] = useState(Boolean(dealId));
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const [generating, setGenerating] = useState(false);

  const loadState = useCallback(async () => {
    if (!dealId) return;
    setLoading(true);
    setError(null);
    const response = await fetch("/api/tender-pack/workspace?dealId=" + encodeURIComponent(dealId), { cache: "no-store" });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(typeof payload.error === "string" ? payload.error : "Tender Pack workspace unavailable");
    setState(payload as TenderPackWorkspaceState);
    setLoading(false);
  }, [dealId]);

  useEffect(() => {
    if (!dealId) return;
    let cancelled = false;
    const timer = window.setTimeout(() => {
      loadState().catch((loadError) => {
        if (cancelled) return;
        setState(null);
        setError(loadError instanceof Error ? loadError.message : "Tender Pack workspace unavailable");
        setLoading(false);
      });
    }, 0);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [dealId, loadState]);

  async function generate() {
    if (!state?.generationPayload) return;
    setGenerating(true);
    setError(null);
    setResult(null);
    try {
      const response = await fetch(state.generationEndpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...state.generationPayload, ...(requestId ? { requestId } : {}) }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(typeof payload.message === "string" ? payload.message : typeof payload.error === "string" ? payload.error : "Tender Pack generation failed");
      setResult(payload as Result);
      await loadState();
    } catch (generationError) {
      setError(generationError instanceof Error ? generationError.message : "Tender Pack generation failed");
    } finally {
      setGenerating(false);
    }
  }

  if (!dealId) {
    return (
      <main data-module="dashboard" className="tex-shell grid gap-6">
        <EnterpriseCard className="p-6">
          <p className="tex-eyebrow">Tender Pack Builder</p>
          <h1 className="tex-title mt-3">Tender Pack Builder</h1>
          <p className="tex-copy mt-3 text-sm">No deal context is connected. Open this workspace from a governed opportunity execution action.</p>
          <div className="mt-4"><EnterpriseStatusBadge value="No deal context" tone="neutral" /></div>
        </EnterpriseCard>
        <EnterpriseEmptyState title="No tender pack data is connected." detail="Open a deal-scoped Tender Pack workspace before generating documents or submission progress." />
      </main>
    );
  }

  if (loading) return <main data-module="dashboard" className="tex-shell"><EnterpriseCard className="p-6">Loading Tender Pack workspace for {dealId}</EnterpriseCard></main>;

  if (error && !state) {
    return (
      <main data-module="dashboard" className="tex-shell grid gap-6">
        <EnterpriseCard className="p-6"><p className="tex-eyebrow">Tender Pack Builder</p><h1 className="tex-title mt-3">Tender Pack workspace unavailable</h1><p className="tex-copy mt-3 text-sm">Deal: {dealId}</p></EnterpriseCard>
        <EnterpriseEmptyState title="Workspace could not be loaded" detail={error} />
      </main>
    );
  }

  if (!state) return null;

  return (
    <main data-module="dashboard" className="tex-shell grid gap-6">
      <EnterpriseCard className="p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div><p className="tex-eyebrow">Tender Pack Builder</p><h1 className="tex-title mt-3">Deal-scoped Tender Pack</h1><p className="tex-copy mt-3 text-sm">Opportunity: {state.dealTitle ?? state.dealId}</p><p className="tex-copy mt-1 text-sm">Workspace: {text(state.workspaceId)}</p></div>
          <div className="flex flex-wrap gap-2"><EnterpriseStatusBadge value={state.durableReady ? "Durable Tender Pack ready" : "Durable Tender Pack required"} tone={state.durableReady ? "success" : "warning"} /><EnterpriseStatusBadge value={state.contractor.name ?? state.contractor.contractorId ?? "Contractor pending"} tone={state.contractor.contractorId ? "success" : "danger"} /></div>
        </div>
      </EnterpriseCard>

      <EnterprisePanel eyebrow="Generation authority" title="Governed Tender Pack generation" action={<EnterpriseActionButton variant="success" disabled={!state.canGenerate || generating} onClick={generate}>{generating ? "Generating..." : "Generate Tender Pack"}</EnterpriseActionButton>}>
        <div className="grid gap-3 md:grid-cols-3"><p><strong>Deal:</strong> {state.dealId}</p><p><strong>Client Quote:</strong> {state.clientQuote?.clientQuoteId ?? "Missing"}</p><p><strong>TENDER_PACK document:</strong> {state.tenderPackDocument?.documentId ?? "Not generated"}</p></div>
        {error ? <p className="mt-4 text-sm font-semibold text-red-800">{error}</p> : null}
        {result ? <p className="mt-4 text-sm font-semibold text-[color:var(--tex-text-strong)]">Generation completed. Pack ID: {result.packId ?? "Pending"}. Document ID: {result.tenderPackDocumentId ?? "Pending"}.</p> : null}
      </EnterprisePanel>

      <EnterprisePanel eyebrow="Prerequisites" title="Current governed state">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{state.prerequisites.map((item) => <article key={item.key} className="rounded border border-[color:var(--tex-border)] p-4"><div className="flex items-center justify-between gap-3"><p className="text-sm font-semibold text-[color:var(--tex-text-strong)]">{item.label}</p><EnterpriseStatusBadge value={item.status} tone={tone(item.status)} /></div><p className="mt-2 text-sm text-[color:var(--tex-text-muted)]">{item.detail}</p></article>)}</div>
        {state.blockers.length ? <p className="mt-4 text-sm font-semibold text-red-800">Next action: {state.blockers[0]}</p> : null}
      </EnterprisePanel>

      <EnterprisePanel eyebrow="Durable records" title="Persisted Tender Pack authority">
        <div className="grid gap-4 lg:grid-cols-2"><section><p className="font-semibold">Tender Packs</p>{state.tenderPacks.length ? state.tenderPacks.map((pack) => <p key={pack.packId} className="mt-2 text-sm">{pack.packId} - {pack.governanceMode ?? "Unknown"}</p>) : <p className="mt-2 text-sm text-[color:var(--tex-text-muted)]">No Tender Pack has been persisted for this deal yet.</p>}</section><section><p className="font-semibold">Master Document</p>{state.tenderPackDocument ? <p className="mt-2 text-sm">{state.tenderPackDocument.documentId} - {state.tenderPackDocument.verificationStatus} - {state.tenderPackDocument.status}</p> : <p className="mt-2 text-sm text-[color:var(--tex-text-muted)]">No active VERIFIED TENDER_PACK master document is linked to this opportunity.</p>}</section></div>
      </EnterprisePanel>
    </main>
  );
}
