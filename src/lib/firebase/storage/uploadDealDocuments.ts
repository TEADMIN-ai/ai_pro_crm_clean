import type { Timestamp } from "firebase/firestore";
import type { UserRole } from "@/lib/auth/roleUtils";
import { authFetch } from "@/lib/client/authFetch";
import { API_ROUTES } from "@/lib/routes";

export type DocumentReviewRole = "admin" | "manager";
export type DocumentStatus = "pending" | "approved" | "rejected";

export interface DocumentRecord {
  id: string;
  dealId: string;
  name: string;
  contentType: string;
  size: number;
  storagePath: string;
  downloadURL: string;
  uploadedByUid: string;
  uploadedByRole: Exclude<UserRole, "guest">;
  uploadedAt: Timestamp;
  updatedAt: Timestamp;
  documentType?: string;
  expiryDate?: Timestamp;
  status: DocumentStatus;
  reviewedByUid?: string;
  reviewedByRole?: DocumentReviewRole;
  reviewedAt?: Timestamp;
  rejectionReason?: string;
  version?: number;
}

export async function uploadDealDocuments(
  dealId: string,
  file: File,
  _userId: string,
  userRole: UserRole
) {
  if (!file.name.toLowerCase().endsWith(".pdf")) {
    throw new Error("Only PDF files are allowed.");
  }

  if (userRole === "guest") {
    throw new Error("You do not have permission to upload documents.");
  }

  const formData = new FormData();
  formData.append("file", file);

  const response = await authFetch(API_ROUTES.DEAL_DOCUMENTS(dealId), {
    method: "POST",
    body: formData,
  });

  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as { error?: string } | null;
    throw new Error(payload?.error ?? `Failed to store deal document metadata (${response.status})`);
  }

  const payload = (await response.json()) as {
    document?: { id?: string; downloadURL?: string; storagePath?: string; filePath?: string };
  };

  return {
    id: payload.document?.id ?? "",
    downloadURL: payload.document?.downloadURL ?? "",
    storagePath: payload.document?.storagePath ?? payload.document?.filePath ?? "",
  };
}
