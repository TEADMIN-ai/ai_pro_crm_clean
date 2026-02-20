"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";

import ContractorDocumentUploader from "@/components/contractors/ContractorDocumentUploader";

import { getContractor } from "@/lib/contractors/getContractor";
import { getContractorDocuments } from "@/lib/contractors/getContractorDocuments";

import type { Contractor } from "@/types/contractor";
import type { ContractorDocument } from "@/types/document";

/**
 * Normalize document name safely
 */
function normalizeDocumentName(doc: ContractorDocument): string {

  if (doc.fileName) return doc.fileName;
  if (doc.originalName) return doc.originalName;
  if (doc.filename) return doc.filename;
  if (doc.docType) return doc.docType;

  return "Unknown document";

}

export default function ContractorPage() {

  const params = useParams();

  /**
   * Resolve contractorId safely
   */
  const contractorId =
    typeof params?.contractorId === "string"
      ? params.contractorId
      : null;

  /**
   * State
   */
  const [contractor, setContractor] =
    useState<Contractor | null>(null);

  const [documents, setDocuments] =
    useState<ContractorDocument[]>([]);

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState<string | null>(null);

  /**
   * Load contractor and documents
   */
  useEffect(() => {

    if (!contractorId) {
      return;
    }

    // HARD TYPE NARROWING
    const id: string = contractorId;

    async function load() {

      try {

        setLoading(true);
        setError(null);

        const contractorData =
          await getContractor(id);

        const documentData =
          await getContractorDocuments(id);

        setContractor(contractorData);
        setDocuments(documentData);

      }
      catch (err: any) {

        console.error(err);

        setError(
          err?.message ??
          "Failed to load contractor"
        );

      }
      finally {

        setLoading(false);

      }

    }

    load();

  }, [contractorId]);

  /**
   * Missing contractorId
   */
  if (!contractorId) {

    return (
      <div style={{ padding: 20, color: "red" }}>
        Missing contractorId
      </div>
    );

  }

  /**
   * Loading state
   */
  if (loading) {

    return (
      <div style={{ padding: 20 }}>
        Loading contractor...
      </div>
    );

  }

  /**
   * Error state
   */
  if (error) {

    return (
      <div style={{ padding: 20, color: "red" }}>
        {error}
      </div>
    );

  }

  /**
   * Contractor not found
   */
  if (!contractor) {

    return (
      <div style={{ padding: 20, color: "red" }}>
        Contractor not found
      </div>
    );

  }

  /**
   * Render
   */
  return (

    <div style={{ padding: 20 }}>

      <h1>
        {contractor.companyName ??
         contractor.contactPerson ??
         contractor.email ??
         "Contractor"}
      </h1>

      <div style={{ marginTop: 10 }}>
        <strong>Email:</strong>{" "}
        {contractor.email ?? "-"}
      </div>

      <div>
        <strong>Status:</strong>{" "}
        {contractor.status ?? "-"}
      </div>

      <div style={{ marginTop: 20 }}>

        <ContractorDocumentUploader
          contractorId={contractorId}
          onUploaded={async () => {

            const updated =
              await getContractorDocuments(contractorId);

            setDocuments(updated);

          }}
        />

      </div>

      <div style={{ marginTop: 30 }}>

        <h2>Documents</h2>

        {documents.length === 0 && (
          <div>No contractor documents uploaded yet.</div>
        )}

        {documents.length > 0 && (

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

              {documents.map((doc) => (

                <tr key={doc.id}>

                  <td>
                    {normalizeDocumentName(doc)}
                  </td>

                  <td>
                    {doc.docType ?? "-"}
                  </td>

                  <td>
                    {doc.status ?? "-"}
                  </td>

                  <td>

                    {doc.expiresAt
                      ? new Date(doc.expiresAt).toLocaleDateString()
                      : "-"}

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