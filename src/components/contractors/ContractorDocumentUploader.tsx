"use client";

import { useMemo, useState } from "react";
import Card from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import {
  getDocumentTypeLabel,
  SUPPORTED_DOCUMENT_TYPES,
  type SupportedDocumentType,
} from "@/lib/compliance/contractorCompliance";
import { uploadContractorDocument } from "@/lib/contractors/uploadContractorDocument";
import type { ContractorDocument } from "@/types/document";

type Props = {
  contractorId: string;
  documents: ContractorDocument[];
  onUploadedAction?: () => void | Promise<void>;
};

export default function ContractorDocumentUploader({
  contractorId,
  documents,
  onUploadedAction,
}: Props) {
  const [files, setFiles] = useState<Partial<Record<SupportedDocumentType, File>>>({});
  const [uploadingType, setUploadingType] = useState<SupportedDocumentType | null>(null);
  const [error, setError] = useState<string | null>(null);

  const documentsByType = useMemo(() => {
    return new Map(
      documents
        .filter((document) => typeof document.documentType === "string")
        .map((document) => [document.documentType as SupportedDocumentType, document])
    );
  }, [documents]);

  async function handleUpload(documentType: SupportedDocumentType) {
    const file = files[documentType];

    if (!file) {
      setError("Choose a PDF before uploading.");
      return;
    }

    try {
      setUploadingType(documentType);
      setError(null);
      await uploadContractorDocument(contractorId, documentType, file);
      setFiles((current) => {
        const next = { ...current };
        delete next[documentType];
        return next;
      });

      if (onUploadedAction) {
        await onUploadedAction();
      }
    } catch (uploadError) {
      console.error(uploadError);
      setError(uploadError instanceof Error ? uploadError.message : "Upload failed");
    } finally {
      setUploadingType(null);
    }
  }

  return (
    <Card>
      <h2>Compliance Documents</h2>
      <p>Upload required PDF compliance documents. Replacing a file updates readiness automatically.</p>
      {error && <p style={{ color: "#b91c1c" }}>{error}</p>}

      <div style={{ display: "grid", gap: 14 }}>
        {SUPPORTED_DOCUMENT_TYPES.map((documentType) => {
          const currentDocument = documentsByType.get(documentType);
          const isUploading = uploadingType === documentType;

          return (
            <div
              key={documentType}
              style={{
                display: "grid",
                gap: 10,
                padding: 14,
                border: "1px solid rgba(148, 163, 184, 0.25)",
                borderRadius: 12,
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                <strong>{getDocumentTypeLabel(documentType)}</strong>
                <Badge tone={currentDocument?.fileUrl ? "success" : "warning"}>
                  {currentDocument?.fileUrl ? "Uploaded" : "Missing"}
                </Badge>
              </div>

              <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
                <input
                  type="file"
                  accept="application/pdf,.pdf"
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (!file) {
                      return;
                    }

                    setFiles((current) => ({
                      ...current,
                      [documentType]: file,
                    }));
                  }}
                />

                <button type="button" disabled={isUploading || !files[documentType]} onClick={() => handleUpload(documentType)}>
                  {isUploading ? "Uploading..." : currentDocument?.fileUrl ? "Replace document" : "Upload document"}
                </button>

                {currentDocument?.fileUrl && (
                  <a href={currentDocument.fileUrl} target="_blank" rel="noreferrer noopener">
                    View document
                  </a>
                )}
              </div>

              <div style={{ fontSize: 13, opacity: 0.8 }}>
                Status: {currentDocument?.verified ? "Verified" : currentDocument?.fileUrl ? "Uploaded" : "Not uploaded"}
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}
