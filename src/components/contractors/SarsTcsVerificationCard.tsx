"use client";

import { useEffect, useState } from "react";
import { authFetch } from "@/lib/client/authFetch";

type Rec={pinMasked?:string|null;pinStatus?:string|null;taxReferenceNumber?:string|null;registeredTaxpayerName?:string|null;verificationStatus?:string|null;source?:string|null;verifiedAt?:string|null;verifiedByName?:string|null;recheckDueAt?:string|null;contractorIdentityMatch?:string|null;verificationEvidenceDocumentId?:string|null;verificationEvidenceHash?:string|null;evidenceStoragePath?:string|null};
type Payload={record:Rec|null;projection:{taxDocumentStatus:string;sarsVerificationStatus:string;sarsVerifiedAt:string|null;sarsRecheckDueAt:string|null;sarsIdentityMatch:string;sarsVerificationBlockers:string[];evidenceAvailable:boolean};officialLinks:{soqs:string}};
function fmt(v?:string|null){if(!v)return "Not recorded";const d=new Date(v);return Number.isNaN(d.getTime())?"Not recorded":d.toLocaleString("en-ZA",{year:"numeric",month:"short",day:"numeric",hour:"2-digit",minute:"2-digit"});}
function cls(v?:string|null){const s=String(v??"").toUpperCase();if(s==="VERIFIED_COMPLIANT"||s==="MATCH"||s==="ACTIVE")return "border-emerald-200 bg-emerald-50 text-emerald-800";if(s.includes("MISMATCH")||s.includes("INVALID")||s.includes("EXPIRED")||s.includes("NON_COMPLIANT"))return "border-rose-200 bg-rose-50 text-rose-800";if(s.includes("PENDING")||s.includes("REVIEW")||s.includes("PROVIDED"))return "border-amber-200 bg-amber-50 text-amber-800";return "border-slate-200 bg-slate-50 text-slate-700";}
function Field(p:{label:string;value:string}){return <div className="rounded-lg border border-slate-100 bg-slate-50 px-3 py-2"><p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">{p.label}</p><p className="mt-1 break-words text-sm font-semibold text-slate-900">{p.value||"Not recorded"}</p></div>}
export default function SarsTcsVerificationCard({ contractorId, canManage }: { contractorId: string; canManage: boolean }) {
  const [payload, setPayload] = useState<Payload | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function load() {
    setLoading(true);
    setError(null);
    try {
      const response = await authFetch(`/api/contractors/${encodeURIComponent(contractorId)}/sars-tcs`, { cache: "no-store" });
      const data = await response.json().catch(() => null) as (Payload & { error?: string }) | null;
      if (!response.ok) throw new Error(data?.error ?? "Unable to load SARS TCS verification.");
      setPayload(data);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Unable to load SARS TCS verification.");
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { void load(); }, [contractorId]);
  async function post(body: Record<string, unknown>) {
    setSaving(true);
    setError(null);
    try {
      const response = await authFetch(`/api/contractors/${encodeURIComponent(contractorId)}/sars-tcs`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const data = await response.json().catch(() => null) as { error?: string } | null;
      if (!response.ok) throw new Error(data?.error ?? "Unable to update SARS TCS verification.");
      await load();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Unable to update SARS TCS verification.");
    } finally {
      setSaving(false);
    }
  }
  async function capturePin() {
    const tcsPin = window.prompt("Enter the contractor-provided SARS TCS PIN");
    if (!tcsPin?.trim()) return;
    await post({ action: "provide_pin", tcsPin, taxReferenceNumber: window.prompt("Tax reference number") ?? "", registeredTaxpayerName: window.prompt("Registered taxpayer name") ?? "", consentConfirmed: true });
  }
  async function recordResult(verificationStatus: string) {
    await post({ action: "record_verification", verificationStatus, source: "SARS_SOQS", verifiedAt: new Date().toISOString(), taxpayerNameMatch: verificationStatus === "DETAILS_MISMATCH" ? "MISMATCH" : "MATCH", taxReferenceMatch: verificationStatus === "DETAILS_MISMATCH" ? "MISMATCH" : "MATCH", registrationNumberMatch: "NOT_APPLICABLE", contractorIdentityMatch: verificationStatus === "DETAILS_MISMATCH" ? "MISMATCH" : "MATCH", mismatchReasons: verificationStatus === "DETAILS_MISMATCH" ? ["Staff marked SARS details mismatch"] : [], verificationReference: window.prompt("Optional SARS verification reference") ?? "", notes: window.prompt("Verification notes") ?? "" });
  }
  const record = payload?.record ?? null;
  const projection = payload?.projection;
  const evidenceAvailable = Boolean(projection?.evidenceAvailable || record?.verificationEvidenceDocumentId || record?.verificationEvidenceHash || record?.evidenceStoragePath);
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div><h2 className="text-lg font-semibold text-slate-950">SARS Tax Compliance Verification</h2><p className="mt-1 text-sm text-slate-600">Official live verification is captured separately from uploaded tax documents.</p></div>
        <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${cls(projection?.sarsVerificationStatus)}`}>{projection?.sarsVerificationStatus ?? "NOT_STARTED"}</span>
      </div>
      {loading ? <p className="mt-4 text-sm text-slate-600">Loading SARS verification...</p> : null}
      {error ? <p className="mt-4 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">{error}</p> : null}
      <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        <Field label="Uploaded TCS document" value={projection?.taxDocumentStatus ?? "Unknown"} />
        <Field label="Extracted tax reference" value={record?.taxReferenceNumber ?? "Not recorded"} />
        <Field label="Extracted TCS PIN status" value={record?.pinStatus ?? "NOT_PROVIDED"} />
        <Field label="Masked PIN" value={record?.pinMasked ?? "Not provided"} />
        <Field label="Current live SARS verification status" value={projection?.sarsVerificationStatus ?? "NOT_STARTED"} />
        <Field label="Identity match status" value={projection?.sarsIdentityMatch ?? record?.contractorIdentityMatch ?? "NOT_CHECKED"} />
        <Field label="Verified date and time" value={fmt(projection?.sarsVerifiedAt ?? record?.verifiedAt)} />
        <Field label="Verified by" value={record?.verifiedByName ?? "Not recorded"} />
        <Field label="Verification source" value={record?.source ?? "Not recorded"} />
        <Field label="Recheck due date" value={fmt(projection?.sarsRecheckDueAt ?? record?.recheckDueAt)} />
        <Field label="Evidence availability" value={evidenceAvailable ? "Available" : "Not attached"} />
        <Field label="Taxpayer name" value={record?.registeredTaxpayerName ?? "Not recorded"} />
      </div>
      {projection?.sarsVerificationBlockers?.length ? <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">{projection.sarsVerificationBlockers.join("; ")}</div> : null}
      <div className="mt-5 flex flex-wrap gap-2">
        <button type="button" onClick={capturePin} disabled={saving} className="rounded-lg border border-sky-200 bg-sky-50 px-3 py-2 text-xs font-semibold text-sky-700 hover:bg-sky-100 disabled:opacity-60">Capture or replace TCS PIN</button>
        <button type="button" onClick={() => payload?.officialLinks?.soqs && window.open(payload.officialLinks.soqs, "_blank", "noopener,noreferrer")} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100">Open official SARS verification service</button>
        {canManage ? <button type="button" onClick={() => recordResult("VERIFIED_COMPLIANT")} disabled={saving || !record} className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-700 hover:bg-emerald-100 disabled:opacity-60">Record verification result</button> : null}
        {canManage ? <button type="button" onClick={() => recordResult("VERIFIED_NON_COMPLIANT")} disabled={saving || !record} className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700 hover:bg-rose-100 disabled:opacity-60">Record non-compliant result</button> : null}
        {canManage ? <button type="button" onClick={() => recordResult("DETAILS_MISMATCH")} disabled={saving || !record} className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-800 hover:bg-amber-100 disabled:opacity-60">Mark details mismatch</button> : null}
        {canManage ? <button type="button" onClick={() => post({ action: "request_updated_pin", reason: "Updated SARS TCS PIN required" })} disabled={saving} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-60">Request updated PIN</button> : null}
        {canManage ? <button type="button" onClick={() => recordResult("REVIEW_REQUIRED")} disabled={saving || !record} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-60">Recheck status</button> : null}
        {canManage ? <button type="button" onClick={() => window.prompt("Evidence document ID or hash") && recordResult(record?.verificationStatus ?? "REVIEW_REQUIRED")} disabled={saving || !record} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-60">Upload verification evidence</button> : null}
        {evidenceAvailable ? <button type="button" onClick={() => record?.evidenceStoragePath && window.open(record.evidenceStoragePath, "_blank", "noopener,noreferrer")} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100">View evidence</button> : null}
      </div>
    </div>
  );
}
