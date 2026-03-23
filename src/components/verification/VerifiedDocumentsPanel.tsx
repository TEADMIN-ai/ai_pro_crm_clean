"use client";

import React from "react";

type VerifiedDocumentItem = {
  id?: string | number;
  name?: string;
  fileName?: string;
  documentName?: string;
  originalName?: string;
  verified?: boolean;
  verifiedBy?: string;
  verifiedAt?: string | number | Date | null;
};

type Props = {
  documents?: VerifiedDocumentItem[];
};

function getDocumentLabel(doc: VerifiedDocumentItem): string {
  return doc.name || doc.documentName || doc.fileName || doc.originalName || "Document";
}

function formatVerifiedAt(value: VerifiedDocumentItem["verifiedAt"]): string {
  if (!value) {
    return "No timestamp";
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "No timestamp" : date.toLocaleString();
}

export default function VerifiedDocumentsPanel({ documents = [] }: Props) {
  const verifiedDocs = documents.filter((doc) => doc?.verified === true);

  if (!verifiedDocs.length) {
    return <div className="text-sm text-gray-400">No verified documents yet.</div>;
  }

  return (
    <div className="space-y-3">
      {verifiedDocs.map((doc, idx) => (
        <div
          key={doc.id ?? idx}
          className="rounded-lg border border-green-500/30 bg-green-900/10 p-3"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-white">{getDocumentLabel(doc)}</p>

              <p className="text-xs text-gray-400">Verified by: {doc.verifiedBy || "Unknown"}</p>

              <p className="text-xs text-gray-500">{formatVerifiedAt(doc.verifiedAt)}</p>
            </div>

            <span className="text-xs font-bold text-green-400">VERIFIED</span>
          </div>
        </div>
      ))}
    </div>
  );
}
