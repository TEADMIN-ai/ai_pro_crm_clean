"use client";

import React from "react";
import ContractorDocumentVerificationReviewPanel from "@/components/contractors/DocumentVerificationReviewPanel";
import { generateTenderReport } from "@/lib/reports/generateTenderReport";
import type { ContractorDocument } from "@/types/document";

type LegacyDoc = {
  id?: string;
  name?: string;
  finalStatus?: string;
  extractedText?: string;
  lastActionAt?: string;
  lastActionType?: string;
  suggestions?: string[];
};

type ReviewPanelDocument = ContractorDocument & {
  extractedText?: string;
  lastActionAt?: string;
  lastActionType?: string;
};

type Props = {
  contractorId?: string;
  dealId?: string;
  documents?: ReviewPanelDocument[];
  safeDocs?: LegacyDoc[];
  canReview?: boolean;
  onUpdatedAction?: () => void | Promise<void>;
};

function mapLegacyDocToContractorDocument(doc: LegacyDoc, index: number): ReviewPanelDocument {
  const normalizedStatus =
    doc.finalStatus === "PASS" || doc.finalStatus === "REVIEW" || doc.finalStatus === "FAIL"
      ? doc.finalStatus
      : undefined;

  return {
    id: doc.id ?? `legacy-doc-${index}`,
    contractorId: "",
    documentName: doc.name ?? "Document",
    finalStatus: normalizedStatus,
    validationStatus: normalizedStatus,
    suggestions: Array.isArray(doc.suggestions) ? doc.suggestions : [],
    extractedText: doc.extractedText,
    lastActionAt: doc.lastActionAt,
    lastActionType: doc.lastActionType,
  };
}

function normalizeDocuments(documents: ReviewPanelDocument[] | undefined, safeDocs: LegacyDoc[] | undefined) {
  if (Array.isArray(documents) && documents.length > 0) {
    return documents;
  }

  if (Array.isArray(safeDocs) && safeDocs.length > 0) {
    return safeDocs.map(mapLegacyDocToContractorDocument);
  }

  return [];
}

export default function DocumentVerificationReviewPanel({
  contractorId,
  dealId,
  documents,
  safeDocs,
  canReview = true,
  onUpdatedAction,
}: Props) {
  const normalizedDocuments = normalizeDocuments(documents, safeDocs);

  return (
    <div>
      <ContractorDocumentVerificationReviewPanel
        contractorId={contractorId}
        dealId={dealId}
        documents={normalizedDocuments}
        canReview={canReview}
        onUpdatedAction={onUpdatedAction}
      />

      {Array.isArray(safeDocs) && safeDocs.length > 0 && (
        <button
          onClick={() => {
            const report = generateTenderReport({
              clientName: "Test Client",
              documents: safeDocs.map((doc) => ({
                name: doc.name,
                status: doc.lastActionType,
              })),
              complianceScore: 100,
              approvedBy: "Torque Empire",
            });

            console.log(report);
            alert("Report generated! Check console.");
          }}
          className="mt-4 rounded bg-blue-600 px-4 py-2 text-sm text-white"
        >
          Generate Report
        </button>
      )}
    </div>
  );
}
