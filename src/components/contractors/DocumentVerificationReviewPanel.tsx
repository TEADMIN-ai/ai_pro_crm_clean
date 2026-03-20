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
        const response = await fetch(`/api/deals/${encodeURIComponent(resolvedDealId)}/documents`, {
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

  const updateStatus = async (
    item: DocumentItem,
    status: "approved" | "rejected"
  ) => {
    if (!canReview) return;

    try {
      console.log("Sending documentId:", item.id);

      const documentType = item.type || item.documentType || item.docType || "";

      const res = dealId
        ? await authFetch(`/api/deals/${encodeURIComponent(dealId)}/documents`, {
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
              }),
            })
          : await authFetch(`/api/documents/${encodeURIComponent(item.id)}/status`, {
            method: "PATCH",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              status,
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
    <section style={{ marginTop: 30 }}>
      <h2 style={{ marginBottom: 10 }}>Verification Review Queue</h2>

      {isLoading && (
        <p style={{ color: "#94a3b8" }}>Loading documents...</p>
      )}

      {loadError && !isLoading && (
        <p style={{ color: "#94a3b8" }}>{loadError}</p>
      )}

      {documentList.length === 0 && !isLoading && (
        <p style={{ color: "#94a3b8" }}>No documents to review</p>
      )}

      {documentList.map((doc) => {
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

        return (
          <div
            key={doc.id}
            style={{
              border: "1px solid #1f2937",
              borderRadius: 10,
              padding: 15,
              marginBottom: 15,
              background: "#0f172a",
              color: "white",
            }}
          >
            {/* HEADER */}
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
              }}
            >
              <div>
                <strong>{displayName}</strong>
                <p style={{ fontSize: 12, color: "#94a3b8" }}>
                  {documentType}
                </p>
              </div>

              <span
                style={{
                  padding: "4px 10px",
                  borderRadius: 6,
                  background:
                    normalizedStatus === "approved"
                      ? "#16a34a"
                      : normalizedStatus === "rejected"
                      ? "#dc2626"
                      : "#f59e0b",
                  fontSize: 12,
                }}
              >
                {statusLabel}
              </span>
            </div>

            {/* CONFIDENCE */}
            <div style={{ marginTop: 10 }}>
              <strong>Confidence Score:</strong>{" "}
              {doc.confidenceScore ?? 0}/100
            </div>

            {/* MISSING FIELDS */}
            {missingFields.length > 0 && (
              <div style={{ marginTop: 10 }}>
                <strong>Missing Fields:</strong>
                <ul>
                  {missingFields.map((f, i) => (
                    <li key={i}>{f}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* REASON */}
            {(doc.reason || doc.reviewReason) && (
              <div style={{ marginTop: 10 }}>
                <strong>Reason:</strong>
                <p>{doc.reason || doc.reviewReason}</p>
              </div>
            )}

            {/* CONFIDENCE NOTES */}
            {confidenceNotes.length > 0 && (
              <div style={{ marginTop: 10 }}>
                <strong>Confidence Notes:</strong>
                <ul>
                  {confidenceNotes.map((note, i) => (
                    <li key={i}>{note}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* SUGGESTIONS */}
            {suggestions.length > 0 && (
              <div style={{ marginTop: 10 }}>
                <strong>Suggestions:</strong>
                <ul className="mt-2 list-inside list-disc text-xs text-gray-400">
                  {suggestions.map((s, i) => (
                    <li key={i}>{s}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* MANUAL REVIEW MODE */}
            {isFail && (
              <div className="mt-3 text-sm text-yellow-300">
                Document failed automated verification
              </div>
            )}

            {needsManualReview && (
              <div className="rounded-lg border border-yellow-500 bg-yellow-900/20 p-4">
                <p className="text-sm font-medium text-yellow-300">
                  {isFail ? "Document failed automated verification." : "Manual verification required."}
                </p>

                <p className="mt-1 text-xs text-gray-400">
                  {isExtractionFailed
                    ? "AI extraction failed or returned no usable text."
                    : "Review the extracted data and confirm the final decision."}
                </p>

                {doc?.lastActionAt && (
                  <div className="text-xs text-gray-400 mt-1">
                    Last action: {doc?.lastActionType || "updated"} at{" "}
                    {new Date(doc.lastActionAt).toLocaleString()}
                  </div>
                )}

                {canReview && !hasManualDecision && (
                  <div className="mt-4 flex gap-2">
                    <button
                      onClick={() => handleManualApprove(doc)}
                      className="rounded bg-green-600 px-3 py-1 text-xs text-white"
                    >
                      Approve
                    </button>

                    <button
                      onClick={() => handleManualReject(doc)}
                      className="rounded bg-red-600 px-3 py-1 text-xs text-white"
                    >
                      Reject
                    </button>
                  </div>
                )}
              </div>
            )}

            {isFail && canReview && !hasManualDecision && (
              <div
                style={{
                  display: "flex",
                  gap: 10,
                  marginTop: 15,
                }}
              >
                <button
                  onClick={() => handleManualReject(doc)}
                  style={{
                    background: "#475569",
                    padding: "8px 14px",
                    borderRadius: 6,
                    border: "none",
                    cursor: "pointer",
                    color: "white",
                  }}
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
