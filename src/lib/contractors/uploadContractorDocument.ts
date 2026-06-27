import { authFetch } from "@/lib/client/authFetch";
import { API_ROUTES } from "@/lib/routes";
import type { ContractorUploadDocumentType } from "@/lib/compliance/contractorCompliance";
import type { ContractorDocument } from "@/types/document";

type UploadResponse = {
  document?: ContractorDocument;
  error?: string;
};

export async function uploadContractorDocument(
  contractorId: string,
  documentType: ContractorUploadDocumentType,
  file: File
): Promise<ContractorDocument> {
  if (!contractorId.trim()) {
    throw new Error("Missing contractorId");
  }

  if (!file.name.toLowerCase().endsWith(".pdf")) {
    throw new Error("Only PDF uploads are supported.");
  }

  if (file.type && file.type !== "application/pdf") {
    throw new Error("Invalid file type. Upload a PDF document.");
  }

  const formData = new FormData();
  formData.append("file", file);
  formData.append("contractorId", contractorId);
  formData.append("documentType", documentType);

  const response = await authFetch(API_ROUTES.DOCUMENT_UPLOAD, {
    method: "POST",
    body: formData,
  });

  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as UploadResponse | null;
    throw new Error(payload?.error ?? `Upload failed with ${response.status}`);
  }

  const payload = (await response.json()) as UploadResponse;

  if (!payload.document) {
    throw new Error(payload.error ?? "Upload failed");
  }

  return payload.document;
}
