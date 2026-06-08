import { NextRequest, NextResponse } from "next/server";
import { getFirebaseAdmin, getFirebaseStorageBucket } from "@/lib/firebase/admin";
import { isSupportedDocumentType } from "@/lib/compliance/contractorCompliance";
import {
  AuthorizationError,
  assertCanAccessContractor,
  requireAuthorizedUser,
} from "@/lib/server/authz";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CONTRACTOR_DOCUMENT_URL_TTL_MS = 5 * 60 * 1000;

function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

function getString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function isValidStoragePath(contractorId: string, documentType: string, storagePath: string): boolean {
  const escapedDocumentType = documentType.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`^contractors/${contractorId}/${escapedDocumentType}(?:_\\d+)?\\.pdf$`).test(storagePath);
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ contractorId: string; documentType: string }> },
) {
  try {
    const user = await requireAuthorizedUser(request);
    const { contractorId, documentType } = await context.params;

    if (!contractorId || !documentType) {
      return jsonError("Missing contractorId or documentType", 400);
    }

    if (!isSupportedDocumentType(documentType)) {
      return jsonError("Unsupported documentType", 400);
    }

    assertCanAccessContractor(user, contractorId);

    const snapshot = await getFirebaseAdmin()
      .collection("contractors")
      .doc(contractorId)
      .collection("documents")
      .doc(documentType)
      .get();

    if (!snapshot.exists) {
      return jsonError("Document not found", 404);
    }

    const data = (snapshot.data() ?? {}) as Record<string, unknown>;
    const storagePath = getString(data.storagePath) || getString(data.filePath) || getString(data.filename);

    if (!storagePath || !isValidStoragePath(contractorId, documentType, storagePath)) {
      return jsonError("Document storage path is invalid", 403);
    }

    const [signedUrl] = await getFirebaseStorageBucket()
      .file(storagePath)
      .getSignedUrl({
        action: "read",
        expires: Date.now() + CONTRACTOR_DOCUMENT_URL_TTL_MS,
      });

    return NextResponse.redirect(signedUrl, 302);
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return jsonError(error.message, error.status);
    }

    console.error("Contractor document download failed:", error);
    return jsonError("Failed to download contractor document", 500);
  }
}
