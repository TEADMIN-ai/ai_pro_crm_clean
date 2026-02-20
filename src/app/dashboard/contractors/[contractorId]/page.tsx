/**
 * Contractor Dashboard Page
 * =========================
 *
 * SYSTEM PURPOSE
 * --------------
 *
 * This page is the primary compliance and document management interface
 * for a single contractor within Torque Empire AI Pro CRM.
 *
 *
 * WHAT THIS PAGE DOES
 * -------------------
 *
 * Resolves contractorId safely from Next.js dynamic route
 *
 * Fetches contractor metadata from Firestore
 *
 * Fetches contractor document list
 *
 * Displays contractor compliance information
 *
 * Allows document uploads via ContractorDocumentUploader
 *
 * Refreshes document state after uploads
 *
 *
 * DATA FLOW
 * ---------
 *
 * Route param  contractorId
 *
 * contractorId
 *
 *    getContractor()
 *    getContractorDocuments()
 *
 * Upload
 *
 *    ContractorDocumentUploader
 *    API route
 *    Firestore update
 *    reload document list
 *
 *
 * SAFETY GUARANTEES
 * -----------------
 *
 * contractorId is runtime validated before use
 *
 * No nullable values passed into API calls
 *
 * All document rendering uses normalization helpers
 *
 * Handles loading, error, empty, and success states safely
 *
 *
 * NEXT.JS 16 COMPATIBILITY
 * ------------------------
 *
 * Uses useParams() safely to avoid Promise param errors.
 *
 *
 * THIS FILE IS CRITICAL TO
 *
 * contractor compliance tracking
 *
 * document ingestion visibility
 *
 * AI classification display
 *
 */
"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";

import ContractorDocumentUploader from "@/components/contractors/ContractorDocumentUploader";

import { getContractor } from "@/lib/contractors/getContractor";
import { getContractorDocuments } from "@/lib/contractors/getContractorDocuments";

import type { Contractor } from "@/types/contractor";
import type { ContractorDocument } from "@/types/document";

type NormalizedDocumentDisplay = {
  id: string;
  name: string;
  type: string;
  status: string;
  expiresAt: Date | null;
};

function readNonEmptyString(
  record: Record<string, unknown>,
  key: string
): string | null {
  const value = record[key];
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function toDateOrNull(value: unknown): Date | null {
  if (value == null) {
    return null;
  }

  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }

  if (typeof value === "number" || typeof value === "string") {
    const candidate = new Date(value);
    return Number.isNaN(candidate.getTime()) ? null : candidate;
  }

  if (typeof value === "object" && value !== null && "toDate" in value) {
    const maybeToDate = (value as { toDate?: unknown }).toDate;
    if (typeof maybeToDate === "function") {
      const result = maybeToDate.call(value);
      if (result instanceof Date && !Number.isNaN(result.getTime())) {
        return result;
      }
    }
  }

  return null;
}

function normalizeDocument(doc: ContractorDocument): NormalizedDocumentDisplay {
  const raw = doc as unknown as Record<string, unknown>;
  const typeLabel = readNonEmptyString(raw, "docType") ?? "-";
  const statusLabel = readNonEmptyString(raw, "status") ?? "-";
  const expiresAt = toDateOrNull(raw.expiresAt);

  return {
    id: doc.id,
    name: normalizeDocumentName(doc),
    type: typeLabel,
    status: statusLabel,
    expiresAt,
  };
}

function formatExpiryDate(value: Date | null): string {
  return value ? value.toLocaleDateString() : "-";
}

/**
 * normalizeDocumentName
 *
 * Safely resolves a display name for contractor documents.
 *
 * Fallback order:
 *
 * fileName
 * originalName
 * filename
 * docType
 * "Unknown document"
 *
 * Prevents UI failures caused by incomplete Firestore metadata.
 */
