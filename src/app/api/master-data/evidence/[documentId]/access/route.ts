import { NextRequest, NextResponse } from "next/server";
import { getFirebaseStorageBucket } from "@/lib/firebase/admin";
import { actorFromAuthorizedUser } from "@/lib/master-data/apiPayload";
import { FirestoreMasterDataRepository } from "@/lib/master-data/firestoreRepository";
import { assertDocumentRelationship, EvidenceAuthorityError, evidenceReferenceFromDocument } from "@/lib/master-data/evidenceAuthority";
import { buildAuditEvent } from "@/lib/master-data/service";
import { AuthorizationError, assertPrivilegedRole, requireAuthorizedUser } from "@/lib/server/authz";
import type { CanonicalDocumentReference } from "@/types/masterData";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const EVIDENCE_ACCESS_TTL_MS = 5 * 60 * 1000;

type RouteContext = {
  params: Promise<{ documentId: string }>;
};

function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

function clean(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function isSafeStoragePath(value: string): boolean {
  return Boolean(value) &&
    !value.startsWith("/") &&
    value.split("/").every((segment) => segment.length > 0 && segment !== "." && segment !== "..") &&
    !/^https?:\/\//i.test(value);
}

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const user = await requireAuthorizedUser(request);
    assertPrivilegedRole(user);
    const { documentId } = await context.params;
    const workspaceId = clean(request.nextUrl.searchParams.get("workspaceId")) || clean(user.workspaceId);
    if (!documentId || !workspaceId) return jsonError("documentId and workspaceId are required.", 400);
    if (user.workspaceId && user.workspaceId !== workspaceId) return jsonError("Cross-workspace evidence access rejected.", 403);

    const repository = new FirestoreMasterDataRepository();
    const entity = await repository.getByCanonicalId("document", documentId);
    if (!entity || entity.entityType !== "document") return jsonError("Evidence document not found.", 404);
    const document = entity as CanonicalDocumentReference;
    if (document.workspaceId !== workspaceId) return jsonError("Cross-workspace evidence access rejected.", 403);
    assertDocumentRelationship(document);

    const storagePath = clean(document.storagePath);
    const expiresAt = new Date(Date.now() + EVIDENCE_ACCESS_TTL_MS).toISOString();
    let accessUrl: string | null = null;
    let accessMode: "signed_url" | "metadata_only" = "metadata_only";
    if (storagePath) {
      if (!isSafeStoragePath(storagePath)) return jsonError("Evidence storage path is invalid.", 403);
      const file = getFirebaseStorageBucket().file(storagePath);
      const [exists] = await file.exists();
      if (!exists) return jsonError("Evidence storage object not found.", 404);
      const [signedUrl] = await file.getSignedUrl({ action: "read", expires: Date.now() + EVIDENCE_ACCESS_TTL_MS });
      accessUrl = signedUrl;
      accessMode = "signed_url";
    }

    const auditEvent = buildAuditEvent({
      action: "evidence_access",
      actor: actorFromAuthorizedUser(user, workspaceId),
      entity: document,
      previousState: document,
      resultingState: document,
      reason: accessMode === "signed_url" ? "Evidence signed access URL issued." : "Evidence metadata inspected without exposing local source path.",
      evidenceReferences: [evidenceReferenceFromDocument(document)],
    });
    await repository.writeAuditEvent(auditEvent);

    return NextResponse.json(
      {
        success: true,
        documentId: document.documentId,
        accessMode,
        accessUrl,
        expiresAt: accessMode === "signed_url" ? expiresAt : null,
        filename: document.filename ?? document.displayName,
        contentType: document.contentType ?? null,
        documentType: document.documentType,
        linkedEntityType: document.linkedEntityType,
        linkedEntityId: document.linkedEntityId,
        evidenceStatus: document.evidenceStatus ?? null,
        verificationStatus: document.verificationStatus,
      },
      { status: 200, headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    if (error instanceof AuthorizationError) return jsonError(error.message, error.status);
    if (error instanceof EvidenceAuthorityError) return jsonError(error.message, error.status);
    console.error("Master Data evidence access failed", error);
    return jsonError("Evidence access failed.", 500);
  }
}
