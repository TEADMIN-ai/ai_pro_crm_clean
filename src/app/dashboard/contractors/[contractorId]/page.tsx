"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import ContractorDocumentUploader from "@/components/contractors/ContractorDocumentUploader";
import ComplianceRadar from "@/components/intelligence/ComplianceRadar";
import DocumentExecutionPanel from "@/components/documents/DocumentExecutionPanel";
import TenderPackGeneratorPanel from "@/components/documents/TenderPackGeneratorPanel";
import Badge from "@/components/ui/Badge";
import Card, { IdentityCardHeader } from "@/components/ui/Card";
import Table from "@/components/ui/Table";
import { useAuth } from "@/context/AuthContext";
import { calculateContractorCompliance } from "@/lib/compliance/contractorCompliance";
import { authFetch } from "@/lib/client/authFetch";
import { getContractorDocuments } from "@/lib/contractors/getContractorDocuments";
import { API_ROUTES } from "@/lib/routes";
import type { Contractor } from "@/types/contractor";
import type { ContractorDocument } from "@/types/document";

type ContractorApiPayload = Contractor & {
  readinessScore?: number;
  docsMissing?: number;
  tenderLockStatus?: "READY" | "RISK" | "BLOCKED";
  isTenderLocked?: boolean;
};

function formatDate(value?: number): string {
  return typeof value === "number" ? new Date(value).toLocaleDateString() : "-";
}

function resolveDocumentStatus(document: ContractorDocument): "Uploaded" | "Verified" | "Expired" | "Invalid" | "Missing" {
  if (!document.fileUrl) {
    return "Missing";
  }

  if (typeof document.expiresAt === "number" && document.expiresAt < Date.now()) {
    return "Expired";
  }

  if (document.status === "expired") {
    return "Expired";
  }

  if (document.verified || document.status === "verified") {
    return "Verified";
  }

  if (document.status === "invalid") {
    return "Invalid";
  }

  return "Uploaded";
}

function renderMissingFields(document: ContractorDocument): string {
  if (document.missingFields && document.missingFields.length > 0) {
    return document.missingFields.join(", ");
  }

  if (document.validationErrors && document.validationErrors.length > 0) {
    return document.validationErrors.join(", ");
  }

  return "-";
}

function renderExtractedData(document: ContractorDocument): string {
  const fields = document.extractedFields ?? document.extractedData;
  if (!fields) {
    return "-";
  }

  const pairs = Object.entries(fields)
    .filter(([, value]) => typeof value === "string" && value.trim().length > 0)
    .slice(0, 4)
    .map(([key, value]) => `${key}: ${value}`);

  return pairs.length > 0 ? pairs.join(" | ") : "-";
}

function renderExtractedSummary(document: ContractorDocument): string {
  const fields = document.extractedFields ?? {};

  switch (document.documentType ?? document.docType) {
    case "cipc":
      return fields.companyRegistrationNumber ? `Reg Number: ${fields.companyRegistrationNumber}` : "-";
    case "bbbee":
      if (fields.beeLevel && fields.expiryDate) {
        return `Level: ${fields.beeLevel} | Expires: ${fields.expiryDate}`;
      }
      if (fields.beeLevel) {
        return `Level: ${fields.beeLevel}`;
      }
      return fields.expiryDate ? `Expires: ${fields.expiryDate}` : "-";
    case "taxClearance":
      if (fields.taxPin && fields.expiryDate) {
        return `Tax PIN: ${fields.taxPin} | Expires: ${fields.expiryDate}`;
      }
      return fields.taxPin ? `Tax PIN: ${fields.taxPin}` : "-";
    case "coida":
      if (fields.employerRegistrationNumber && fields.expiryDate) {
        return `Reg Number: ${fields.employerRegistrationNumber} | Expires: ${fields.expiryDate}`;
      }
      return fields.employerRegistrationNumber ? `Reg Number: ${fields.employerRegistrationNumber}` : "-";
    case "bankConfirmation":
      if (fields.bankName && fields.accountNumber) {
        return `${fields.bankName} | Acc: ${fields.accountNumber}`;
      }
      return fields.bankName ? `Bank: ${fields.bankName}` : "-";
    default:
      return "-";
  }
}