function normalizeDocumentName(doc: ContractorDocument): string {
  const raw = doc as any;

  if (typeof raw.fileName === "string" && raw.fileName.trim().length > 0) {
    return raw.fileName;
  }

  if (typeof raw.originalName === "string" && raw.originalName.trim().length > 0) {
    return raw.originalName;
  }

  if (typeof raw.filename === "string" && raw.filename.trim().length > 0) {
    return raw.filename;
  }

  if (typeof raw.docType === "string" && raw.docType.trim().length > 0) {
    return raw.docType;
  }

  return "Unknown document";
}

export default function ContractorPage() {
  const params = useParams();

  const contractorId =
    typeof params?.contractorId === "string"
      ? params.contractorId
      : null;

  const [contractor, setContractor] = useState<Contractor | null>(null);
  const [documents, setDocuments] = useState<ContractorDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  /**
   * Contractor Data Loader
   *
   * Fetches contractor metadata and document list
   * once contractorId becomes available.
   *
   * Ensures dashboard reflects current Firestore state.
   */
  useEffect(() => {
    if (!contractorId) {
      setLoading(false);
      return;
    }
    const resolvedContractorId = contractorId;

    async function load(): Promise<void> {
      try {
        setLoading(true);
        setError(null);

        const contractorData = await getContractor(resolvedContractorId);
        const documentData = await getContractorDocuments(resolvedContractorId);

        setContractor(contractorData);
        setDocuments(documentData);
      } catch (err: unknown) {
        console.error(err);
        setError(err instanceof Error ? err.message : "Failed to load contractor");
      } finally {
        setLoading(false);
      }
    }

    void load();
  }, [contractorId]);

  const normalizedDocuments = useMemo(
    () => documents.map((doc) => normalizeDocument(doc)),
    [documents]
  );

  if (!contractorId) {
    return (
      <div style={{ padding: 20, color: "red" }}>
        Missing contractorId
      </div>
    );
  }

  if (loading) {
    return <div style={{ padding: 20 }}>Loading contractor...</div>;
  }

  if (error) {
    return (
      <div style={{ padding: 20, color: "red" }}>
        {error}
      </div>
    );
  }

  if (!contractor) {
    return <div style={{ padding: 20 }}>Contractor not found</div>;
  }

  return (
    <div style={{ padding: 20 }}>
      <h1>
        {contractor.companyName || "Contractor"}
      </h1>

      <div style={{ marginTop: 10 }}>
        <strong>Email:</strong> {contractor.email ?? "-"}
      </div>

      <div>
        <strong>Status:</strong> {contractor.status ?? "-"}
      </div>

      <div style={{ marginTop: 20 }}>
        {/**
          * ContractorDocumentUploader Integration
          *
          * Allows uploading new contractor compliance documents.
          *
          * After upload completes:
          *
          * document list is refreshed from Firestore
          *
          * UI remains synchronized with storage state
          */}
        <ContractorDocumentUploader
          contractorId={contractorId}
          onUploaded={async () => {
            const updatedDocs = await getContractorDocuments(contractorId);
            setDocuments(updatedDocs);
          }}
        />
      </div>

      <div style={{ marginTop: 30 }}>
        <h2>Documents</h2>

        {normalizedDocuments.length === 0 && (
          <div>
            No contractor documents uploaded yet.
          </div>
        )}

        {normalizedDocuments.length > 0 && (
          <table
            style={{
              width: "100%",
              marginTop: 10,
              borderCollapse: "collapse"
            }}
          >
            <thead>
              <tr>
                <th align="left">Name</th>
                <th align="left">Type</th>
                <th align="left">Status</th>
                <th align="left">Expiry</th>
              </tr>
            </thead>

            <tbody>
              {normalizedDocuments.map((doc) => (
                <tr key={doc.id}>
                  <td>
                    {doc.name}
                  </td>

                  <td>
                    {doc.type}
                  </td>

                  <td>
                    {doc.status}
                  </td>

                  <td>
                    {formatExpiryDate(doc.expiresAt)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
