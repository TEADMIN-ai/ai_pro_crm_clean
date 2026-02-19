"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import ContractorDocumentUploader from "@/components/contractors/ContractorDocumentUploader";
import { getContractorDocuments } from "@/lib/contractors/getContractorDocuments";
import type { ContractorDocument } from "@/types/document";

type DocumentDisplay = {
  id: string;
  name: string;
  status: ContractorDocument["status"];
  docType: ContractorDocument["docType"];
  expiresAt: Date | null;
  downloadURL: string;
};

function normalizeDocumentName(doc: ContractorDocument): string {
  const normalizedSource = doc as ContractorDocument & {
    fileName?: unknown;
    originalName?: unknown;
    filename?: unknown;
  };

  const candidates = [
    normalizedSource.fileName,
    normalizedSource.originalName,
    normalizedSource.filename,
    doc.docType,
  ];

  for (const candidate of candidates) {
    if (typeof candidate === "string" && candidate.trim().length > 0) {
      return candidate.trim();
    }
  }

  return "Unknown document";
}

function normalizeExpiresAt(expiresAt: ContractorDocument["expiresAt"]): Date | null {
  if (typeof expiresAt !== "number" || !Number.isFinite(expiresAt)) {
    return null;
  }

  const parsed = new Date(expiresAt);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function toDisplayDocument(doc: ContractorDocument, index: number): DocumentDisplay {
  const normalizedId =
    typeof doc.id === "string" && doc.id.trim().length > 0
      ? doc.id
      : `document-${index + 1}`;

  return {
    id: normalizedId,
    name: normalizeDocumentName(doc),
    status: doc.status,
    docType: doc.docType,
    expiresAt: normalizeExpiresAt(doc.expiresAt),
    downloadURL: doc.downloadURL,
  };
}

export default function ContractorPage() {
  const params = useParams();

  const contractorId =
    typeof params?.contractorId === "string"
      ? params.contractorId
      : null;

  const [documents, setDocuments] = useState<ContractorDocument[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    async function load(): Promise<void> {
      if (contractorId === null) {
        if (isMounted) {
          setError("Invalid contractor ID");
          setLoading(false);
        }
        return;
      }

      setError(null);
      setLoading(true);

      try {
        const docs = await getContractorDocuments(contractorId);

        if (isMounted) {
          setDocuments(Array.isArray(docs) ? docs : []);
        }
      } catch (loadError: unknown) {
        if (!isMounted) {
          return;
        }

        const message =
          loadError instanceof Error
            ? loadError.message
            : "Failed to load documents";

        setError(message);
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }

    void load();

    return () => {
      isMounted = false;
    };
  }, [contractorId]);

  const displayDocuments = useMemo(
    () => documents.map((doc, index) => toDisplayDocument(doc, index)),
    [documents]
  );

  if (contractorId === null) {
    return <div style={{ color: "#dc2626" }}>Invalid contractor ID.</div>;
  }

  if (loading) {
    return <div>Loading contractor...</div>;
  }

  if (error) {
    return <div style={{ color: "#dc2626" }}>{error}</div>;
  }

  return (
    <div>
      <h1>Contractor Profile</h1>

      <ContractorDocumentUploader
        contractorId={contractorId}
        onUploaded={async () => {
          try {
            const docs = await getContractorDocuments(contractorId);
            setDocuments(Array.isArray(docs) ? docs : []);
            setError(null);
          } catch (refreshError: unknown) {
            const message =
              refreshError instanceof Error
                ? refreshError.message
                : "Failed to refresh documents";
            setError(message);
          }
        }}
      />

      <h2>Documents</h2>

      {displayDocuments.length === 0 && (
        <div>No contractor documents uploaded yet.</div>
      )}

      {displayDocuments.map((doc) => (
        <div key={doc.id} style={{ marginBottom: 8 }}>
          <div>{doc.name}</div>
          <div style={{ color: "#6b7280", fontSize: 13 }}>
            Status: {doc.status}
            {doc.docType ? ` • Type: ${doc.docType}` : ""}
            {doc.expiresAt
              ? ` • Expires: ${doc.expiresAt.toLocaleDateString()}`
              : " • Expires: Not set"}
          </div>
          {doc.downloadURL ? (
            <a href={doc.downloadURL} target="_blank" rel="noreferrer">
              Open document
            </a>
          ) : null}
        </div>
      ))}
    </div>
  );
}
