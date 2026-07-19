"use client";

import { useMemo, useState } from "react";
import Card from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import {
  getDocumentTypeLabel,
  SUPPORTED_DOCUMENT_TYPES,
  type SupportedDocumentType,
} from "@/lib/compliance/contractorCompliance";
import { API_ROUTES } from "@/lib/apiRoutes";
import { authFetch } from "@/lib/client/authFetch";
import {
  hasContractorDocumentViewLocator,
  openContractorDocument,
} from "@/lib/contractors/contractorDocumentViewer";
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
  const [openingType, setOpeningType] = useState<SupportedDocumentType | null>(null);
  const [reprocessingType, setReprocessingType] = useState<SupportedDocumentType | null>(null);
  const [reprocessStatus, setReprocessStatus] = useState<Partial<Record<SupportedDocumentType, string>>>({});
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

  async function handleView(documentType: SupportedDocumentType, document: ContractorDocument) {
    if (!hasContractorDocumentViewLocator(document) || openingType) {
      return;
    }

    try {
      setOpeningType(documentType);
      setError(null);
      await openContractorDocument({ contractorId, documentType });
    } catch (viewError) {
      setError(viewError instanceof Error ? viewError.message : "Failed to open document");
    } finally {
      setOpeningType(null);
    }
  }

  async function handleReprocess(documentType: SupportedDocumentType) {
    if (reprocessingType) {
      return;
    }

    try {
      setReprocessingType(documentType);
      setReprocessStatus((current) => ({ ...current, [documentType]: "Processing..." }));
      setError(null);

      const response = await authFetch(API_ROUTES.CONTRACTOR_DOCUMENT_EXECUTE(contractorId, documentType), {
        method: "POST",
        headers: {
          Accept: "application/json",
        },
        cache: "no-store",
      });
      const payload = (await response.json().catch(() => null)) as { error?: string } | null;

      if (!response.ok) {
        throw new Error(payload?.error ?? `Reprocess failed with ${response.status}`);
      }

      setReprocessStatus((current) => ({ ...current, [documentType]: "Success" }));

      if (onUploadedAction) {
        await onUploadedAction();
      }
    } catch (reprocessError) {
      setReprocessStatus((current) => ({ ...current, [documentType]: "Failed" }));
      setError(reprocessError instanceof Error ? reprocessError.message : "Reprocess failed");
    } finally {
      setReprocessingType(null);
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
          const canViewDocument = Boolean(currentDocument && hasContractorDocumentViewLocator(currentDocument));
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
                <Badge tone={canViewDocument ? "success" : "warning"}>
                  {canViewDocument ? "Uploaded" : "Missing"}
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
                  {isUploading ? "Uploading..." : canViewDocument ? "Replace document" : "Upload document"}
                </button>

                {currentDocument && canViewDocument && (
                  <>
                    <button
                      type="button"
                      disabled={openingType === documentType}
                      onClick={() => handleView(documentType, currentDocument)}
                    >
                      {openingType === documentType ? "Opening..." : "View document"}
                    </button>
                    <button
                      type="button"
                      disabled={reprocessingType === documentType}
                      onClick={() => handleReprocess(documentType)}
                    >
                      {reprocessingType === documentType ? "Processing..." : "Reprocess"}
                    </button>
                  </>
                )}
              </div>

              <div style={{ fontSize: 13, opacity: 0.8 }}>
                Status: {currentDocument?.verified ? "AI Processed" : canViewDocument ? "Uploaded" : "Not uploaded"}
                {reprocessStatus[documentType] ? ` - ${reprocessStatus[documentType]}` : ""}
              </div>
              {currentDocument && canViewDocument ? (
                <div style={{ display: "grid", gap: 4, fontSize: 12, color: "#475569" }}>
                  <span>Extraction Source: {currentDocument.extractionSource ?? "Not recorded"}</span>
                  <span>Text Length: {currentDocument.extractedTextLength ?? 0} chars</span>
                  <span>OCR Length: {currentDocument.ocrTextLength ?? 0} chars</span>
                  <span>Last Analysis Time: {currentDocument.analysisTimestamp ? new Date(currentDocument.analysisTimestamp).toLocaleString("en-ZA") : "Not recorded"}</span>
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    </Card>
  );
}
