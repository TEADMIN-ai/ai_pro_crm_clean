"use client";

import { useState, type ReactNode } from "react";
import { authFetch } from "@/lib/client/authFetch";

type Evidence = { id: string; name: string; returnableCategory?: string; returnableSubtype?: string | null; status?: string; reviewStatus?: string | null };

export default function ReturnableEvidenceReview({ dealId, evidence }: { dealId: string; evidence: Evidence[] }) {
  const [items, setItems] = useState(evidence);
  const [error, setError] = useState<string | null>(null);
  async function review(documentId: string, status: "approved" | "rejected") {
    setError(null);
    const response = await authFetch("/api/deals/" + encodeURIComponent(dealId) + "/document-preparation/review", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ documentId, status }) });
    if (!response.ok) { setError("Review action failed."); return; }
    setItems((current) => current.map((item) => item.id === documentId ? { ...item, status, reviewStatus: status === "approved" ? "APPROVED" : "REJECTED" } : item));
  }
  if (items.length === 0) return null;
  return <EnterprisePanelShim title="Evidence review"><div className="grid gap-2">{items.map((item) => <div key={item.id} className="flex flex-wrap items-center justify-between gap-2 rounded border p-3"><span>{item.name} - {item.returnableCategory}{item.returnableSubtype ? " (" + item.returnableSubtype + ")" : ""}</span><span className="flex items-center gap-2"><span>{item.reviewStatus ?? item.status ?? "READY_FOR_REVIEW"}</span><button type="button" onClick={() => void review(item.id, "approved")} className="tex-action-button tex-action-button--secondary">Approve</button><button type="button" onClick={() => void review(item.id, "rejected")} className="tex-action-button tex-action-button--secondary">Reject</button></span></div>)}</div>{error ? <p className="mt-2 text-sm text-red-700">{error}</p> : null}</EnterprisePanelShim>;
}

function EnterprisePanelShim({ title, children }: { title: string; children: ReactNode }) {
  return <section className="tex-panel"><p className="tex-eyebrow">Governed review</p><h2 className="tex-panel__title">{title}</h2><div className="mt-3">{children}</div></section>;
}
