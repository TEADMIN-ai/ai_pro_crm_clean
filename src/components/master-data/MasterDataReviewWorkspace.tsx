"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Badge from "@/components/ui/Badge";
import { authFetch } from "@/lib/client/authFetch";
import type { MasterDataDuplicateCandidate, MasterDataReviewQueueKey, MasterDataReviewQueueSummary, MasterDataReviewRecord } from "@/lib/master-data/reviewWorkflow";
import type { CanonicalItem, CanonicalSupplier } from "@/types/masterData";

const QUEUES: Array<{ key: MasterDataReviewQueueKey; label: string }> = [
  { key: "pendingSuppliers", label: "Pending Suppliers" },
  { key: "duplicateCandidates", label: "Duplicate Candidates" },
  { key: "pendingItems", label: "Pending Items" },
  { key: "pendingClientsSites", label: "Pending Clients/Sites" },
  { key: "evidenceReview", label: "Evidence Review" },
  { key: "rejectedArchived", label: "Rejected / Archived" },
];

type ActionState = { pending: boolean; message: string | null; error: string | null };

export default function MasterDataReviewWorkspace({ workspaceId }: { workspaceId: string }) {
  const [summary, setSummary] = useState<MasterDataReviewQueueSummary | null>(null);
  const [queue, setQueue] = useState<MasterDataReviewQueueKey>("pendingSuppliers");
  const [search, setSearch] = useState("");
  const [action, setAction] = useState<ActionState>({ pending: false, message: null, error: null });

  const load = useCallback(async () => {
    const response = await authFetch(`/api/master-data/review?workspaceId=${encodeURIComponent(workspaceId)}`, { cache: "no-store" });
    const payload = await response.json().catch(() => null) as MasterDataReviewQueueSummary | { error?: string } | null;
    if (!response.ok || !isReviewQueueSummary(payload)) {
      const errorPayload = payload && typeof payload === "object" && "error" in payload ? payload as { error?: string } : null;
      setAction({ pending: false, message: null, error: errorPayload?.error ?? "Master Data review queue could not be loaded." });
      return;
    }
    setSummary(payload);
  }, [workspaceId]);

  useEffect(() => {
    void Promise.resolve().then(load);
  }, [load]);

  const visibleRecords = useMemo(() => {
    const term = search.trim().toLowerCase();
    return (summary?.records ?? []).filter((record) => {
      if (queue !== "duplicateCandidates" && record.queue !== queue) return false;
      if (!term) return true;
      return [
        record.entity.canonicalId,
        record.entity.displayName,
        record.entity.legalName,
        record.entity.tradingName,
        record.linkedSourceId,
        ...record.linkedQuoteIds,
        ...record.linkedDocumentIds,
      ].filter(Boolean).some((value) => String(value).toLowerCase().includes(term));
    });
  }, [queue, search, summary]);

  async function runEntityAction(record: MasterDataReviewRecord, kind: "verify" | "reject" | "archive" | "review_required") {
    setAction({ pending: true, message: null, error: null });
    const endpoint = kind === "review_required"
      ? `/api/master-data/${record.entity.entityType}/${encodeURIComponent(record.entity.canonicalId)}`
      : `/api/master-data/${record.entity.entityType}/${encodeURIComponent(record.entity.canonicalId)}/${kind}`;
    const response = await authFetch(endpoint, {
      method: kind === "review_required" ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: kind === "review_required" ? JSON.stringify({ reviewStatus: "REVIEW_REQUIRED", verificationStatus: "PENDING_REVIEW" }) : undefined,
    });
    const payload = await response.json().catch(() => null) as { error?: string } | null;
    if (!response.ok) {
      setAction({ pending: false, message: null, error: payload?.error ?? "Review action failed." });
      return;
    }
    setAction({ pending: false, message: "Review action recorded.", error: null });
    await load();
  }

  async function resolveDuplicate(duplicate: MasterDataDuplicateCandidate, outcome: "same_entity" | "different_entities" | "review_required", survivorId?: string) {
    setAction({ pending: true, message: null, error: null });
    const response = await authFetch("/api/master-data/duplicates/resolve", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        workspaceId,
        entityType: duplicate.entityType,
        candidateAId: duplicate.candidateAId,
        candidateBId: duplicate.candidateBId,
        canonicalSurvivorId: survivorId ?? null,
        outcome,
        reason: outcome === "same_entity" ? "Staff confirmed same canonical entity from review workflow." : outcome === "different_entities" ? "Staff confirmed separate entities from review workflow." : "Staff requires more evidence before duplicate resolution.",
      }),
    });
    const payload = await response.json().catch(() => null) as { error?: string } | null;
    if (!response.ok) {
      setAction({ pending: false, message: null, error: payload?.error ?? "Duplicate resolution failed." });
      return;
    }
    setAction({ pending: false, message: "Duplicate resolution recorded.", error: null });
    await load();
  }

  return (
    <main className="tex-shell grid gap-5">
      <section className="grid gap-4 border-b border-slate-200 pb-5">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="tex-eyebrow">Master Data</p>
            <h1 className="tex-title mt-2">Review Workflow</h1>
          </div>
          <Badge tone="info">API backed</Badge>
        </div>
        <div className="grid gap-3 md:grid-cols-6">
          {QUEUES.map((item) => (
            <button
              key={item.key}
              type="button"
              onClick={() => setQueue(item.key)}
              className={`rounded-md border px-3 py-3 text-left text-sm font-semibold ${queue === item.key ? "border-sky-400 bg-sky-50 text-sky-900" : "border-slate-200 bg-white text-slate-700"}`}
            >
              <span className="block text-xs uppercase text-slate-500">{item.label}</span>
              <span className="mt-1 block text-xl">{summary?.counts[item.key] ?? 0}</span>
            </button>
          ))}
        </div>
        <input
          className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm"
          value={search}
          onChange={(event) => setSearch(event.currentTarget.value)}
          placeholder="Search by ID, name, quote, document, or source"
        />
        {action.error ? <p className="rounded-md border border-rose-200 bg-rose-50 p-3 text-sm font-semibold text-rose-700">{action.error}</p> : null}
        {action.message ? <p className="rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm font-semibold text-emerald-700">{action.message}</p> : null}
      </section>

      {queue === "duplicateCandidates" ? (
        <DuplicateQueue duplicates={summary?.duplicateCandidates ?? []} pending={action.pending} onResolve={resolveDuplicate} />
      ) : (
        <section className="grid gap-3">
          {visibleRecords.map((record) => (
            <ReviewRecordCard key={`${record.entity.entityType}:${record.entity.canonicalId}`} record={record} pending={action.pending} onAction={runEntityAction} />
          ))}
          {!visibleRecords.length ? <p className="rounded-md border border-slate-200 bg-white p-6 text-sm text-slate-600">No records in this queue.</p> : null}
        </section>
      )}
    </main>
  );
}

