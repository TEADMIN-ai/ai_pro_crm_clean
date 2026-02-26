"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";

import ContractorDocumentUploader from "@/components/contractors/ContractorDocumentUploader";
import DocumentExecutionPanel from "@/components/documents/DocumentExecutionPanel";
import TenderPackGeneratorPanel from "@/components/documents/TenderPackGeneratorPanel";

import Badge from "@/components/ui/Badge";
import Card, { IdentityCardHeader } from "@/components/ui/Card";
import Table from "@/components/ui/Table";

import { authFetch } from "@/lib/client/authFetch";
import { calculateCompliance } from "@/lib/compliance/calculateCompliance";
import { getContractorDocuments } from "@/lib/contractors/getContractorDocuments";
import { resolveDocumentFileName } from "@/lib/documents/normalizeDocumentName";
import { API_ROUTES } from "@/lib/routes";

import type { Contractor } from "@/types/contractor";
import type { ContractorDocument } from "@/types/document";


/* ---------- SAFE TYPES ---------- */

type ContractorApiPayload = {
  id: string;
  companyName?: string | null;
  email?: string | null;
  status?: string | null;
  createdAt?: number | null;
};

type RiskLabel = "Valid" | "Expiring Soon" | "Expired";


/* ---------- HELPERS ---------- */

function getDocumentRisk(doc: ContractorDocument): RiskLabel {

  const expiresAt =
    typeof doc.expiresAt === "number"
      ? doc.expiresAt
      : typeof doc.expiryDate === "number"
      ? doc.expiryDate
      : null;

  if (!expiresAt) return "Valid";

  const now = Date.now();
  const warning = now + 30 * 24 * 60 * 60 * 1000;

  if (expiresAt < now) return "Expired";
  if (expiresAt <= warning) return "Expiring Soon";

  return "Valid";
}


/* ---------- COMPONENT ---------- */

export default function ContractorDetailPage() {

  const params = useParams();

  const contractorId =
    typeof params?.contractorId === "string"
      ? params.contractorId
      : Array.isArray(params?.contractorId)
      ? params.contractorId[0]
      : null;

  const [contractor, setContractor] = useState<Contractor | null>(null);
  const [documents, setDocuments] = useState<ContractorDocument[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);


  useEffect(() => {

    if (!contractorId) {
      setError("Contractor ID missing from route.");
      setLoading(false);
      return;
    }
    const currentContractorId = contractorId;

    async function load() {

      try {

        setLoading(true);

        const response = await authFetch(
          API_ROUTES.CONTRACTOR_DETAIL(currentContractorId)
        );

        if (!response || typeof response.ok !== "boolean") {
          throw new Error("Invalid API response");
        }

        if (!response.ok) {
          throw new Error(`API returned ${response.status}`);
        }

        const payload = (await response.json()) as ContractorApiPayload;

        if (!payload || typeof payload.id !== "string") {
          throw new Error("Invalid contractor payload");
        }

        const normalizedContractor: Contractor = {
          id: payload.id,
          companyName: payload.companyName ?? null,
          email: payload.email ?? null,
          status: payload.status ?? null,
          createdAt: typeof payload.createdAt === "number" ? payload.createdAt : null,
        };
        setContractor(normalizedContractor);

        const docs = await getContractorDocuments(currentContractorId);

        if (Array.isArray(docs)) {
          setDocuments(docs);
        }

      } catch (err) {

        console.error("Contractor load error:", err);

        setError(
          err instanceof Error
            ? err.message
            : "Failed to load contractor"
        );

      } finally {
        setLoading(false);
      }

    }

    load();

  }, [contractorId]);


  /* ---------- STATE RENDER ---------- */

  if (!contractorId)
    return <div className="enterprise-page">Invalid contractor route.</div>;

  if (loading)
    return <div className="enterprise-page">Loading contractor...</div>;

  if (error)
    return (
      <div className="enterprise-page">
        <h2>Error</h2>
        <p>{error}</p>
      </div>
    );

  if (!contractor)
    return <div className="enterprise-page">Contractor not found.</div>;


  /* ---------- SAFE CALCULATIONS ---------- */

  const compliance =
    Array.isArray(documents)
      ? calculateCompliance(documents)
      : null;


  /* ---------- MAIN RENDER ---------- */

  return (

    <div className="enterprise-page">

      <Card>

        <IdentityCardHeader
          title={contractor.companyName ?? "Unnamed Contractor"}
          subtitle={contractor.email ?? ""}
        />

        <div style={{ marginTop: 12 }}>

          <Badge>
            {contractor.status ?? "Unknown"}
          </Badge>

          <Badge>
            Compliance {compliance?.score ?? 0}%
          </Badge>

        </div>

      </Card>


      <Card>
        <h2>Documents</h2>

        <Table>

          <thead>
            <tr>
              <th>Name</th>
              <th>Status</th>
              <th>Expires</th>
            </tr>
          </thead>

          <tbody>

            {documents.map((doc) => {

              const risk = getDocumentRisk(doc);

              return (

                <tr key={doc.id}>

                  <td>
                    {resolveDocumentFileName(doc as unknown as Record<string, unknown>)}
                  </td>

                  <td>
                    {risk}
                  </td>

                  <td>
                    {typeof doc.expiresAt === "number"
                      ? new Date(doc.expiresAt).toLocaleDateString()
                      : "—"}
                  </td>

                </tr>

              );

            })}

          </tbody>

        </Table>

      </Card>


      <ContractorDocumentUploader contractorId={contractorId} />

      <TenderPackGeneratorPanel />

      <DocumentExecutionPanel />


    </div>

  );

}
