"use client";

import React from "react";
import { generateTenderReport } from "@/lib/reports/generateTenderReport";

type Doc = {
  id?: string;
  name?: string;
  finalStatus?: string;
  extractedText?: string;
  lastActionAt?: string;
  lastActionType?: string;
  suggestions?: string[];
};

export default function DocumentVerificationReviewPanel({
  safeDocs = [],
}: {
  safeDocs: Doc[];
}) {
  return (
    <div>
      {safeDocs.length === 0 && (
        <p className="text-xs text-gray-400">No documents found</p>
      )}

      {safeDocs.map((doc, index) => {
        const isPass = doc?.finalStatus === "PASS";
        const isFail = doc?.finalStatus === "FAIL";
        const isUnknown = !doc?.finalStatus;

        const isExtractionFailed =
          !doc?.extractedText || doc?.extractedText.trim().length === 0;

        const needsManualReview =
          isFail || isExtractionFailed || isUnknown;

        const suggestions = doc?.suggestions || [];

        const docId = doc?.id || index;

        return (
          <div
            key={docId}
            className="mb-4 rounded-lg border border-slate-700 p-3"
          >
            <p className="text-xs text-gray-300 font-semibold">
              {doc?.name || "Document"}
            </p>

            {/* ✅ STATUS DISPLAY */}
            {isPass && (
              <p className="text-green-400 text-xs mt-1">
                Document verified successfully
              </p>
            )}

            {isFail && (
              <p className="text-yellow-300 text-xs mt-1">
                Document failed automated verification
              </p>
            )}

            {/* ✅ SUGGESTIONS */}
            {suggestions.length > 0 && (
              <ul className="mt-2 text-xs text-gray-300">
                {suggestions.map((s, i) => (
                  <li key={i}>• {s}</li>
                ))}
              </ul>
            )}

            {/* ✅ AUDIT DISPLAY */}
            {doc?.lastActionAt && (
              <div className="text-xs text-gray-400 mt-1">
                Last action: {doc?.lastActionType || "updated"} at{" "}
                {new Date(doc.lastActionAt).toLocaleString()}
              </div>
            )}

            {/* ✅ ACTION BUTTONS (PLACEHOLDER SAFE) */}
            {needsManualReview && (
              <div className="mt-2 flex gap-2">
                <button className="px-3 py-1 rounded bg-green-600 text-white text-xs">
                  Approve
                </button>
                <button className="px-3 py-1 rounded bg-red-600 text-white text-xs">
                  Reject
                </button>
              </div>
            )}
          </div>
        );
      })}

      {/* 🔥 REPORT BUTTON — CORRECTLY OUTSIDE LOOP */}
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
        className="px-4 py-2 rounded bg-blue-600 text-white text-sm mt-4"
      >
        Generate Report
      </button>
    </div>
  );
}