function isReviewQueueSummary(value: unknown): value is MasterDataReviewQueueSummary {
  return Boolean(value && typeof value === "object" && "counts" in value && "records" in value && "duplicateCandidates" in value);
}

function ReviewRecordCard({ record, pending, onAction }: {
  record: MasterDataReviewRecord;
  pending: boolean;
  onAction: (record: MasterDataReviewRecord, kind: "verify" | "reject" | "archive" | "review_required") => Promise<void>;
}) {
  const supplier = record.entity.entityType === "supplier" ? record.entity as CanonicalSupplier : null;
  const item = record.entity.entityType === "item" ? record.entity as CanonicalItem : null;
  return (
    <article className="grid gap-4 rounded-md border border-slate-200 bg-white p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase text-slate-500">{record.entity.entityType} · {record.entity.canonicalId}</p>
          <h2 className="mt-1 text-lg font-semibold text-slate-950">{record.entity.displayName}</h2>
          <p className="mt-1 text-sm text-slate-600">{record.entity.legalName ?? record.entity.tradingName ?? "No legal/trading name captured"}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Badge tone={record.entity.verificationStatus === "VERIFIED" ? "success" : record.entity.verificationStatus === "REJECTED" ? "danger" : "warning"}>{record.entity.verificationStatus}</Badge>
          <Badge tone="info">{record.entity.provenance}</Badge>
          <Badge tone={record.evidenceStatus === "present" ? "success" : record.evidenceStatus === "expired" || record.evidenceStatus === "historical_only" ? "warning" : "danger"}>{record.evidenceStatus}</Badge>
        </div>
      </div>
      <dl className="grid gap-3 text-sm md:grid-cols-4">
        <Detail label="Workspace" value={record.entity.workspaceId} />
        <Detail label="Created" value={`${record.entity.createdBy} · ${record.entity.createdAt}`} />
        <Detail label="Source" value={record.linkedSourceId ?? "-"} />
        <Detail label="Pricing eligibility" value={record.currentPricingEligibility} />
        {supplier ? <Detail label="Registration" value={supplier.registrationNumber ?? "-"} /> : null}
        {supplier ? <Detail label="VAT" value={supplier.vatNumber ?? "-"} /> : null}
        {supplier ? <Detail label="Contact" value={[supplier.contactPerson, supplier.email, supplier.phone].filter(Boolean).join(" · ") || "-"} /> : null}
        {item ? <Detail label="Item identity" value={`${item.itemCode} · ${item.unit}`} /> : null}
      </dl>
      <div className="grid gap-2 text-sm">
        <p className="font-semibold text-slate-800">Evidence</p>
        {record.evidenceReferences.length ? record.evidenceReferences.map((evidence, index) => (
          <div key={`${evidence.documentId ?? evidence.sourcePath ?? index}`} className="rounded-md border border-slate-100 bg-slate-50 p-3">
            <p className="font-medium text-slate-900">{evidence.documentId ?? evidence.filename ?? "Evidence reference"}</p>
            <p className="text-slate-600">{evidence.sourcePath ?? evidence.storagePath ?? "Path not captured"}</p>
            <p className="text-xs text-slate-500">Issue {evidence.issueDate ?? "-"} · Expiry {evidence.expiryDate ?? "-"}</p>
          </div>
        )) : <p className="text-slate-600">No evidence linked.</p>}
      </div>
      {record.duplicateWarnings.length ? <Badge tone="warning">{record.duplicateWarnings.length} duplicate warning(s)</Badge> : null}
      <div className="flex flex-wrap gap-2">
        <button disabled={pending} onClick={() => void onAction(record, "verify")} className="rounded-md bg-emerald-600 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50">Verify</button>
        <button disabled={pending} onClick={() => void onAction(record, "reject")} className="rounded-md bg-rose-600 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50">Reject</button>
        <button disabled={pending} onClick={() => void onAction(record, "archive")} className="rounded-md border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 disabled:opacity-50">Archive</button>
        <button disabled={pending} onClick={() => void onAction(record, "review_required")} className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-800 disabled:opacity-50">Mark Review Required</button>
      </div>
    </article>
  );
}

