import type { Firestore } from "firebase-admin/firestore";
import type { ComplianceAnalysisResult } from "@/lib/compliance/analyzeComplianceDocument";
import { type SupportedDocumentType } from "@/lib/compliance/contractorCompliance";

function parseIsoDate(value: unknown): number | null {
  if (typeof value !== "string" || !value.trim()) {
    return null;
  }

  const match = value.trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) {
    return null;
  }

  const [, year, month, day] = match;
  const timestamp = Date.UTC(Number(year), Number(month) - 1, Number(day));
  return Number.isFinite(timestamp) ? timestamp : null;
}

function getDocumentExpiry(documentType: SupportedDocumentType, fields: Record<string, string | null>): number | null {
  switch (documentType) {
    case "bbbee":
    case "taxClearance":
    case "coida":
      return parseIsoDate(fields.expiryDate);
    default:
      return null;
  }
}

function hasExtractedValues(fields: Record<string, string | null>): boolean {
  return Object.values(fields).some((value) => typeof value === "string" && value.trim().length > 0);
}

function resolveDocumentStatus(expiresAt: number | null, verified: boolean): "uploaded" | "verified" | "expired" {
  if (typeof expiresAt === "number" && expiresAt < Date.now()) {
    return "expired";
  }

  return verified ? "verified" : "uploaded";
}

function buildContractorSummaryUpdates(
  documentType: SupportedDocumentType,
  fields: Record<string, string | null>,
  expiresAt: number | null,
  verified: boolean
): Record<string, unknown> {
  switch (documentType) {
    case "cipc":
      return {
        companyRegistrationNumber: fields.companyRegistrationNumber ?? null,
        companyName: fields.companyName ?? null,
      };
    case "bbbee":
      return {
        bbbeeLevel: fields.beeLevel ?? null,
      };
    case "taxClearance":
      return {
        taxPin: fields.taxPin ?? null,
        taxpayerName: fields.taxpayerName ?? null,
        taxClearanceExpiry: expiresAt,
      };
    case "coida":
      return {
        coidaRegistrationNumber: fields.employerRegistrationNumber ?? null,
        coidaExpiry: expiresAt,
      };
    case "bankConfirmation":
      return {
        bankVerified: verified,
        bankName: fields.bankName ?? null,
        bankAccountHolder: fields.accountHolder ?? null,
        bankAccountNumber: fields.accountNumber ?? null,
        bankBranchCode: fields.branchCode ?? null,
      };
  }
}

export async function updateComplianceState(
  db: Firestore,
  contractorId: string,
  analysis: ComplianceAnalysisResult
): Promise<void> {
  const now = new Date();
  const expiresAt = getDocumentExpiry(analysis.documentType, analysis.extractedFields);
  const verified = hasExtractedValues(analysis.extractedFields);
  const status = resolveDocumentStatus(expiresAt, verified);

  await db.collection("contractors").doc(contractorId).collection("complianceData").doc(analysis.documentType).set(
    {
      documentType: analysis.documentType,
      extractedAt: now,
      extractedFields: analysis.extractedFields,
      confidenceScore: analysis.confidenceScore,
      expiresAt,
      verified,
      status,
      updatedAt: now,
    },
    { merge: true }
  );

  await db.collection("contractors").doc(contractorId).collection("documents").doc(analysis.documentType).set(
    {
      extractedAt: now,
      extractedFields: analysis.extractedFields,
      confidenceScore: analysis.confidenceScore,
      expiresAt,
      verified,
      status,
      updatedAt: now,
    },
    { merge: true }
  );

  await db.collection("contractors").doc(contractorId).set(
    {
      ...buildContractorSummaryUpdates(analysis.documentType, analysis.extractedFields, expiresAt, verified),
      updatedAt: now.toISOString(),
    },
    { merge: true }
  );
}
