"use client";

import React, { useEffect, useState } from "react";
import ContractorDocumentVerificationReviewPanel from "@/components/contractors/DocumentVerificationReviewPanel";
import { API_ROUTES } from "@/lib/apiRoutes";
import { generateTenderReport } from "@/lib/reports/generateTenderReport";
import type { ContractorDocument } from "@/types/document";

type ReviewPanelDocument = ContractorDocument & {
  name?: string;
  extractedText?: string;
  lastActionAt?: string;
  lastActionType?: string;
};

type Props = {
  dealId?: string;
};

export default function DocumentVerificationReviewPanel({
  dealId,
}: Props) {
  const [safeDocs, setSafeDocs] = useState<ReviewPanelDocument[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchDocs = async () => {
      try {
        const res = await fetch(`${API_ROUTES.DOCUMENTS}?dealId=${dealId}`);
        const data = (await res.json()) as { documents?: ReviewPanelDocument[] };
        setSafeDocs(Array.isArray(data.documents) ? data.documents : []);
      } catch (err) {
        console.error("Document fetch failed:", err);
      } finally {
        setLoading(false);
      }
    };

    if (dealId) {
      void fetchDocs();
      return;
    }

    setSafeDocs([]);
    setLoading(false);
  }, [dealId]);

  if (loading) {
    return <div className="text-gray-400">Loading verification data...</div>;
  }

  return (
    <div>
      <ContractorDocumentVerificationReviewPanel
        dealId={dealId}
        documents={safeDocs}
      />

      {Array.isArray(safeDocs) && safeDocs.length > 0 && (
        <button
          onClick={() => {
            const report = generateTenderReport({
              clientName: "Test Client",
              documents: safeDocs.map((doc) => ({
                name: doc.name ?? doc.documentName,
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