function DuplicateQueue({ duplicates, pending, onResolve }: {
  duplicates: MasterDataDuplicateCandidate[];
  pending: boolean;
  onResolve: (duplicate: MasterDataDuplicateCandidate, outcome: "same_entity" | "different_entities" | "review_required", survivorId?: string) => Promise<void>;
}) {
  return (
    <section className="grid gap-3">
      {duplicates.map((duplicate) => (
        <article key={`${duplicate.entityType}:${duplicate.candidateAId}:${duplicate.candidateBId}`} className="grid gap-4 rounded-md border border-amber-200 bg-white p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase text-amber-700">{duplicate.entityType} duplicate candidate</p>
              <h2 className="mt-1 text-lg font-semibold text-slate-950">{duplicate.candidateAId} ↔ {duplicate.candidateBId}</h2>
            </div>
            <Badge tone="warning">{duplicate.matchingAttributes.join(", ")}</Badge>
          </div>
          <div className="grid gap-3 text-sm md:grid-cols-2">
            <Detail label="Candidate A" value={`${duplicate.candidateAId} · ${duplicate.provenanceA} · ${duplicate.verificationStatusA}`} />
            <Detail label="Candidate B" value={`${duplicate.candidateBId} · ${duplicate.provenanceB} · ${duplicate.verificationStatusB}`} />
            <Detail label="Conflicts" value={duplicate.conflictingFields.join(", ") || "-"} />
            <Detail label="Evidence" value={`${duplicate.evidenceA.length} / ${duplicate.evidenceB.length} references`} />
          </div>
          <div className="flex flex-wrap gap-2">
            <button disabled={pending} onClick={() => void onResolve(duplicate, "same_entity", duplicate.candidateAId)} className="rounded-md bg-sky-700 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50">Same: keep A</button>
            <button disabled={pending} onClick={() => void onResolve(duplicate, "same_entity", duplicate.candidateBId)} className="rounded-md bg-sky-700 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50">Same: keep B</button>
            <button disabled={pending} onClick={() => void onResolve(duplicate, "different_entities")} className="rounded-md border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 disabled:opacity-50">Not Duplicate</button>
            <button disabled={pending} onClick={() => void onResolve(duplicate, "review_required")} className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-800 disabled:opacity-50">Needs Evidence</button>
          </div>
        </article>
      ))}
      {!duplicates.length ? <p className="rounded-md border border-slate-200 bg-white p-6 text-sm text-slate-600">No duplicate candidates in this workspace.</p> : null}
    </section>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs font-semibold uppercase text-slate-500">{label}</dt>
      <dd className="mt-1 break-words text-slate-800">{value}</dd>
    </div>
  );
}
