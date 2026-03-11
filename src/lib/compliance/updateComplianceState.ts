import { FieldValue, type Firestore } from "firebase-admin/firestore";
import { type ComplianceAnalysisResult } from "@/lib/compliance/analyzeComplianceDocument";
import { type SupportedDocumentType } from "@/lib/compliance/contractorCompliance";

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
  const verifiedAt = analysis.verified ? FieldValue.serverTimestamp() : null;

  await db.collection("contractors").doc(contractorId).collection("complianceData").doc(analysis.documentType).set(
    {
      documentType: analysis.documentType,
      extractedAt: now,
      extractedFields: analysis.extractedFields,
      confidenceScore: analysis.confidenceScore,
      expiresAt: analysis.expiresAt,
      verified: analysis.verified,
      verifiedAt,
      validationError: analysis.validationError,
      status: analysis.status,
      updatedAt: now,
    },
    { merge: true }
  );

  await db.collection("contractors").doc(contractorId).collection("documents").doc(analysis.documentType).set(
    {
      extractedAt: now,
      extractedFields: analysis.extractedFields,
      confidenceScore: analysis.confidenceScore,
      expiresAt: analysis.expiresAt,
      verified: analysis.verified,
      verifiedAt,
      validationError: analysis.validationError,
      status: analysis.status,
      updatedAt: now,
    },
    { merge: true }
  );

  await db.collection("contractors").doc(contractorId).set(
    {
      ...buildContractorSummaryUpdates(
        analysis.documentType,
        analysis.extractedFields,
        analysis.expiresAt,
        analysis.verified
      ),
      updatedAt: now.toISOString(),
    },
    { merge: true }
  );
}
