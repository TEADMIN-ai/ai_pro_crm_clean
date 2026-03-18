"use client";

import { useState } from "react";
import Badge from "@/components/ui/Badge";
import { authFetch } from "@/lib/client/authFetch";
import { API_ROUTES } from "@/lib/routes";
import type { ContractorDocument } from "@/types/document";

type Props = {
  contractorId: string;
  documents: ContractorDocument[];
  canReview: boolean;
  onUpdatedAction: () => Promise<void> | void;
};

type ReviewAction = "approve" | "reject" | "request_reupload";

const BADGE_CONFIG = {
  PASS: { label: "Verified", tone: "success" as const },
  REVIEW: { label: "Needs Review", tone: "warning" as const },
  FAIL: { label: "Failed", tone: "danger" as const },
};

function formatStatus(document: ContractorDocument): keyof typeof BADGE_CONFIG | null {
  if (
    document.validationStatus === "PASS" ||
    document.validationStatus === "REVIEW" ||
    document.validationStatus === "FAIL"
  ) {
    return document.validationStatus;
  }

  return null;
}

export default function DocumentVerificationReviewPanel({
  contractorId,
  documents,
  canReview,
  onUpdatedAction,
}: Props) {
  const reviewDocuments = documents.filter((document) => document.fileUrl && formatStatus(document));
  const [busyDocumentId, setBusyDocumentId] = useState<string | null>(null);
  const [reasonByDocument, setReasonByDocument] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);

  async function handleReviewAction(document: ContractorDocument, action: ReviewAction) {
    setBusyDocumentId(document.id);
    setError(null);

    try {
      const response = await authFetch(API_ROUTES.CONTRACTOR_DOCUMENT_REVIEW(contractorId, document.id), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          action,
          reviewReason: reasonByDocument[document.id] ?? "",
        }),
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(payload?.error ?? `Manual review failed (${response.status})`);
      }

      await onUpdatedAction();
      setReasonByDocument((current) => ({ ...current, [document.id]: "" }));
    } catch (reviewError) {
      console.error("Manual verification action failed:", reviewError);
      setError(reviewError instanceof Error ? reviewError.message : "Failed to apply manual review");
    } finally {
      setBusyDocumentId(null);
    }
  }

  if (reviewDocuments.length === 0) {
    return null;
  }

  return (
    <section className="enterprise-card" style={{ display: "grid", gap: 18 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
        <div>
          <h2 style={{ margin: 0 }}>Verification Review Queue</h2>
          <p style={{ margin: "6px 0 0", color: "#94a3b8" }}>
            Automatic verification results with manual-review support and audit logging.
          </p>
        </div>
        <Badge tone="info">{reviewDocuments.length} reviewed documents</Badge>
      </div>

      {error ? (
        <div style={{ border: "1px solid rgba(248,113,113,0.35)", background: "rgba(127,29,29,0.22)", color: "#fecaca", borderRadius: 14, padding: "12px 14px" }}>
          {error}
        </div>
      ) : null}

      <div style={{ display: "grid", gap: 16 }}>
        {reviewDocuments.map((document) => {
          const status = formatStatus(document);
          if (!status) {
            return null;
          }

          const config = BADGE_CONFIG[status];
          const busy = busyDocumentId === document.id;

          return (
            <article
              key={document.id}
              className="verification-review-card"
              style={{
                border: "1px solid rgba(148,163,184,0.18)",
                borderRadius: 18,
                padding: 18,
                background: "linear-gradient(180deg, rgba(15,23,42,0.88), rgba(15,23,42,0.68))",
                display: "grid",
                gap: 14,
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "flex-start", flexWrap: "wrap" }}>
                <div>
                  <h3 style={{ margin: 0, fontSize: "1rem" }}>{document.documentName ?? document.fileName ?? document.id}</h3>
                  <p style={{ margin: "6px 0 0", color: "#94a3b8" }}>{document.documentType ?? document.docType ?? "document"}</p>
                </div>
                <Badge tone={config.tone}>{config.label}</Badge>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12 }}>
                <InfoBlock label="Confidence Score" value={typeof document.confidenceScore === "number" ? `${document.confidenceScore}/100` : "-"} />
                <InfoBlock label="Missing Fields" value={document.missingFields?.length ? document.missingFields.join(", ") : "-"} />
                <InfoBlock label="Reviewed By" value={document.reviewedBy ?? "-"} />
                <InfoBlock label="Reviewed At" value={typeof document.reviewedAt === "number" ? new Date(document.reviewedAt).toLocaleString() : "-"} />
              </div>

              {document.reviewReason || document.validationError ? (
                <div style={{ borderRadius: 14, padding: "12px 14px", background: "rgba(30,41,59,0.72)", color: "#e2e8f0" }}>
                  <strong style={{ display: "block", marginBottom: 6 }}>Reason</strong>
                  <span>{document.reviewReason ?? document.validationError}</span>
                </div>
              ) : null}

              {document.confidenceNotes?.length ? (
                <InfoList title="Confidence Notes" values={document.confidenceNotes} />
              ) : null}

              {document.suggestions?.length ? (
                <InfoList title="Suggestions" values={document.suggestions} />
              ) : null}

              {canReview && status === "REVIEW" ? (
                <div style={{ display: "grid", gap: 12 }}>
                  <textarea
                    value={reasonByDocument[document.id] ?? ""}
                    onChange={(event) =>
                      setReasonByDocument((current) => ({
                        ...current,
                        [document.id]: event.target.value,
                      }))
                    }
                    placeholder="Optional review reason"
                    rows={3}
                    style={{
                      width: "100%",
                      resize: "vertical",
                      borderRadius: 14,
                      border: "1px solid rgba(148,163,184,0.2)",
                      background: "rgba(15,23,42,0.92)",
                      color: "#e2e8f0",
                      padding: 12,
                    }}
                  />
                  <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                    <ActionButton busy={busy} tone="success" onClick={() => handleReviewAction(document, "approve")}>
                      Approve
                    </ActionButton>
                    <ActionButton busy={busy} tone="danger" onClick={() => handleReviewAction(document, "reject")}>
                      Reject
                    </ActionButton>
                    <ActionButton busy={busy} tone="warning" onClick={() => handleReviewAction(document, "request_reupload")}>
                      Request New Upload
                    </ActionButton>
                  </div>
                </div>
              ) : null}
            </article>
          );
        })}
      </div>
    </section>
  );
}

