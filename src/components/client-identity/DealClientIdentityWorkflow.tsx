"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { authFetch } from "@/lib/client/authFetch";

type Candidate = {
  canonicalId: string;
  displayName: string;
  verificationStatus: string;
  reviewStatus: string;
  status: string;
};

type ClientIdentity = {
  status: string;
  dealId: string;
  workspaceId: string | null;
  sourceReference: string | null;
  canonicalId: string | null;
  candidates: Candidate[];
  reason: string;
  nextAction: string;
};

type Props = {
  dealId: string;
};

type LoadState = "idle" | "loading" | "saving" | "error";

function badgeClass(value: string) {
  if (/VERIFIED|READY|RESOLVED/.test(value)) return "border-emerald-200 bg-emerald-50 text-emerald-800";
  if (/AMBIGUOUS|REJECTED|BLOCK|UNRESOLVED/.test(value)) return "border-red-200 bg-red-50 text-red-800";
  return "border-amber-200 bg-amber-50 text-amber-800";
}

function Badge({ value }: { value: string }) {
  return <span className={`rounded border px-2 py-1 text-xs font-semibold ${badgeClass(value)}`}>{value}</span>;
}

export default function DealClientIdentityWorkflow({ dealId }: Props) {
  const router = useRouter();
  const [identity, setIdentity] = useState<ClientIdentity | null>(null);
  const [state, setState] = useState<LoadState>("idle");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const selectedCandidate = useMemo(() => {
    if (!identity?.canonicalId) return identity?.candidates[0] ?? null;
    return identity.candidates.find((candidate) => candidate.canonicalId === identity.canonicalId) ?? identity.candidates[0] ?? null;
  }, [identity]);

  const load = useCallback(async () => {
    setState("loading");
    setError(null);
    const response = await authFetch(`/api/deals/${encodeURIComponent(dealId)}/client-identity`, { cache: "no-store" });
    const payload = await response.json().catch(() => null) as { clientIdentity?: ClientIdentity; error?: string } | null;
    if (!response.ok || !payload?.clientIdentity) {
      setState("error");
      setError(payload?.error ?? "Client identity workflow could not be loaded.");
      return;
    }
    setIdentity(payload.clientIdentity);
    setState("idle");
  }, [dealId]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void load();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  async function post(action: "create_candidate" | "link_verified", canonicalId?: string) {
    setState("saving");
    setError(null);
    setMessage(null);
    const response = await authFetch(`/api/deals/${encodeURIComponent(dealId)}/client-identity`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, canonicalId }),
    });
    const payload = await response.json().catch(() => null) as { error?: string } | null;
    if (!response.ok) {
      setState("error");
      setError(payload?.error ?? "Client identity action failed.");
      return;
    }
    setMessage(action === "create_candidate" ? "Client candidate created for review." : "Verified client linked to this opportunity.");
    await load();
    if (action === "link_verified") router.push(`/dashboard/deals/${encodeURIComponent(dealId)}/tender-pricing`);
  }

  async function verify(candidate: Candidate) {
    setState("saving");
    setError(null);
    setMessage(null);
    const response = await authFetch(`/api/master-data/client/${encodeURIComponent(candidate.canonicalId)}/verify`, {
      method: "POST",
    });
    const payload = await response.json().catch(() => null) as { error?: string } | null;
    if (!response.ok) {
      setState("error");
      setError(payload?.error ?? "Client verification failed.");
      return;
    }
    setMessage("Client verification recorded.");
    await load();
  }

  const busy = state === "loading" || state === "saving";
  const canCreateCandidate = identity && !identity.canonicalId && identity.candidates.length === 0 && identity.status === "CLIENT_REVIEW_REQUIRED";
  const canVerify = selectedCandidate && selectedCandidate.verificationStatus !== "VERIFIED" && selectedCandidate.status === "active";
  const canLink = selectedCandidate && selectedCandidate.verificationStatus === "VERIFIED" && selectedCandidate.reviewStatus === "READY_FOR_USE";

  return (
    <main className="tex-shell grid gap-6 p-4 md:p-6">
      <section className="rounded-lg border border-[color:var(--tex-border)] bg-white p-5">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="tex-eyebrow">Client Identity</p>
            <h1 className="tex-title mt-2">Verify Client Identity</h1>
            <p className="mt-2 text-sm text-[color:var(--tex-text-muted)]">Deal: {dealId}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge value={identity?.status ?? (state === "loading" ? "LOADING" : "UNKNOWN")} />
            {identity?.workspaceId ? <Badge value={identity.workspaceId} /> : null}
          </div>
        </div>
      </section>

      {error ? <p className="rounded-md border border-red-200 bg-red-50 p-3 text-sm font-semibold text-red-900">{error}</p> : null}
      {message ? <p className="rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm font-semibold text-emerald-800">{message}</p> : null}

      <section className="rounded-lg border border-[color:var(--tex-border)] bg-white p-5">
        <h2 className="text-lg font-semibold text-[color:var(--tex-text-strong)]">Extracted client evidence</h2>
        <dl className="mt-4 grid gap-3 text-sm md:grid-cols-3">
          <div>
            <dt className="tex-metric-label">Extracted issuer</dt>
            <dd className="mt-1 font-semibold">{identity?.sourceReference ?? "Not captured"}</dd>
          </div>
          <div>
            <dt className="tex-metric-label">Resolver reason</dt>
            <dd className="mt-1 font-semibold">{identity?.reason ?? "Loading"}</dd>
          </div>
          <div>
            <dt className="tex-metric-label">Next action</dt>
            <dd className="mt-1 font-semibold">{identity?.nextAction ?? "Load client identity"}</dd>
          </div>
        </dl>
      </section>

      <section className="rounded-lg border border-[color:var(--tex-border)] bg-white p-5">
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-[color:var(--tex-text-strong)]">Canonical client candidates</h2>
            <p className="mt-1 text-sm text-[color:var(--tex-text-muted)]">Safe matches are resolved by the server. Ambiguous matches remain blocked.</p>
          </div>
          <button type="button" disabled={busy || !canCreateCandidate} onClick={() => void post("create_candidate")} className="tex-action-button disabled:opacity-50">
            Create Client Candidate
          </button>
        </div>

        <div className="mt-4 grid gap-3">
          {identity?.candidates.length ? identity.candidates.map((candidate) => (
            <article key={candidate.canonicalId} className="rounded-md border border-slate-200 p-4">
              <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase text-slate-500">{candidate.canonicalId}</p>
                  <h3 className="mt-1 font-semibold text-slate-950">{candidate.displayName}</h3>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <Badge value={candidate.status} />
                    <Badge value={candidate.verificationStatus} />
                    <Badge value={candidate.reviewStatus} />
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button type="button" disabled={busy || !canVerify || candidate.canonicalId !== selectedCandidate?.canonicalId} onClick={() => void verify(candidate)} className="tex-action-button tex-action-button--secondary disabled:opacity-50">
                    Verify Client
                  </button>
                  <button type="button" disabled={busy || !canLink || candidate.canonicalId !== selectedCandidate?.canonicalId} onClick={() => void post("link_verified", candidate.canonicalId)} className="tex-action-button disabled:opacity-50">
                    Link Client to Opportunity
                  </button>
                </div>
              </div>
            </article>
          )) : <p className="rounded-md border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">No safe canonical client match exists yet.</p>}
        </div>
      </section>

      <div className="flex flex-wrap gap-2">
        <button type="button" disabled={busy} onClick={() => void load()} className="tex-action-button tex-action-button--secondary">Refresh</button>
        <button type="button" onClick={() => router.push(`/dashboard/deals/${encodeURIComponent(dealId)}/tender-pricing`)} className="tex-action-button tex-action-button--secondary">Back to Tender Pricing</button>
      </div>
    </main>
  );
}

