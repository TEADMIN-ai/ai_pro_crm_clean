"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";

import Card from "@/components/ui/Card";
import { useAuth } from "@/context/AuthContext";
import { getContractorDocuments } from "@/lib/contractors/getContractorDocuments";
import type { ContractorDocument } from "@/types/document";

type ExecutionPayload = {
  success: boolean;
  url: string;
};

const PREVIEWABLE_EXTENSIONS = new Set(["pdf", "jpg", "jpeg", "png"]);

function getDisplayName(document: ContractorDocument): string {
  return document.fileName ?? document.filename ?? document.originalName ?? "Document";
}

function isPreviewableDocument(document: ContractorDocument): boolean {
  const name = getDisplayName(document).toLowerCase();
  const dot = name.lastIndexOf(".");
  if (dot < 0 || dot === name.length - 1) {
    return false;
  }

  const extension = name.slice(dot + 1);
  return PREVIEWABLE_EXTENSIONS.has(extension);
}

function getExecutionDocumentId(document: ContractorDocument): string {
  return document.id;
}

function getExecutionDocumentType(document: ContractorDocument): string {
  return document.documentType ?? document.docType ?? document.id;
}

export default function DocumentExecutionPanel() {
  const params = useParams();
  const { user } = useAuth();
  const contractorId = typeof params?.contractorId === "string" ? params.contractorId : null;

  const [documents, setDocuments] = useState<ContractorDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    if (!contractorId || !user) return;
    const currentContractorId = contractorId;

    async function loadDocuments() {
      try {
        setLoading(true);
        setError(null);
        const list = await getContractorDocuments(currentContractorId);
        setDocuments(list);
      } catch (loadError) {
        console.error(loadError);
        setError("Failed to load documents for execution");
      } finally {
        setLoading(false);
      }
    }

    loadDocuments();
  }, [contractorId, user]);

  const sortedDocuments = useMemo(
    () => [...documents].sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0)),
    [documents]
  );

  async function fetchExecution(document: ContractorDocument): Promise<ExecutionPayload> {
    if (!user) {
      throw new Error("User not authenticated");
    }

    const documentId = getExecutionDocumentId(document);
    const documentType = getExecutionDocumentType(document);
    const targetContractorId = document.contractorId || contractorId;

    if (!targetContractorId) {
      throw new Error("Missing contractorId for document execution");
    }

    console.log("Executing document analysis for ID:", documentId);
    const token = await user.getIdToken(true);
    const query = new URLSearchParams({
      contractorId: targetContractorId,
      documentType,
    });
    const response = await fetch(`/api/documents/${documentId}/execute?${query.toString()}`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
      },
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(text || "Failed to prepare document execution");
    }

    const payload = (await response.json()) as ExecutionPayload;

    if (!payload.success || !payload.url) {
      throw new Error("Missing signed URL");
    }

    return payload;
  }

  async function handleOpen(document: ContractorDocument) {
    const documentId = getExecutionDocumentId(document);
    try {
      setBusyId(documentId);
      const payload = await fetchExecution(document);
      window.open(payload.url, "_blank");
    } catch (openError) {
      console.error(openError);
      setError("Failed to open document");
    } finally {
      setBusyId(null);
    }
  }

  async function handlePreview(document: ContractorDocument) {
    const documentId = getExecutionDocumentId(document);
    try {
      setBusyId(documentId);
      const payload = await fetchExecution(document);
      window.open(payload.url, "_blank");
    } catch (previewError) {
      console.error(previewError);
      setError("Failed to preview document");
    } finally {
      setBusyId(null);
    }
  }

  async function handleDownload(document: ContractorDocument) {
    const documentId = getExecutionDocumentId(document);
    try {
      setBusyId(documentId);
      const payload = await fetchExecution(document);
      window.open(payload.url, "_blank");
    } catch (downloadError) {
      console.error(downloadError);
      setError("Failed to download document");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <Card>
      <h2>Document Execution</h2>
      <p>Open, preview, and download contractor documents. Ready for AI autofill integration.</p>

      {loading && <p>Loading execution documents...</p>}
      {!loading && error && <p>{error}</p>}
      {!loading && !error && sortedDocuments.length === 0 && <p>No documents available for execution.</p>}

      {!loading && sortedDocuments.length > 0 && (
        <div>
          {sortedDocuments.map((doc) => {
            const documentId = getExecutionDocumentId(doc);
            const documentType = getExecutionDocumentType(doc);

            return (
              <div
                key={documentId}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: "12px",
                  padding: "8px 0",
                  borderBottom: "1px solid rgba(255,255,255,0.1)",
                }}
              >
                <span title={documentType}>{getDisplayName(doc)}</span>
                <div style={{ display: "flex", gap: "8px" }}>
                  <button disabled={busyId === documentId} onClick={() => handleOpen(doc)}>
                    Open
                  </button>
                  {isPreviewableDocument(doc) && (
                    <button disabled={busyId === documentId} onClick={() => handlePreview(doc)}>
                      Preview
                    </button>
                  )}
                  <button disabled={busyId === documentId} onClick={() => handleDownload(doc)}>
                    Download
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}
