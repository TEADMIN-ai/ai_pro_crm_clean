"use client";

import { useState } from "react";
import { authFetch } from "@/lib/client/authFetch";

type UploadState = "idle" | "uploading" | "complete" | "error";

export default function BoqUploadWorkspace() {
  const [state, setState] = useState<UploadState>("idle");
  const [message, setMessage] = useState<string>("Upload a PDF, DOCX, XLSX, CSV or TXT BOQ document.");

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setState("uploading");
    setMessage("Uploading and extracting BOQ line items...");

    const formData = new FormData(event.currentTarget);
    const response = await authFetch("/api/qs/boq/upload", {
      method: "POST",
      body: formData,
    });
    const payload = (await response.json()) as { error?: string; document?: { itemCount?: number; reviewStatus?: string } };

    if (!response.ok) {
      setState("error");
      setMessage(payload.error ?? "BOQ upload failed.");
      return;
    }

    setState("complete");
    setMessage(`Extraction complete. ${payload.document?.itemCount ?? 0} line items prepared for ${payload.document?.reviewStatus ?? "review"}.`);
    event.currentTarget.reset();
  }

  return (
    <div className="p-6 text-white">
      <div className="max-w-4xl space-y-6">
        <header>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-200">BOQ Upload</p>
          <h1 className="mt-3 text-2xl font-semibold">Document Ingestion Workflow</h1>
          <p className="mt-2 text-sm text-slate-400">
            Upload BOQs, RFQs, or Scopes of Work for extraction, trade classification, unit normalization,
            material matching, and review queue preparation. No pricing is calculated.
          </p>
        </header>

        <form onSubmit={handleSubmit} className="rounded-lg border border-white/10 bg-white/[0.03] p-5">
          <div className="grid gap-4 md:grid-cols-2">
            <label className="text-sm text-slate-300">
              Project Name
              <input name="projectName" className="mt-2 w-full rounded-lg border border-white/10 bg-slate-950/60 px-3 py-2 text-sm text-white" placeholder="School upgrade BOQ" />
            </label>
            <label className="text-sm text-slate-300">
              Document Type
              <select name="documentType" className="mt-2 w-full rounded-lg border border-white/10 bg-slate-950/60 px-3 py-2 text-sm text-white" defaultValue="boq">
                <option value="boq">BOQ</option>
                <option value="rfq">RFQ</option>
                <option value="scopeOfWork">Scope of Work</option>
              </select>
            </label>
            <label className="text-sm text-slate-300 md:col-span-2">
              Document
              <input name="file" required type="file" accept=".pdf,.docx,.xlsx,.csv,.txt" className="mt-2 w-full rounded-lg border border-dashed border-white/15 bg-slate-950/60 px-3 py-8 text-sm text-slate-300" />
            </label>
          </div>
          <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className={`text-sm ${state === "error" ? "text-rose-200" : state === "complete" ? "text-emerald-200" : "text-slate-400"}`}>{message}</p>
            <button disabled={state === "uploading"} className="rounded-lg border border-cyan-400/20 bg-cyan-400/10 px-4 py-2 text-sm font-semibold text-cyan-100 disabled:opacity-60">
              {state === "uploading" ? "Extracting..." : "Upload and Extract"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
