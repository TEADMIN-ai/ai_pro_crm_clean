"use client";

import React, { useEffect, useMemo, useState } from "react";
import { authFetch } from "@/lib/client/authFetch";
import { API_ROUTES } from "@/lib/routes";

type DocumentItem = {
  id: string;
  fileName?: string;
  name?: string;
  documentName?: string;
  type?: string;
  docType?: string;
  documentType?: string;
  status?: string;
  finalStatus?: "PASS" | "REVIEW" | "FAIL";
  validationStatus?: "PASS" | "REVIEW" | "FAIL";
  verified?: boolean;
  confidenceScore?: number;
  missingFields?: string[];
  reason?: string;
  reviewReason?: string;
  suggestions?: string[];
  confidenceNotes?: string[];
  extractedText?: string;
  extractedTextLength?: number;
  analysisStatus?: string;
  fileUrl?: string;
  downloadURL?: string;
  lastActionAt?: string | number | Date;
  lastActionType?: string;
};

function getAiFinalStatus(item: DocumentItem): "PASS" | "REVIEW" | "FAIL" | undefined {
  if (item.finalStatus === "PASS" || item.finalStatus === "REVIEW" || item.finalStatus === "FAIL") {
    return item.finalStatus;
  }

  if (item.validationStatus === "PASS" || item.validationStatus === "REVIEW" || item.validationStatus === "FAIL") {
    return item.validationStatus;
  }

  return undefined;
}

type Props = {
  contractorId?: string;
  dealId?: string;
  documents?: DocumentItem[];
  canReview?: boolean;
  onUpdatedAction?: () => void | Promise<void>;
};

