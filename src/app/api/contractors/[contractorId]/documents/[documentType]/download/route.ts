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

function isValidRouteParam(value: string): boolean {
  return value.length > 0 && value.replace(/[A-Za-z0-9_-]/g, "").length === 0;
}

function wantsJsonResponse(request: NextRequest): boolean {
  const requestUrl = request.nextUrl ?? new URL(request.url);
  return requestUrl.searchParams.get("format") === "json" ||
    request.headers.get("accept")?.toLowerCase().includes("application/json") === true;
}

function isValidStoragePath(contractorId: string, documentType: string, storagePath: string): boolean {
  const prefix = "contractors/" + contractorId + "/";
  const fileName = storagePath.slice(prefix.length);
  return storagePath.startsWith(prefix) &&
    storagePath.split("/").every((segment) => segment.length > 0 && segment !== "." && segment !== "..") &&
    !storagePath.startsWith("/") &&
    (fileName === documentType + ".pdf" || (fileName.startsWith(documentType + "_") && fileName.endsWith(".pdf")));
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ contractorId: string; documentType: string }> },
) {
  try {
    const user = await requireAuthorizedUser(request);
    const { contractorId, documentType: rawDocumentType } = await context.params;
    const documentType = normalizeContractorUploadDocumentType(rawDocumentType);

    if (!contractorId || !rawDocumentType || !isValidRouteParam(contractorId)) {
      return jsonError("Missing contractorId or documentType", 400);
    }

    if (!documentType) {
      return jsonError("Unsupported documentType", 400);
    }

    assertCanAccessContractor(user, contractorId);

    const contractorSnapshot = await getFirebaseAdmin()
      .collection("contractors")
      .doc(contractorId)
      .get();

    if (!contractorSnapshot.exists) {
      return jsonError("Contractor not found", 404);
    }

    const contractor = (contractorSnapshot.data() ?? {}) as Record<string, unknown>;
    const contractorWorkspaceId = getString(contractor.workspaceId);
    const userWorkspaceId = getString(user.workspaceId);
    if (!contractorWorkspaceId) {
      return jsonError("Contractor workspace unresolved", 403);
    }

    if (!userWorkspaceId || userWorkspaceId !== contractorWorkspaceId) {
      return jsonError("unauthorized", 403);
    }

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
    const recordContractorId = getString(data.contractorId);
    const recordWorkspaceId = getString(data.workspaceId);
    const recordDocumentType = normalizeContractorUploadDocumentType(getString(data.documentType) || getString(data.docType) || getString(data.type));

    if (recordContractorId && recordContractorId !== contractorId) {
      return jsonError("unauthorized", 403);
    }

    if (recordWorkspaceId && recordWorkspaceId !== contractorWorkspaceId) {
      return jsonError("unauthorized", 403);
    }

    if (recordDocumentType && recordDocumentType !== documentType) {
      return jsonError("unauthorized", 403);
    }
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
      storagePathVerified: true,
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
