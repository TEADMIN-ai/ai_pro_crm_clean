import { NextRequest, NextResponse } from "next/server";
import { getFirebaseAdmin, getFirebaseStorageBucket } from "@/lib/firebase/admin";
import { HYGIENE_COLLECTIONS, assertHygieneInternalAccess } from "@/lib/hygiene/hygieneService";
import {
  EVIDENCE_SIGNED_URL_TTL_MS,
  evaluateGovernedStoragePath,
  expectedHygieneSignaturePath,
  isExpectedHygieneCollectionEvidencePath,
} from "@/lib/master-data/storagePathPolicy";
import { AuthorizationError, requireAuthorizedUser } from "@/lib/server/authz";
import type { HygieneCollection, HygieneComplianceDocument, HygieneEvidencePhoto, HygieneSignature } from "@/types/hygiene";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type HygieneEvidenceKind = "signature" | "photo" | "compliance";

function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

function clean(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function kind(value: unknown): HygieneEvidenceKind | null {
  const cleanValue = clean(value);
  return cleanValue === "signature" || cleanValue === "photo" || cleanValue === "compliance" ? cleanValue : null;
}

async function loadRecord<T>(collectionName: string, id: string): Promise<T | null> {
  const snapshot = await getFirebaseAdmin().collection(collectionName).doc(id).get();
  return snapshot.exists ? snapshot.data() as T : null;
}

async function loadCollection(collectionId: string): Promise<HygieneCollection | null> {
  return loadRecord<HygieneCollection>(HYGIENE_COLLECTIONS.collections, collectionId);
}

function workspaceMatches(userWorkspaceId: string | undefined, workspaceId: string): boolean {
  return !userWorkspaceId || userWorkspaceId === workspaceId;
}

async function resolveSignature(recordId: string, collectionId: string) {
  const [signature, collection] = await Promise.all([
    loadRecord<HygieneSignature>(HYGIENE_COLLECTIONS.signatures, recordId),
    loadCollection(collectionId),
  ]);
  if (!signature || !collection) return { error: "Hygiene signature or collection not found.", status: 404 as const };
  if (signature.collectionId !== collection.collectionId || signature.clientId !== collection.clientId || signature.siteId !== collection.siteId) {
    return { error: "Hygiene signature relationship does not match the requested collection.", status: 403 as const };
  }
  const storagePath = clean(signature.signatureStoragePath);
  if (!storagePath) return { error: "Hygiene signature has no durable storage reference.", status: 404 as const };
  if (storagePath !== expectedHygieneSignaturePath({ clientId: collection.clientId, collectionId: collection.collectionId, signatureId: signature.signatureId })) {
    return { error: "Hygiene signature storage path does not match the collection relationship.", status: 403 as const };
  }
  return {
    record: signature,
    collection,
    storagePath,
    documentId: `MDOC-${signature.signatureId}`,
    purpose: "HYGIENE_COLLECTION_ACKNOWLEDGEMENT",
  };
}

async function resolvePhoto(recordId: string, collectionId: string) {
  const [photo, collection] = await Promise.all([
    loadRecord<HygieneEvidencePhoto>(HYGIENE_COLLECTIONS.evidencePhotos, recordId),
    loadCollection(collectionId),
  ]);
  if (!photo || !collection) return { error: "Hygiene evidence photo or collection not found.", status: 404 as const };
  if (photo.collectionId !== collection.collectionId || photo.clientId !== collection.clientId || photo.siteId !== collection.siteId) {
    return { error: "Hygiene photo relationship does not match the requested collection.", status: 403 as const };
  }
  const storagePath = clean(photo.storagePath) || clean(photo.fileUrl);
  if (!storagePath) return { error: "Hygiene photo has no durable storage reference.", status: 404 as const };
  return {
    record: photo,
    collection,
    storagePath,
    documentId: `MDOC-${photo.photoId}`,
    purpose: photo.category === "Disposal Certificate" ? "HYGIENE_DISPOSAL_PROOF" : "HYGIENE_COLLECTION_ACKNOWLEDGEMENT",
  };
}

async function resolveCompliance(recordId: string) {
  const document = await loadRecord<HygieneComplianceDocument>(HYGIENE_COLLECTIONS.complianceDocuments, recordId);
  if (!document) return { error: "Hygiene compliance document not found.", status: 404 as const };
  const storagePath = clean(document.storagePath);
  if (!storagePath) return { error: "Hygiene compliance document has no durable storage reference.", status: 404 as const };
  return {
    record: document,
    collection: null,
    storagePath,
    documentId: `MDOC-${document.documentId}`,
    purpose: document.documentType === "Disposal Certificates" ? "HYGIENE_DISPOSAL_PROOF" : "GENERAL_REFERENCE",
  };
}

export async function GET(request: NextRequest) {
  try {
    const user = await requireAuthorizedUser(request);
    assertHygieneInternalAccess(user);
    const search = request.nextUrl.searchParams;
    const evidenceKind = kind(search.get("kind"));
    const recordId = clean(search.get("recordId"));
    const collectionId = clean(search.get("collectionId"));
    const workspaceId = clean(search.get("workspaceId")) || clean(user.workspaceId) || "default";

    if (!evidenceKind || !recordId) return jsonError("kind and recordId are required.", 400);
    if (!workspaceMatches(user.workspaceId, workspaceId)) return jsonError("Cross-workspace Hygiene evidence access rejected.", 403);
    if ((evidenceKind === "signature" || evidenceKind === "photo") && !collectionId) return jsonError("collectionId is required for collection evidence.", 400);

    const resolved = evidenceKind === "signature"
      ? await resolveSignature(recordId, collectionId)
      : evidenceKind === "photo"
        ? await resolvePhoto(recordId, collectionId)
        : await resolveCompliance(recordId);
    if ("error" in resolved) return jsonError(resolved.error, resolved.status);

    const pathDecision = evaluateGovernedStoragePath(resolved.storagePath, ["hygiene/signatures/", "hygiene/evidence/", "hygiene/compliance/"]);
    if (!pathDecision.allowed || !pathDecision.normalizedPath) return jsonError(pathDecision.reason, 403);
    if (resolved.collection && !isExpectedHygieneCollectionEvidencePath({
      path: pathDecision.normalizedPath,
      clientId: resolved.collection.clientId,
      collectionId: resolved.collection.collectionId,
    })) {
      return jsonError("Hygiene evidence storage path does not match the collection relationship.", 403);
    }

    const file = getFirebaseStorageBucket().file(pathDecision.normalizedPath);
    const [exists] = await file.exists();
    if (!exists) return jsonError("Hygiene evidence storage object not found.", 404);
    const expiresAt = Date.now() + EVIDENCE_SIGNED_URL_TTL_MS;
    const [accessUrl] = await file.getSignedUrl({ action: "read", expires: expiresAt });

    console.info("[HYGIENE_EVIDENCE_ACCESS_GRANTED]", {
      actorUid: user.uid,
      workspaceId,
      kind: evidenceKind,
      recordId,
      collectionId: resolved.collection?.collectionId ?? null,
      documentId: resolved.documentId,
      purpose: resolved.purpose,
    });

    return NextResponse.json(
      {
        success: true,
        accessMode: "signed_url",
        accessUrl,
        expiresAt: new Date(expiresAt).toISOString(),
        documentId: resolved.documentId,
        kind: evidenceKind,
        recordId,
        collectionId: resolved.collection?.collectionId ?? null,
        purpose: resolved.purpose,
      },
      { status: 200, headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    if (error instanceof AuthorizationError) return jsonError(error.message, error.status);
    console.error("[HYGIENE_EVIDENCE_ACCESS_FAILED]", error);
    return jsonError("Hygiene evidence access failed.", 500);
  }
}
