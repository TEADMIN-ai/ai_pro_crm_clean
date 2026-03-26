"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { API_ROUTES } from "@/lib/routes";
import type { ContractorDocument } from "@/types/document";

type Props = {
  contractorId: string;
  documents: ContractorDocument[];
};

function getDocumentLabel(document: ContractorDocument): string {
  return (
    document.documentName ||
    document.fileName ||
    document.originalName ||
    document.filename ||
    document.documentType ||
    document.docType ||
    "Document"
  );
}

function getStatusLabel(status?: string): string {
  if (status === "PENDING_REVIEW") return "Pending Review";
  if (status === "FLAGGED") return "Flagged";
  if (status === "APPROVED") return "Approved";
  if (status === "REJECTED") return "Rejected";
  return status || "Pending Review";
}

export default function ContractorDocumentsSection({ contractorId, documents }: Props) {
  const router = useRouter();
  const [pendingDocumentId, setPendingDocumentId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleVerify = async (documentId: string, action: "approve" | "reject") => {
    setPendingDocumentId(documentId);

    try {
      const response = await fetch(API_ROUTES.DOCUMENT_VERIFY(documentId), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          contractorId,
          action,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to update document review status");
      }

      setPendingDocumentId(null);
      startTransition(() => {
        router.refresh();
      });
    } catch (error) {
      setPendingDocumentId(null);
      throw error;
    }
  };

  if (documents.length === 0) {
    return <p>No documents uploaded</p>;
  }

  return (
    <ul style={{ paddingLeft: "20px", margin: 0 }}>
      {documents.map((doc) => {
        const suggestions = doc.suggestions ?? doc.aiAnalysis?.suggestions ?? [];
        const busy = isPending || pendingDocumentId === doc.id;

        return (
          <li key={doc.id} style={{ marginBottom: "16px" }}>
            <div style={{ display: "grid", gap: "8px" }}>
              <div>
                {getDocumentLabel(doc)} {getStatusLabel(doc.status)}
              </div>

              {doc.status !== "APPROVED" && suggestions.length > 0 && (
                <ul style={{ margin: 0, paddingLeft: "20px" }}>
                  {suggestions.map((suggestion, index) => (
                    <li key={`${doc.id}-suggestion-${index}`}>{suggestion}</li>
                  ))}
                </ul>
              )}

              {doc.status !== "APPROVED" && (
                <div>
                  <button
                    type="button"
                    onClick={() => handleVerify(doc.id, "approve")}
                    disabled={busy}
                  >
                    Approve
                  </button>

                  <button
                    type="button"
                    onClick={() => handleVerify(doc.id, "reject")}
                    disabled={busy}
                    style={{ marginLeft: "8px" }}
                  >
                    Reject
                  </button>
                </div>
              )}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
