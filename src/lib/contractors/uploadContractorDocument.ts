import { getDownloadURL, ref, uploadBytes } from "firebase/storage";
import { authFetch } from "@/lib/client/authFetch";
import {
  getDocumentTypeLabel,
  type SupportedDocumentType,
} from "@/lib/compliance/contractorCompliance";
import { storage } from "@/lib/firebase";
import { API_ROUTES } from "@/lib/routes";
import type { ContractorDocument } from "@/types/document";

type UploadResponse = {
  document?: ContractorDocument;
  error?: string;
};

export async function uploadContractorDocument(
  contractorId: string,
  documentType: SupportedDocumentType,
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

  const storagePath = `contractors/${contractorId}/${documentType}.pdf`;
  const storageRef = ref(storage, storagePath);

  await uploadBytes(storageRef, file, {
    contentType: file.type || "application/pdf",
  });

  const fileUrl = await getDownloadURL(storageRef);
  const documentName = `${getDocumentTypeLabel(documentType)}.pdf`;

  // The server route persists metadata and runs the compliance scanner before returning.
  const response = await authFetch(API_ROUTES.CONTRACTOR_DOCUMENTS(contractorId), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      documentType,
      documentName,
      storagePath,
      fileUrl,
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || `Upload metadata failed with ${response.status}`);
  }

  const payload = (await response.json()) as UploadResponse;

  if (!payload.document) {
    throw new Error(payload.error ?? "Upload failed");
  }

  return payload.document;
}
