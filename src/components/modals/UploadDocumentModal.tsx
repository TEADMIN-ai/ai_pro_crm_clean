"use client";

import { useState } from "react";
import { isContractorUploadDocumentType } from "@/lib/compliance/contractorCompliance";
import { uploadContractorDocument } from "@/lib/contractors/uploadContractorDocument";

type ContractorLike = {
  id?: string;
  companyName?: string;
  name?: string;
};

type UploadDocumentModalProps = {
  isOpen: boolean;
  onClose: () => void;
  contractor: ContractorLike | null;
  docType: string | null;
  selectedLabel?: string | null;
};

export default function UploadDocumentModal({
  isOpen,
  onClose,
  contractor,
  docType,
  selectedLabel,
}: UploadDocumentModalProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  async function handleUpload() {
    if (!contractor || !docType || !selectedFile) return;
    if (isUploading) return;

    setIsUploading(true);

    try {
      if (!isContractorUploadDocumentType(docType)) {
        throw new Error("Unsupported contractor document type");
      }

      await uploadContractorDocument(contractor.id, docType, selectedFile);

      onClose();
      setSelectedFile(null);

      window.dispatchEvent(new Event("contractor-updated"));
    } catch (err) {
      console.error("Upload failed", err);
    } finally {
      setIsUploading(false);
    }
  }

  if (!isOpen || !contractor) {
    return null;
  }

  const contractorName = contractor.companyName?.trim() || contractor.name?.trim() || contractor.id || "Contractor";
  const displayLabel = selectedLabel?.trim() || docType?.toUpperCase() || "-";

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-slate-900/40 px-4 py-16">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-bold text-slate-900">
              Upload {displayLabel} Document
            </h2>
            <p className="mt-1 text-sm text-slate-600">
              Contractor: {contractorName}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-600 transition hover:bg-slate-50"
          >
            Close
          </button>
        </div>

        <div className="mt-5 rounded-xl border border-slate-200 bg-slate-50 p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
            Selected Document Type
          </p>
          <p className="mt-1 text-sm font-medium text-slate-800">{displayLabel}</p>
        </div>

        <input
          type="file"
          accept=".pdf,application/pdf"
          onChange={(event) => {
            setSelectedFile(event.target.files?.[0] ?? null);
          }}
          className="mt-5 block w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm text-slate-700"
        />

        <div className="mt-5 flex justify-end gap-3">
          <button
            type="button"
            className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
            onClick={() => {
              setSelectedFile(null);
              onClose();
            }}
          >
            Cancel
          </button>
          <button
            type="button"
            className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:opacity-50"
            onClick={handleUpload}
            disabled={isUploading || !selectedFile}
          >
            {isUploading ? "Uploading..." : "Upload"}
          </button>
        </div>
      </div>
    </div>
  );
}
