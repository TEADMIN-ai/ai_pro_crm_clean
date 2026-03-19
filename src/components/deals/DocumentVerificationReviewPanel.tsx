"use client";

import React from "react";

type DocumentItem = {
  id?: string;
  name?: string;
  extractedText?: string;
  finalStatus?: "PASS" | "FAIL";
  verified?: boolean;
  suggestions?: string[];
};

interface Props {
  dealId?: string;
  contractorId?: string;
  documents?: unknown[];
  canReview?: boolean;
  onUpdatedAction?: () => void | Promise<void>;
}

export default function DocumentVerificationReviewPanel({ dealId }: Props) {
  const documents: DocumentItem[] = [];

  const safeDocs = documents || [];

  const handleManualApprove = (id: string) => {
    console.log("Sending documentId:", id);
    console.log("Manual approve:", id);
  };

  const handleManualReject = (id: string) => {
    console.log("Sending documentId:", id);
    console.log("Manual reject:", id);
  };

  return (
    <div className="rounded-xl border border-slate-700 bg-slate-900 p-4">
      <h2 className="text-sm font-semibold text-white mb-4">
        Document Verification
      </h2>

      {safeDocs.length === 0 && (
        <p className="text-xs text-gray-400">No documents found</p>
      )}

      {safeDocs.map((doc, index) => {
        const isPass = doc?.finalStatus === "PASS";
        const isFail = doc?.finalStatus === "FAIL";
        const isUnknown = !doc?.finalStatus;

        const isExtractionFailed =
          !doc?.extractedText ||
          doc?.extractedText.trim().length === 0;

        const needsManualReview =
          isFail || isExtractionFailed || isUnknown;

        const suggestions = doc?.suggestions || [];
        const docId = doc?.id || "";

        return (
          <div
            key={docId || index}
            className="mb-4 rounded-lg border border-slate-700 p-3"
          >
            <p className="text-xs text-gray-300 font-medium">
              {doc?.name || "Document"}
            </p>

            {isPass && (
              <p className="text-green-400 text-xs mt-2">
                Document verified successfully
              </p>
            )}

            {isFail && (
              <p className="text-yellow-300 text-xs mt-2">
                Document failed automated verification
              </p>
            )}

            {suggestions.length > 0 && (
              <ul className="mt-2 text-xs text-gray-400 list-disc list-inside">
                {suggestions.map((s, i) => (
                  <li key={i}>{s}</li>
                ))}
              </ul>
            )}

            {needsManualReview && (
              <div className="flex gap-2 mt-3">
                <button
                  onClick={() => handleManualApprove(docId)}
                  className="px-3 py-1 rounded bg-green-600 text-white text-xs"
                >
                  Approve
                </button>

                <button
                  onClick={() => handleManualReject(docId)}
                  className="px-3 py-1 rounded bg-red-600 text-white text-xs"
                >
                  Reject
                </button>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
