"use client";

import { ChangeEvent, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { canUpload } from "@/lib/auth/roleUtils";
import { uploadDealDocuments } from "@/lib/firebase/storage/uploadDealDocuments";
import { uploadReturnableEvidence } from "@/lib/firebase/storage/uploadReturnableEvidence";
import { getReturnableContext, SBD_SUBTYPES } from "@/lib/opportunities/returnableEvidence";

type Props = { dealId: string; contractorName?: string | null };

export default function UploadClient({ dealId, contractorName }: Props) {
  const router = useRouter();
  const params = useParams<{ dealId?: string | string[] }>();
  const searchParams = useSearchParams();
  const routeDealId = Array.isArray(params.dealId) ? params.dealId[0] : params.dealId;
  const resolvedDealId = decodeURIComponent(routeDealId ?? dealId);
  const returnable = getReturnableContext(searchParams.get("returnable"));
  const { user, role, loading } = useAuth();
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [subtype, setSubtype] = useState("");
  const [note, setNote] = useState("");

  if (loading) return <div style={{ padding: 40 }}>Loading...</div>;
  if (!user) return <div style={{ padding: 40 }}>You must be logged in to upload documents.</div>;
  if (!canUpload(role)) return <div style={{ padding: 40 }}>You do not have permission to upload documents.</div>;

  async function handleFileSelect(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setUploading(true); setMessage(null); setError(null);
    try {
      if (returnable) await uploadReturnableEvidence(resolvedDealId, file, { key: returnable.key, category: returnable.category, subtype: subtype || null, note: note.trim() || null });
      else await uploadDealDocuments(resolvedDealId, file, user.uid, role);
      setMessage(returnable ? "Upload successful. Evidence is ready for staff review." : "Upload successful.");
      event.target.value = "";
      router.push(returnable ? "/dashboard/deals/" + resolvedDealId + "/document-preparation?returnable=" + encodeURIComponent(returnable.key) : "/dashboard/deals/" + resolvedDealId);
    } catch (uploadError: unknown) {
      setError(uploadError instanceof Error ? uploadError.message : "Upload failed.");
    } finally { setUploading(false); }
  }

  return <div style={{ padding: 40, maxWidth: 640 }}>
    <h1>Upload Document</h1>
    <p style={{ opacity: 0.7, marginTop: 8 }}>Deal ID: {resolvedDealId}</p>
    {returnable ? <section style={{ marginTop: 16, padding: 16, border: "1px solid #cbd5e1", borderRadius: 8 }}>
      <strong>Returnable category: {returnable.label}</strong>
      <p style={{ marginTop: 8 }}>Deal: {resolvedDealId}</p><p>Contractor: {contractorName ?? "No assigned contractor"}</p><p>Required status: {returnable.required ? "Required" : "Not applicable"}</p>
      {returnable.category === "SBD_FORMS" ? <label style={{ display: "grid", gap: 6, marginTop: 12 }}>SBD form subtype<select value={subtype} onChange={(event) => setSubtype(event.target.value)} disabled={uploading}><option value="">Select if known</option>{SBD_SUBTYPES.map((option) => <option key={option} value={option}>{option}</option>)}</select></label> : null}
      <label style={{ display: "grid", gap: 6, marginTop: 12 }}>Note (optional)<textarea value={note} onChange={(event) => setNote(event.target.value)} disabled={uploading} rows={3} /></label>
    </section> : null}
    <div style={{ marginTop: 20 }}><label style={{ background: "#1e293b", color: "#fff", padding: "10px 16px", borderRadius: 8, cursor: uploading ? "not-allowed" : "pointer", display: "inline-block", fontWeight: 500, opacity: uploading ? 0.65 : 1 }}>{uploading ? "Uploading..." : "Choose PDF"}<input type="file" accept="application/pdf" disabled={uploading} onChange={handleFileSelect} style={{ display: "none" }} /></label></div>
    {message && <p style={{ color: "#16a34a", marginTop: 16 }}>{message}</p>}{error && <p style={{ color: "#dc2626", marginTop: 16 }}>{error}</p>}
    <div style={{ marginTop: 20 }}><button type="button" onClick={() => router.push(returnable ? "/dashboard/deals/" + resolvedDealId + "/document-preparation?returnable=" + encodeURIComponent(returnable.key) : "/dashboard/deals/" + resolvedDealId)} style={{ border: "none", padding: "10px 14px", borderRadius: 8, background: "#2563eb", color: "white", cursor: "pointer" }}>{returnable ? "Back To Document Preparation" : "Back To Deal"}</button></div>
  </div>;
}
