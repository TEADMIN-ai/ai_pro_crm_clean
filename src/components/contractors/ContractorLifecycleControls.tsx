"use client";

import { useState } from "react";
import { authFetch } from "@/lib/client/authFetch";

type DependencySummary = { linkedUserCount: number; linkedOpportunityCount: number; activeAssignmentCount: number; documentCount: number; tenderPackCount: number; submissionReviewCount: number; };
type Props = { contractorId: string; contractorName: string; status?: string | null; archived?: boolean; role?: string | null; onComplete: () => Promise<void> | void; };

export default function ContractorLifecycleControls({ contractorId, contractorName, status, archived, role, onComplete }: Props) {
  const [open, setOpen] = useState(false);
  const [summary, setSummary] = useState<DependencySummary | null>(null);
  const [reason, setReason] = useState("");
  const [replacementContractorId, setReplacementContractorId] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (role !== "admin") return null;

  async function openArchive() {
    setError(null); setOpen(true);
    const response = await authFetch(`/api/contractors/${encodeURIComponent(contractorId)}/archive`, { cache: "no-store" });
    const data = (await response.json()) as { dependencySummary?: DependencySummary; error?: string };
    if (!response.ok) { setError(data.error ?? "Unable to load dependency summary."); return; }
    setSummary(data.dependencySummary ?? null);
  }

  async function submit() {
    if (!reason.trim() || !confirmed || (!archived && !summary)) return;
    setBusy(true); setError(null);
    try {
      const endpoint = `/api/contractors/${encodeURIComponent(contractorId)}/${archived ? "restore" : "archive"}`;
      const response = await authFetch(endpoint, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(archived ? { reason: reason.trim() } : { reason: reason.trim(), replacementContractorId: replacementContractorId.trim() || null, confirmActiveAssignments: confirmed }) });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(data.error ?? "Contractor lifecycle update failed.");
      setOpen(false); await onComplete();
    } catch (submitError) { setError(submitError instanceof Error ? submitError.message : "Contractor lifecycle update failed."); }
    finally { setBusy(false); }
  }

  return (
    <>
      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-slate-200 bg-white p-4">
        {archived ? <span className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-800">Archived</span> : null}
        <button type="button" onClick={() => void (archived ? (setOpen(true), setSummary(null)) : openArchive())} className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50">{archived ? "Restore Contractor" : "Archive Contractor"}</button>
      </div>
      {open ? <div role="dialog" aria-modal="true" className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4">
        <section className="w-full max-w-lg rounded-xl bg-white p-6 shadow-xl">
          <h2 className="text-lg font-semibold text-slate-950">{archived ? "Restore Contractor" : "Archive Contractor"}</h2>
          <dl className="mt-4 grid grid-cols-2 gap-2 text-sm"><dt className="text-slate-500">Business</dt><dd className="font-medium">{contractorName}</dd><dt className="text-slate-500">Contractor ID</dt><dd className="break-all font-mono text-xs">{contractorId}</dd><dt className="text-slate-500">Current status</dt><dd>{status ?? "Not recorded"}</dd></dl>
          {!archived && summary ? <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700"><p>Linked users: {summary.linkedUserCount} Â· Opportunities/deals: {summary.linkedOpportunityCount}</p><p>Active assignments: {summary.activeAssignmentCount} Â· Documents: {summary.documentCount}</p><p>Tender packs: {summary.tenderPackCount} Â· Submission reviews: {summary.submissionReviewCount}</p>{summary.activeAssignmentCount > 0 ? <p className="mt-2 font-semibold text-amber-800">Active assignments remain and historical references will be preserved.</p> : null}</div> : null}
          <p className="mt-4 text-sm text-slate-600">{archived ? "Restoring does not validate identity, compliance or readiness." : "Historical records and documents remain readable. The contractor will leave active matching and assignment workflows."}</p>
          <label className="mt-4 block text-sm font-medium">Reason<textarea value={reason} onChange={(event) => setReason(event.target.value)} rows={3} className="mt-1 w-full rounded-lg border border-slate-300 p-2" required /></label>
          {!archived ? <label className="mt-3 block text-sm font-medium">Replacement contractor ID (optional)<input value={replacementContractorId} onChange={(event) => setReplacementContractorId(event.target.value)} placeholder="contractors/..." className="mt-1 w-full rounded-lg border border-slate-300 p-2" /></label> : null}
          <label className="mt-4 flex gap-2 text-sm"><input type="checkbox" checked={confirmed} onChange={(event) => setConfirmed(event.target.checked)} /> I confirm this deliberate lifecycle change.</label>
          {error ? <p className="mt-3 text-sm text-rose-700">{error}</p> : null}
          <div className="mt-5 flex justify-end gap-2"><button type="button" onClick={() => setOpen(false)} className="rounded-lg border border-slate-300 px-3 py-2 text-sm">Cancel</button><button type="button" disabled={busy || !reason.trim() || !confirmed || (!archived && !summary)} onClick={() => void submit()} className="rounded-lg bg-slate-900 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50">{busy ? "Saving..." : archived ? "Restore Contractor" : "Archive Contractor"}</button></div>
        </section>
      </div> : null}
    </>
  );
}