function InfoBlock({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ borderRadius: 14, padding: "12px 14px", background: "rgba(30,41,59,0.56)" }}>
      <div style={{ color: "#94a3b8", fontSize: "0.78rem", textTransform: "uppercase", letterSpacing: "0.08em" }}>{label}</div>
      <div style={{ marginTop: 6, color: "#f8fafc" }}>{value}</div>
    </div>
  );
}

function InfoList({ title, values }: { title: string; values: string[] }) {
  return (
    <div style={{ borderRadius: 14, padding: "12px 14px", background: "rgba(30,41,59,0.56)" }}>
      <strong style={{ display: "block", marginBottom: 8 }}>{title}</strong>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
        {values.map((value) => (
          <span
            key={`${title}-${value}`}
            style={{
              borderRadius: 999,
              border: "1px solid rgba(148,163,184,0.2)",
              padding: "6px 10px",
              color: "#e2e8f0",
              background: "rgba(15,23,42,0.72)",
              fontSize: "0.9rem",
            }}
          >
            {value}
          </span>
        ))}
      </div>
    </div>
  );
}

function ActionButton({
  busy,
  children,
  onClick,
  tone,
}: {
  busy: boolean;
  children: string;
  onClick: () => void;
  tone: "success" | "danger" | "warning";
}) {
  const background =
    tone === "success"
      ? "linear-gradient(135deg, #166534, #15803d)"
      : tone === "danger"
        ? "linear-gradient(135deg, #991b1b, #dc2626)"
        : "linear-gradient(135deg, #92400e, #d97706)";

  return (
    <button
      type="button"
      disabled={busy}
      onClick={onClick}
      style={{
        border: 0,
        borderRadius: 12,
        padding: "10px 14px",
        color: "white",
        background,
        cursor: busy ? "not-allowed" : "pointer",
        opacity: busy ? 0.7 : 1,
        fontWeight: 600,
      }}
    >
      {busy ? "Working..." : children}
    </button>
  );
}
