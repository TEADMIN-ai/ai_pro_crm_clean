import { addDoc, collection, serverTimestamp, updateDoc, type Timestamp } from "firebase/firestore";
import { getDownloadURL, ref, uploadBytes } from "firebase/storage";
import { db, storage } from "@/lib/firebase/index";
import type { UserRole } from "@/lib/auth/roleUtils";

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

function sanitizeFilename(name: string): string {
  const cleaned = name.replace(/[^a-zA-Z0-9._-]/g, "_");
  return cleaned.length > 0 ? cleaned : "document";
}

export async function uploadDealDocuments(
  dealId: string,
  file: File,
  userId: string,
  userRole: UserRole
) {
  if (!file.name.toLowerCase().endsWith(".pdf")) {
    throw new Error("Only PDF files are allowed.");
  }

  if (userRole === "guest") {
    throw new Error("You do not have permission to upload documents.");
  }

  const timestamp = Date.now();
  const safeFilename = sanitizeFilename(file.name);
  const storagePath = `uploads/deals/${dealId}/${timestamp}_${safeFilename}`;
  const fileRef = ref(storage, storagePath);

  await uploadBytes(fileRef, file, {
    contentType: file.type || "application/pdf",
  });

  const downloadURL = await getDownloadURL(fileRef);

  const documentsRef = collection(db, "deals", dealId, "documents");
  const createdRef = await addDoc(documentsRef, {
    dealId,
    name: file.name,
    contentType: file.type || "application/pdf",
    size: file.size,
    storagePath,
    downloadURL,
    uploadedByUid: userId,
    uploadedByRole: userRole,
    uploadedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    status: "pending",
    version: 1,
  });

  await updateDoc(createdRef, { id: createdRef.id });

  return {
    id: createdRef.id,
    downloadURL,
    storagePath,
  };
}