export default function ContractorDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { user, role, loading: authLoading } = useAuth();
  const contractorId = typeof params?.contractorId === "string" ? params.contractorId : Array.isArray(params?.contractorId) ? params.contractorId[0] : null;

  const [contractor, setContractor] = useState<ContractorApiPayload | null>(null);
  const [documents, setDocuments] = useState<ContractorDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function loadPage(currentContractorId: string) {
    setLoading(true);
    setError(null);

    try {
      const [contractorResponse, docs] = await Promise.all([
        authFetch(API_ROUTES.CONTRACTOR_DETAIL(currentContractorId)),
        getContractorDocuments(currentContractorId),
      ]);

      if (!contractorResponse.ok) {
        throw new Error(`API returned ${contractorResponse.status}`);
      }

      const payload = (await contractorResponse.json()) as ContractorApiPayload & { error?: string };

      if (!payload?.id) {
        throw new Error(payload.error ?? "Invalid contractor payload");
      }

      setContractor(payload);
      setDocuments(docs);
    } catch (loadError) {
      console.error("Contractor load error:", loadError);
      setError(loadError instanceof Error ? loadError.message : "Failed to load contractor");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (authLoading || !contractorId) {
      return;
    }

    if (role === "contractor") {
      if (!user?.contractorId) {
        router.replace("/dashboard");
        return;
      }

      if (user.contractorId !== contractorId) {
        router.replace(`/dashboard/contractors/${encodeURIComponent(user.contractorId)}`);
        return;
      }
    }

    void loadPage(contractorId);
  }, [authLoading, contractorId, role, router, user?.contractorId]);

  const compliance = useMemo(() => calculateContractorCompliance(documents), [documents]);
  const readinessScore = contractor?.readinessScore ?? compliance.readinessScore;
  const docsMissing = contractor?.docsMissing ?? compliance.docsMissing;
  const tenderLockStatus = contractor?.tenderLockStatus ?? compliance.tenderLockStatus;
  const isTenderLocked = contractor?.isTenderLocked ?? compliance.isTenderLocked;

  if (!contractorId) {
    return <div className="enterprise-page">Invalid contractor route.</div>;
  }

  if (authLoading || loading) {
    return <div className="enterprise-page">Loading contractor...</div>;
  }

  if (error) {
    return (
      <div className="enterprise-page">
        <h2>Error</h2>
        <p>{error}</p>
      </div>
    );
  }

  if (!contractor) {
    return <div className="enterprise-page">Contractor not found.</div>;
  }

  return (
    <div className="enterprise-page">
      <Card>
        <IdentityCardHeader title={contractor.companyName ?? contractor.name ?? "Unnamed Contractor"} subtitle={contractor.email ?? ""} />
        <div style={{ marginTop: 12, display: "flex", gap: 10, flexWrap: "wrap" }}>
          <Badge>{contractor.status ?? "Unknown"}</Badge>
          <Badge>{readinessScore}% readiness</Badge>
          <Badge>{tenderLockStatus}</Badge>
        </div>
      </Card>

      <Card>
        <h2>Compliance Summary</h2>
        <p>Missing documents: {docsMissing}</p>
        <p>TenderLock: {isTenderLocked ? "Locked" : "Open"}</p>
        <p>CIPC Reg Number: {contractor.companyRegistrationNumber ?? "-"}</p>
        <p>BBBEE Level: {contractor.bbbeeLevel ?? "-"}</p>
        <p>Tax Clearance Expiry: {formatDate(contractor.taxClearanceExpiry ?? undefined)}</p>
        <p>COIDA Expiry: {formatDate(contractor.coidaExpiry ?? undefined)}</p>
        <p>Bank Verified: {contractor.bankVerified ? "Yes" : "No"}</p>
      </Card>

      <ContractorDocumentUploader
        contractorId={contractorId}
        documents={documents}
        onUploadedAction={() => loadPage(contractorId)}
      />

      <ComplianceRadar
        contractorId={contractorId}
        refreshKey={`${contractor?.readinessScore ?? readinessScore}-${contractor?.docsMissing ?? docsMissing}-${contractor?.isTenderLocked ?? isTenderLocked}`}
      />

      <Card>
        <h2>Document Register</h2>
        <Table>
          <thead>
            <tr>
              <th>Document</th>
              <th>Validation Status</th>
              <th>Missing Fields</th>
              <th>AI Extracted Data</th>
              <th>Extracted Data</th>
              <th>Uploaded</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {documents.map((document) => (
              <tr key={document.id}>
                <td>{document.documentName ?? document.fileName ?? document.id}</td>
                <td>{resolveDocumentStatus(document)}</td>
                <td>{renderMissingFields(document)}</td>
                <td>{renderExtractedData(document)}</td>
                <td>{renderExtractedSummary(document)}</td>
                <td>{formatDate(document.uploadedAt)}</td>
                <td>
                  {document.fileUrl ? (
                    <a href={document.fileUrl} target="_blank" rel="noreferrer noopener">
                      View document
                    </a>
                  ) : (
                    "Awaiting upload"
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </Table>
      </Card>

      <TenderPackGeneratorPanel />
      <DocumentExecutionPanel />
    </div>
  );
}
