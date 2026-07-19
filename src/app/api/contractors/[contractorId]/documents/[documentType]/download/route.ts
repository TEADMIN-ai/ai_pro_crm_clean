import { NextRequest, NextResponse } from "next/server";
import { getFirebaseAdmin, getFirebaseStorageBucket } from "@/lib/firebase/admin";
import { normalizeContractorUploadDocumentType } from "@/lib/compliance/contractorCompliance";
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

function wantsJsonResponse(request: NextRequest): boolean {
  const requestUrl = request.nextUrl ?? new URL(request.url);
  return requestUrl.searchParams.get("format") === "json" ||
    request.headers.get("accept")?.toLowerCase().includes("application/json") === true;
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
    const { contractorId, documentType: rawDocumentType } = await context.params;
    const documentType = normalizeContractorUploadDocumentType(rawDocumentType);

    if (!contractorId || !rawDocumentType) {
      return jsonError("Missing contractorId or documentType", 400);
    }

    if (!documentType) {
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

    const storageFile = getFirebaseStorageBucket().file(storagePath);
    const [storageObjectExists] = await storageFile.exists();

    if (!storageObjectExists) {
      return jsonError("Document storage object not found", 404);
    }

    const expiresAt = Date.now() + CONTRACTOR_DOCUMENT_URL_TTL_MS;
    const [signedUrl] = await storageFile.getSignedUrl({
      action: "read",
      expires: expiresAt,
    });

    console.info("[CONTRACTOR_DOCUMENT_VIEW_URL_GENERATED]", {
      contractorId,
      documentId: snapshot.id,
      documentType,
      storagePath,
      expiresAt: new Date(expiresAt).toISOString(),
      responseMode: wantsJsonResponse(request) ? "json" : "redirect",
    });

    if (wantsJsonResponse(request)) {
      return NextResponse.json(
        {
          success: true,
          url: signedUrl,
          expiresAt: new Date(expiresAt).toISOString(),
          contractorId,
          documentId: snapshot.id,
          documentType,
          fileName:
            getString(data.fileName) ||
            getString(data.documentName) ||
            getString(data.originalName) ||
            `${documentType}.pdf`,
        },
        {
          status: 200,
          headers: {
            "Cache-Control": "no-store",
          },
        },
      );
    }

    return NextResponse.redirect(signedUrl, 302);
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return jsonError(error.message, error.status);
    }

    console.error("Contractor document download failed:", error);
    return jsonError("Failed to download contractor document", 500);
  }
}