export default function DocumentVerificationReviewPanel({
  contractorId,
  dealId,
  documents = [],
  canReview = true,
  onUpdatedAction,
}: Props) {
  const [fetchedDocuments, setFetchedDocuments] = useState<DocumentItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    if (!dealId || documents.length > 0) {
      return;
    }

    const resolvedDealId = dealId;
    let active = true;

    async function loadDocuments() {
      setIsLoading(true);
      setLoadError(null);

      try {
        const response = await authFetch(API_ROUTES.DEAL_DOCUMENTS(resolvedDealId), {
          method: "GET",
        });

        if (!response.ok) {
          throw new Error(`Failed to load deal documents (${response.status})`);
        }

        const payload = (await response.json()) as { documents?: DocumentItem[] };
        if (active) {
          setFetchedDocuments(Array.isArray(payload?.documents) ? payload.documents : []);
        }
      } catch (error) {
        if (active) {
          setFetchedDocuments([]);
          setLoadError(error instanceof Error ? error.message : "Failed to load documents");
        }
      } finally {
        if (active) {
          setIsLoading(false);
        }
      }
    }

    void loadDocuments();

    return () => {
      active = false;
    };
  }, [dealId, documents.length]);

  const documentList = useMemo(() => {
    if (Array.isArray(documents) && documents.length > 0) {
      return documents;
    }

    return fetchedDocuments;
  }, [documents, fetchedDocuments]);

  const filteredDocs = useMemo(() => {
    const sourceDocuments = Array.isArray(documentList) ? documentList : [];
    const verifiedCount = sourceDocuments.filter((doc) => doc?.verified === true).length;
    console.log("Filtered verified docs:", verifiedCount);
    return sourceDocuments.filter((doc) => doc?.verified !== true);
  }, [documentList]);

  const updateStatus = async (
    item: DocumentItem,
    status: "approved" | "rejected"
  ) => {
    if (!canReview) return;
    const reviewReason = window.prompt(status === "approved" ? "Approval note" : "Decline reason");
    if (!reviewReason?.trim()) {
      setLoadError(status === "approved" ? "Approval note is required." : "Decline reason is required.");
      return;
    }

    try {
      console.log("Sending documentId:", item.id);

      const documentType = item.type || item.documentType || item.docType || "";

      const res = dealId
        ? await authFetch(API_ROUTES.DEAL_DOCUMENTS(dealId), {
            method: "PATCH",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              documentId: item.id,
              status,
            }),
          })
        : contractorId && documentType
          ? await authFetch(API_ROUTES.CONTRACTOR_DOCUMENT_REVIEW(contractorId, documentType), {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                action: status === "approved" ? "approve" : "reject",
                documentId: item.id,
                reviewReason: reviewReason.trim(),
              }),
            })
          : await authFetch(API_ROUTES.DOCUMENT_STATUS(item.id), {
              method: "PATCH",
              headers: {
                "Content-Type": "application/json",
              },
          body: JSON.stringify({
            status,
            reviewReason: reviewReason.trim(),
            reviewedAt: new Date(),
          }),
        });

      if (!res.ok) {
        throw new Error("Failed to update document status");
      }

      if (onUpdatedAction) {
        await onUpdatedAction();
        return;
      }

      window.location.reload();
    } catch (err) {
      console.error("Status update error:", err);
    }
  };

  const handleManualApprove = (item: DocumentItem) => {
    console.log("Sending documentId:", item.id)
    void updateStatus(item, "approved");
  };

  const handleManualReject = (item: DocumentItem) => {
    console.log("Sending documentId:", item.id)
    void updateStatus(item, "rejected");
  };

  return (
    <section className="mt-8">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[color:var(--tex-accent)]">Manual Review</p>
          <h2 className="text-xl font-semibold text-[color:var(--tex-text-strong)]">Verification Review Queue</h2>
        </div>
        <span className="tex-status-badge" data-tone="info">
          {filteredDocs.length} pending
        </span>
      </div>

      {isLoading && (
        <p className="mt-4 text-sm text-[color:var(--tex-text-muted)]">Loading documents...</p>
      )}

      {loadError && !isLoading && (
        <p className="mt-4 rounded-lg border border-[color:var(--tex-danger)] bg-[color:var(--tex-danger-soft)] px-3 py-2 text-sm text-[color:var(--tex-danger)]">{loadError}</p>
      )}

      {filteredDocs.length === 0 && !isLoading && (
        <p className="tex-empty-state mt-4">No pending documents</p>
      )}

      {filteredDocs.map((doc) => {
        const aiFinalStatus = getAiFinalStatus(doc);
        const isPass = aiFinalStatus === "PASS";
        const isFail = aiFinalStatus === "FAIL";
        const isReview = aiFinalStatus === "REVIEW";
        const isProcessed = doc?.verified === true;
        const hasManualDecision = doc.status === "approved" || doc.status === "rejected";
        const normalizedStatus =
          hasManualDecision
            ? doc.status
            : isPass
            ? "approved"
            : isFail
              ? "rejected"
              : "pending";
        const statusLabel =
          hasManualDecision
            ? doc.status === "approved"
              ? "Approved"
              : "Rejected"
            : isPass
            ? "Verified"
            : isReview
              ? "Needs Review"
              : isFail
                ? "Failed"
                : isProcessed
                  ? "AI Processed"
                  : normalizedStatus;
        const isExtractionFailed =
          (typeof doc?.extractedText === "string" && doc.extractedText.trim().length === 0) ||
          doc?.analysisStatus === "failed" ||
          doc?.extractedTextLength === 0;
        const needsManualReview = isFail || isReview || isExtractionFailed;
        const missingFields = doc?.missingFields || [];
        const suggestions = doc?.suggestions || [];
        const confidenceNotes = doc?.confidenceNotes || [];
        const displayName =
          doc.fileName ||
          doc.documentName ||
          doc.name ||
          doc.type ||
          doc.documentType ||
          doc.docType ||
          "Document";
        const documentType = doc.type || doc.documentType || doc.docType || "unknown";
        const fileUrl = doc.fileUrl || doc.downloadURL;

        return (
          <div
            key={doc.id}
            className="mt-4 rounded-xl border border-[color:var(--tex-border)] bg-[color:var(--tex-card-strong)] p-4 text-[color:var(--tex-text)] shadow-sm"
          >
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-[color:var(--tex-border)] bg-[color:var(--tex-accent-soft)] text-xs font-black text-[color:var(--tex-accent)]">
                    DOC
                  </span>
                  <strong className="break-words text-[color:var(--tex-text-strong)]">{displayName}</strong>
                </div>
                <p className="mt-1 text-sm text-[color:var(--tex-text-muted)]">{documentType}</p>
              </div>

              <span
                className="tex-status-badge self-start"
                data-tone={normalizedStatus === "approved" ? "success" : normalizedStatus === "rejected" ? "danger" : "warning"}
              >
                {statusLabel}
              </span>
            </div>

            <div className="mt-4 grid gap-2 text-sm sm:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-lg border border-[color:var(--tex-border)] bg-[color:var(--tex-surface)] px-3 py-2">
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[color:var(--tex-text-muted)]">Confidence</p>
                <p className="mt-1 font-semibold text-[color:var(--tex-text-strong)]">{doc.confidenceScore ?? 0}/100</p>
              </div>
              <div className="rounded-lg border border-[color:var(--tex-border)] bg-[color:var(--tex-surface)] px-3 py-2">
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[color:var(--tex-text-muted)]">Extraction</p>
                <p className="mt-1 font-semibold text-[color:var(--tex-text-strong)]">{isExtractionFailed ? "Failed / empty" : "Available"}</p>
              </div>
              <div className="rounded-lg border border-[color:var(--tex-border)] bg-[color:var(--tex-surface)] px-3 py-2">
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[color:var(--tex-text-muted)]">Text Length</p>
                <p className="mt-1 font-semibold text-[color:var(--tex-text-strong)]">{doc.extractedTextLength ?? 0} chars</p>
              </div>
              <div className="rounded-lg border border-[color:var(--tex-border)] bg-[color:var(--tex-surface)] px-3 py-2">
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[color:var(--tex-text-muted)]">Last Action</p>
                <p className="mt-1 font-semibold text-[color:var(--tex-text-strong)]">{doc?.lastActionAt ? new Date(doc.lastActionAt).toLocaleString("en-ZA") : "Not recorded"}</p>
              </div>
            </div>

            {/* MISSING FIELDS */}
            {missingFields.length > 0 && (
              <div className="mt-4 text-sm">
                <strong className="text-[color:var(--tex-text-strong)]">Missing Fields:</strong>
                <ul className="mt-2 list-inside list-disc text-[color:var(--tex-text-muted)]">
                  {missingFields.map((f, i) => (
                    <li key={i}>{f}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* REASON */}
            {(doc.reason || doc.reviewReason) && (
              <div className="mt-4 text-sm">
                <strong className="text-[color:var(--tex-text-strong)]">Reason:</strong>
                <p className="mt-1 text-[color:var(--tex-text-muted)]">{doc.reason || doc.reviewReason}</p>
              </div>
            )}

            {/* CONFIDENCE NOTES */}
            {confidenceNotes.length > 0 && (
              <div className="mt-4 text-sm">
                <strong className="text-[color:var(--tex-text-strong)]">Confidence Notes:</strong>
                <ul className="mt-2 list-inside list-disc text-[color:var(--tex-text-muted)]">
                  {confidenceNotes.map((note, i) => (
                    <li key={i}>{note}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* SUGGESTIONS */}
            {suggestions.length > 0 && (
              <div className="mt-4 text-sm">
                <strong className="text-[color:var(--tex-text-strong)]">Suggestions:</strong>
                <ul className="mt-2 list-inside list-disc text-[color:var(--tex-text-muted)]">
                  {suggestions.map((s, i) => (
                    <li key={i}>{s}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* MANUAL REVIEW MODE */}
            {isFail && (
              <div className="mt-3 text-sm font-medium text-[color:var(--tex-warning)]">
                Document failed automated verification
              </div>
            )}

            {needsManualReview && (
              <div className="mt-4 rounded-lg border border-[color:var(--tex-warning)] bg-[color:var(--tex-warning-soft)] p-4">
                <p className="text-sm font-medium text-[color:var(--tex-warning)]">
                  {isFail ? "Document failed automated verification." : "Manual verification required."}
                </p>

                <p className="mt-1 text-xs text-[color:var(--tex-text-muted)]">
                  {isExtractionFailed
                    ? "AI extraction failed or returned no usable text."
                    : "Review the extracted data and confirm the final decision."}
                </p>

                {canReview && !hasManualDecision && (
                  <div className="mt-4 flex flex-wrap gap-2">
                    {fileUrl ? (
                      <a
                        href={fileUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="rounded-lg border border-[color:var(--tex-border)] bg-[color:var(--tex-surface)] px-3 py-2 text-xs font-semibold text-[color:var(--tex-accent-strong)] no-underline"
                      >
                        View
                      </a>
                    ) : null}
                    <button
                      onClick={() => handleManualApprove(doc)}
                      className="rounded-lg bg-[color:var(--tex-success)] px-3 py-2 text-xs font-semibold text-white"
                    >
                      Verify Manually
                    </button>

                    <button
                      onClick={() => handleManualReject(doc)}
                      className="rounded-lg bg-[color:var(--tex-danger)] px-3 py-2 text-xs font-semibold text-white"
                    >
                      Decline
                    </button>
                  </div>
                )}
              </div>
            )}

            {isFail && canReview && !hasManualDecision && (
              <div className="mt-4 flex flex-wrap gap-2">
                <button
                  onClick={() => handleManualReject(doc)}
                  className="rounded-lg border border-[color:var(--tex-border)] bg-[color:var(--tex-surface)] px-3 py-2 text-xs font-semibold text-[color:var(--tex-text-strong)]"
                >
                  Request New Upload
                </button>
              </div>
            )}
          </div>
        );
      })}
    </section>
  );
}
