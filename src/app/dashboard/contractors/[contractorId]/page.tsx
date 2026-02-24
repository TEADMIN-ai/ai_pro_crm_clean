"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";

import ContractorDocumentUploader from "@/components/contractors/ContractorDocumentUploader";

import { getContractor } from "@/lib/contractors/getContractor";
import { getContractorDocuments } from "@/lib/contractors/getContractorDocuments";

import type { Contractor } from "@/types/contractor";
import type { ContractorDocument } from "@/types/document";
import { calculateCompliance } from "@/lib/compliance/calculateCompliance";
import Card, { IdentityCardHeader } from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import Table from "@/components/ui/Table";
import { useAuth } from "@/context/AuthContext";
import { API_ROUTES } from "@/lib/routes";
import { resolveDocumentFileName } from "@/lib/documents/normalizeDocumentName";

type RiskLabel = "Valid" | "Expiring Soon" | "Expired";

function getDocumentRisk(doc: ContractorDocument): RiskLabel {
  const expiresAt = doc.expiresAt ?? doc.expiryDate ?? null;
  if (!expiresAt) return "Valid";

  const now = Date.now();
  const warningDate = now + (30 * 24 * 60 * 60 * 1000);

  if (expiresAt < now) return "Expired";
  if (expiresAt <= warningDate) return "Expiring Soon";
  return "Valid";
}

function toneForRisk(risk: RiskLabel): "success" | "warning" | "danger" {
  if (risk === "Expired") return "danger";
  if (risk === "Expiring Soon") return "warning";
  return "success";
}

