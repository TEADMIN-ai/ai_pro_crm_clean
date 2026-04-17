import { NextRequest, NextResponse } from "next/server";
import { QueryDocumentSnapshot, type DocumentData } from "firebase-admin/firestore";
import { resolveDocumentUrl } from "@/lib/documents/resolveDocumentUrl";
import {
  AuthorizationError,
  isPrivilegedRole,
  requireAuthorizedUser,
} from "@/lib/server/authz";
import { getFirebaseAdmin } from "@/lib/firebase/admin";

export const runtime = "nodejs";

type DocumentListItem = {
  id: string;
  contractorId?: string;
  documentType?: string;
  documentName?: string;
  fileName: string;
  filePath?: string;
  storagePath?: string;
  uploadedBy?: string;
  downloadURL: string;
  fileUrl: string;
  status: string;
  aiStatus?: "pending" | "complete" | "failed";
  aiError?: string;
  aiIssues?: string[];
  aiSuggestion?: string;
  fixSuggestion?: string;
  uploadedAt?: number | null;
  createdAt?: number | null;
  updatedAt?: number | null;
  reviewedAt?: number | null;
  reviewedBy?: string;
};

function jsonError(message: string, status = 500) {
  return NextResponse.json({ error: message }, { status });
}

function asString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : undefined;
}

function toMillis(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Date.parse(value);
    return Number.isNaN(parsed) ? null : parsed;
  }

  if (value && typeof value === "object" && "toMillis" in value && typeof value.toMillis === "function") {
    return value.toMillis();
  }

  return null;
}

function getDisplayName(id: string, data: Record<string, unknown>, resolvedFileName: string) {
  return (
    asString(data.documentName) ??
    asString(data.fileName) ??
    asString(data.originalName) ??
    asString(data.filename) ??
    resolvedFileName ??
    id
  );
}

async function mapDocument(
  snapshot: QueryDocumentSnapshot<DocumentData>
): Promise<DocumentListItem | null> {
  const data = snapshot.data();

  try {
    const resolved = await resolveDocumentUrl(data);

    return {
      id: snapshot.id,
      contractorId: asString(data.contractorId),
      documentType: asString(data.documentType) ?? asString(data.docType),
      documentName: asString(data.documentName),
      fileName: getDisplayName(snapshot.id, data, resolved.fileName),
      filePath: asString(data.filePath),
      storagePath: asString(data.storagePath) ?? asString(data.filePath),
      uploadedBy: asString(data.uploadedBy),
      downloadURL: resolved.url,
      fileUrl: resolved.url,
      status: asString(data.status) ?? "pending",
      aiStatus:
        data.aiStatus === "pending" || data.aiStatus === "complete" || data.aiStatus === "failed"
          ? data.aiStatus
          : undefined,
      aiError: asString(data.aiError),
      aiIssues: Array.isArray(data.aiIssues)
        ? data.aiIssues.filter((value): value is string => typeof value === "string")
        : undefined,
      aiSuggestion: asString(data.aiSuggestion),
      fixSuggestion: asString(data.fixSuggestion),
      uploadedAt: toMillis(data.uploadedAt),
      createdAt: toMillis(data.createdAt),
      updatedAt: toMillis(data.updatedAt),
      reviewedAt: toMillis(data.reviewedAt),
      reviewedBy: asString(data.reviewedBy),
    };
  } catch (error) {
    console.error("Failed to resolve document URL", {
      documentId: snapshot.id,
      error,
    });
    return null;
  }
}

export async function GET(request: NextRequest) {
  try {
    const user = await requireAuthorizedUser(request);
    const db = getFirebaseAdmin();

    const snapshot = isPrivilegedRole(user.role)
      ? await db.collection("documents").get()
      : await db.collection("documents").where("contractorId", "==", user.contractorId ?? "").get();

    const documents = (await Promise.all(snapshot.docs.map(mapDocument)))
      .filter((document): document is DocumentListItem => document !== null)
      .sort((left, right) => {
        const leftTime = left.uploadedAt ?? left.createdAt ?? left.updatedAt ?? 0;
        const rightTime = right.uploadedAt ?? right.createdAt ?? right.updatedAt ?? 0;
        return rightTime - leftTime;
      });

    return NextResponse.json({ documents }, { status: 200 });
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return jsonError(error.message, error.status);
    }

    console.error("Document fetch failed", error);
    return jsonError("Failed to fetch documents", 500);
  }
}
