"use client";

import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { authFetch } from "@/lib/client/authFetch";
import { API_ROUTES } from "@/lib/apiRoutes";
import type { TenderPackRequest, TenderPackRequestStatus } from "@/types/tenderPackRequest";

type Props = {
  contractorId?: string;
  mode: "contractor" | "review";
};

const STATUS_LABELS: Record<TenderPackRequestStatus, string> = {
  pending: "Pending",
  under_review: "Under Review",
  approved: "Approved",
  generated: "Generated",
  rejected: "Rejected",
};

function formatDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Not recorded" : date.toLocaleString("en-ZA");
}

function getDownloadUrl(request: TenderPackRequest) {
  return request.downloadURL?.trim() ?? "";
}

export default function TenderPackRequestPanel({ contractorId, mode }: Props) {
  const { role } = useAuth();
  const [requests, setRequests] = useState<TenderPackRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dealId, setDealId] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);

  const contractorMode = mode === "contractor";
  const canGenerate = role === "admin";

  async function loadRequests() {
    const response = await authFetch(API_ROUTES.TENDER_PACK_REQUESTS, {
      cache: "no-store",
    });
    const data = (await response.json()) as { requests?: TenderPackRequest[]; error?: string };
    if (!response.ok) {
      throw new Error(data.error ?? "Failed to load tender pack requests");
    }
    setRequests(Array.isArray(data.requests) ? data.requests : []);
  }

  useEffect(() => {
    let cancelled = false;
    loadRequests()
      .catch((loadError) => {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : "Failed to load tender pack requests");
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const visibleRequests = useMemo(() => {
    if (!contractorId) {
      return requests;
    }
    return requests.filter((request) => request.contractorId === contractorId);
  }, [contractorId, requests]);

  async function createRequest() {
    if (!contractorId) {
      setError("Missing contractor profile for this account.");
      return;
    }

    try {
      setSaving(true);
      setError(null);
      const response = await authFetch(API_ROUTES.TENDER_PACK_REQUESTS, {
        method: "POST",
        body: JSON.stringify({
          contractorId,
          dealId: dealId.trim() || null,
          note: note.trim() || null,
        }),
      });
      const data = (await response.json()) as { request?: TenderPackRequest; error?: string };
      if (!response.ok || !data.request) {
        throw new Error(data.error ?? "Failed to request tender pack");
      }
      setDealId("");
      setNote("");
      await loadRequests();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Failed to request tender pack");
    } finally {
      setSaving(false);
    }
  }

  async function updateStatus(requestId: string, status: Exclude<TenderPackRequestStatus, "generated">) {
    try {
      setSaving(true);
      setError(null);
      const response = await authFetch(API_ROUTES.TENDER_PACK_REQUEST_DETAIL(requestId), {
        method: "PATCH",
        body: JSON.stringify({ status }),
      });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(data.error ?? "Failed to update request");
      }
      await loadRequests();
    } catch (updateError) {
      setError(updateError instanceof Error ? updateError.message : "Failed to update request");
    } finally {
      setSaving(false);
    }
  }

  async function generatePack(request: TenderPackRequest) {
    if (!request.dealId) {
      setError("This request is missing a linked dealId.");
      return;
    }

    try {
      setSaving(true);
      setError(null);
      const response = await authFetch(API_ROUTES.TENDER_PACK_GENERATE, {
        method: "POST",
        body: JSON.stringify({ dealId: request.dealId, requestId: request.id }),
      });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(data.error ?? "Failed to generate tender pack");
      }
      await loadRequests();
    } catch (generateError) {
      setError(generateError instanceof Error ? generateError.message : "Failed to generate tender pack");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 text-slate-950 shadow-sm">
      <div>
        <h2 className="text-lg font-semibold">
          {contractorMode ? "Request Tender Pack" : "Tender Pack Requests"}
        </h2>
        <p className="mt-1 text-sm text-slate-600">
          {contractorMode
            ? "Ask the operations team to prepare a tender pack for a linked tender."
            : "Review contractor requests and generate approved tender packs."}
        </p>
      </div>

      {contractorMode ? (
        <div className="grid gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4">
          <label className="grid gap-1 text-sm font-medium text-slate-700">
            Deal ID
            <input
              className="rounded-lg border border-slate-300 px-3 py-2 text-slate-950"
              value={dealId}
              onChange={(event) => setDealId(event.target.value)}
              placeholder="Paste the linked deal ID"
            />
          </label>
          <label className="grid gap-1 text-sm font-medium text-slate-700">
            Note
            <textarea
              className="min-h-20 rounded-lg border border-slate-300 px-3 py-2 text-slate-950"
              value={note}
              onChange={(event) => setNote(event.target.value)}
              placeholder="Optional tender pack context"
            />
          </label>
          <button
            className="justify-self-start rounded-lg bg-slate-950 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
            type="button"
            disabled={saving}
            onClick={createRequest}
          >
            {saving ? "Submitting..." : "Submit Request"}
          </button>
        </div>
      ) : null}

      {error ? (
        <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">
          {error}
        </p>
      ) : null}

      {loading ? (
        <p className="text-sm text-slate-500">Loading requests...</p>
      ) : visibleRequests.length === 0 ? (
        <p className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-4 text-sm text-slate-500">
          No tender pack requests found.
        </p>
      ) : (
        <div className="space-y-3">
          {visibleRequests.map((request) => {
            const downloadUrl = getDownloadUrl(request);
            return (
              <article key={request.id} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                  <div>
                    <p className="font-semibold text-slate-950">
                      {request.dealTitle || request.dealId || "Tender pack request"}
                    </p>
                    <p className="mt-1 text-sm text-slate-600">
                      {request.contractorName || request.contractorId}
                    </p>
                    <p className="mt-1 text-xs font-medium text-slate-500">
                      Requested {formatDate(request.requestedAt)}
                    </p>
                  </div>
                  <span className="rounded-full border border-slate-300 bg-white px-3 py-1 text-xs font-semibold text-slate-700">
                    {STATUS_LABELS[request.status]}
                  </span>
                </div>

                {request.note ? <p className="mt-3 text-sm text-slate-700">{request.note}</p> : null}

                {!contractorMode ? (
                  <div className="mt-4 flex flex-wrap gap-2">
                    <button className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold" disabled={saving} onClick={() => updateStatus(request.id, "under_review")}>
                      Under Review
                    </button>
                    <button className="rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-800" disabled={saving} onClick={() => updateStatus(request.id, "approved")}>
                      Approve
                    </button>
                    <button className="rounded-lg border border-rose-300 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-800" disabled={saving} onClick={() => updateStatus(request.id, "rejected")}>
                      Reject
                    </button>
                    {request.status === "approved" && canGenerate ? (
                      <button className="rounded-lg bg-slate-950 px-3 py-2 text-xs font-semibold text-white" disabled={saving} onClick={() => generatePack(request)}>
                        Generate Pack
                      </button>
                    ) : null}
                    {request.status === "approved" && !canGenerate ? (
                      <span className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-500">
                        Admin generation required
                      </span>
                    ) : null}
                  </div>
                ) : null}

                {downloadUrl ? (
                  <a className="mt-4 inline-flex rounded-lg border border-sky-200 bg-sky-50 px-3 py-2 text-xs font-semibold text-sky-700" href={downloadUrl} target="_blank" rel="noreferrer">
                    Download Generated Pack
                  </a>
                ) : null}
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