export default function ContractorPage() {
  const { role, user } = useAuth();
  const params = useParams();
  const contractorId = typeof params?.contractorId === "string" ? params.contractorId : null;

  const [contractor, setContractor] = useState<Contractor | null>(null);
  const [documents, setDocuments] = useState<ContractorDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [renamingDocumentId, setRenamingDocumentId] = useState<string | null>(null);

  const compliance = calculateCompliance(documents);

  useEffect(() => {
    if (!contractorId) return;
    const id = contractorId;

    async function load() {
      try {
        setLoading(true);
        setError(null);

        const contractorData = await getContractor(id);
        const documentData = await getContractorDocuments(id);

        setContractor(contractorData);
        setDocuments(documentData);
      } catch (err: any) {
        console.error(err);
        setError(err?.message ?? "Failed to load contractor");
      } finally {
        setLoading(false);
      }
    }

    load();
  }, [contractorId]);

  if (!contractorId) return <div className="enterprise-page">Missing contractorId</div>;
  if (loading) return <div className="enterprise-page">Loading contractor...</div>;
  if (error) return <div className="enterprise-page">{error}</div>;
  if (!contractor) return <div className="enterprise-page">Contractor not found</div>;
  const resolvedContractorId = contractorId;
  const canRename = role === "admin";

  const contractorDisplayName =
    contractor.companyName ?? contractor.contactPerson ?? contractor.name ?? contractor.email ?? "Contractor";

  const complianceTone =
    compliance.compliancePercentage >= 90
      ? "success"
      : compliance.compliancePercentage >= 70
      ? "warning"
      : "danger";

  const statusTone =
    compliance.expired > 0 ? "danger" : compliance.expiringSoon > 0 ? "warning" : "success";

  return (
    <div className="enterprise-page enterprise-grid">
      <Card>
        <IdentityCardHeader title={contractorDisplayName} subtitle={contractor.email ?? "-"}>
          <Badge tone={statusTone}>Status {compliance.status}</Badge>
          <Badge tone={complianceTone}>Compliance {compliance.compliancePercentage}%</Badge>
        </IdentityCardHeader>
      </Card>

      <Card>
        <h2>Compliance Score Summary</h2>
        <div className="compliance-summary">
          <div className="compliance-summary-item">
            <p className="enterprise-metric-label">Valid</p>
            <p className="enterprise-metric-value">{compliance.valid}</p>
          </div>
          <div className="compliance-summary-item">
            <p className="enterprise-metric-label">Expiring</p>
            <p className="enterprise-metric-value">{compliance.expiring}</p>
          </div>
          <div className="compliance-summary-item">
            <p className="enterprise-metric-label">Expired</p>
            <p className="enterprise-metric-value">{compliance.expired}</p>
          </div>
          <div className="compliance-summary-item">
            <p className="enterprise-metric-label">Compliance Percentage</p>
            <p className="enterprise-metric-value">{compliance.compliancePercentage}%</p>
          </div>
        </div>
      </Card>

      <Card>
        <h2>Upload Compliance Document</h2>
        <p>Add supporting documents to keep this contractor compliant.</p>
        <ContractorDocumentUploader
          contractorId={resolvedContractorId}
          onUploadedAction={async () => {
            const updated = await getContractorDocuments(resolvedContractorId);
            setDocuments(updated);
          }}
        />
      </Card>

      <Card>
        <h2>Premium Compliance Table</h2>
        {documents.length === 0 ? (
          <div>No contractor documents uploaded yet.</div>
        ) : (
          <Table>
            <thead>
              <tr>
                <th>Document Name</th>
                <th>Name Status</th>
                <th>Document Type</th>
                <th>Status Badge</th>
                <th>Expiry Date</th>
                <th>Risk Indicator</th>
                {canRename && <th>Actions</th>}
              </tr>
            </thead>
            <tbody>
              {documents.map((doc) => {
                const risk = getDocumentRisk(doc);
                const expiresAt = doc.expiresAt ?? doc.expiryDate ?? null;
                const documentName = resolveDocumentFileName(doc as unknown as Record<string, unknown>);
                const unresolvedName = documentName === "Recovered document";

                return (
                  <tr key={doc.id}>
                    <td>{documentName}</td>
                    <td>
                      {unresolvedName ? (
                        <Badge tone="warning">NEEDS NAME</Badge>
                      ) : (
                        <Badge tone="success">OK</Badge>
                      )}
                    </td>
                    <td>{doc.docType ?? "general"}</td>
                    <td><Badge tone={toneForRisk(risk)}>{doc.status ?? "active"}</Badge></td>
                    <td>{expiresAt ? new Date(expiresAt).toLocaleDateString() : "-"}</td>
                    <td><Badge tone={toneForRisk(risk)}>{risk}</Badge></td>
                    {canRename && (
                      <td>
                        <button
                          disabled={renamingDocumentId === doc.id}
                          onClick={async () => {
                            if (!user || !contractorId) return;

                            const suggestedName =
                              documentName === "Recovered document"
                                ? (doc.originalName ?? "")
                                : documentName;
                            const nextName = window.prompt("Set display name", suggestedName)?.trim();
                            if (!nextName) return;

                            try {
                              setRenamingDocumentId(doc.id);
                              const token = await user.getIdToken(true);
                              const response = await fetch(API_ROUTES.CONTRACTOR_DOCUMENTS(contractorId), {
                                method: "PATCH",
                                headers: {
                                  "Content-Type": "application/json",
                                  Authorization: `Bearer ${token}`,
                                },
                                body: JSON.stringify({
                                  documentId: doc.id,
                                  fileName: nextName,
                                }),
                              });

                              if (!response.ok) {
                                const text = await response.text();
                                throw new Error(text || "Failed to rename document");
                              }

                              const updated = await getContractorDocuments(resolvedContractorId);
                              setDocuments(updated);
                            } catch (renameError: any) {
                              console.error(renameError);
                              setError(renameError?.message ?? "Failed to rename document");
                            } finally {
                              setRenamingDocumentId(null);
                            }
                          }}
                        >
                          {renamingDocumentId === doc.id ? "Saving..." : "Rename"}
                        </button>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </Table>
        )}
      </Card>
    </div>
  );
}
