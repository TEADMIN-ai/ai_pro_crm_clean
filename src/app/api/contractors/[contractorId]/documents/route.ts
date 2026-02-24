import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import type { ContractorDocument } from "@/types/document";
import { getAuth } from "firebase-admin/auth";
import {
  detectDocTypeFromFileName,
  getString,
  normalizeCreatedAt,
  resolveDocumentFileName,
} from "@/lib/documents/normalizeDocumentName";

/**
 * Always return JSON error safely
 */
function jsonError(message: string, status = 500) {

  return NextResponse.json(
    { error: message },
    { status }
  );

}

/**
 * Normalize Firestore doc safely
 */
function normalizeDocument(
  id: string,
  data: any
): ContractorDocument {
  const source = (data ?? {}) as Record<string, unknown>;
  const fileName = resolveDocumentFileName(source);

  const originalName =
    getString(source.originalName) ??
    fileName;

  const docType =
    getString(source.docType) ?? detectDocTypeFromFileName(fileName);

  const status =
    getString(source.status) ?? "active";

  const createdAt = normalizeCreatedAt(source.createdAt);

  return {

    id,

    contractorId:
      typeof data.contractorId === "string"
        ? data.contractorId
        : "",

    fileName,
    originalName,

    filename:
      typeof data.filename === "string"
        ? data.filename
        : undefined,
    storagePath:
      typeof data.storagePath === "string"
        ? data.storagePath
        : undefined,
    downloadURL:
      typeof data.downloadURL === "string"
        ? data.downloadURL
        : typeof data.url === "string"
          ? data.url
          : undefined,

    docType,

    status,

    expiresAt:
      typeof data.expiresAt === "number"
        ? data.expiresAt
        : typeof data.expiryDate === "number"
          ? data.expiryDate
          : undefined,

    expiryDate:
      typeof data.expiryDate === "number"
        ? data.expiryDate
        : typeof data.expiresAt === "number"
          ? data.expiresAt
          : undefined,

    createdAt,

  };

}

async function requireAdmin(request: NextRequest): Promise<{ ok: true } | { ok: false; response: NextResponse }> {
  const authHeader = request.headers.get("authorization") ?? "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice("Bearer ".length).trim() : "";

  if (!token) {
    return { ok: false, response: jsonError("Missing Authorization token", 401) };
  }

  try {
    const decoded = await getAuth().verifyIdToken(token);
    const role = typeof decoded.role === "string" ? decoded.role : "";

    if (role !== "admin") {
      return { ok: false, response: jsonError("Forbidden", 403) };
    }

    return { ok: true };
  } catch {
    return { ok: false, response: jsonError("Invalid Authorization token", 401) };
  }
}

/**
 * GET contractor documents
 */
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ contractorId: string }> }
) {
  try {

    const { contractorId } = await context.params;

    if (!contractorId) {
      return jsonError("Missing contractorId", 400);
    }

    const snapshot =
      await adminDb
        .collection("contractors")
        .doc(contractorId)
        .collection("documents")
        .get();

    const documents =
      snapshot.docs.map(doc =>
        normalizeDocument(
          doc.id,
          doc.data()
        )
      );

    return NextResponse.json(
      { documents },
      { status: 200 }
    );

  }
  catch (error: any) {

    console.error(error);

    return jsonError(
      error?.message ?? "Failed to fetch documents",
      500
    );

  }

}

/**
 * POST contractor document
 */
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ contractorId: string }> }
) {
  try {

    const { contractorId } = await context.params;

    if (!contractorId) {
      return jsonError("Missing contractorId", 400);
    }

    const data =
      await request.json();

    const payload = {
      contractorId,
      fileName: data?.fileName,
      originalName: data?.originalName,
      filename: data?.filename,
      storagePath: data?.storagePath,
      downloadURL: data?.downloadURL,
      url: data?.url,
      docType: data?.docType,
      status: data?.status,
      expiresAt: data?.expiresAt,
      expiryDate: data?.expiryDate,
      createdAt: data?.createdAt,
    };

    const normalized = normalizeDocument("", payload);

    const docRef =
      await adminDb
        .collection("contractors")
        .doc(contractorId)
        .collection("documents")
        .add({
          contractorId,
          fileName: normalized.fileName,
          originalName: normalized.originalName,
          filename: normalized.filename,
          storagePath: normalized.storagePath,
          downloadURL: normalized.downloadURL,
          url: normalized.downloadURL,
          docType: normalized.docType,
          status: normalized.status,
          expiresAt: normalized.expiresAt,
          expiryDate: normalized.expiryDate,
          createdAt: normalized.createdAt,
        });

    const savedDoc =
      await docRef.get();

    const document =
      normalizeDocument(
        savedDoc.id,
        savedDoc.data()
      );

    return NextResponse.json(
      { document },
      { status: 201 }
    );

  }
  catch (error: any) {

    console.error(error);

    return jsonError(
      error?.message ?? "Failed to create document",
      500
    );

  }

}

/**
 * PATCH contractor document metadata (admin only)
 */
export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ contractorId: string }> }
) {
  try {
    const authResult = await requireAdmin(request);
    if (!authResult.ok) return authResult.response;

    const { contractorId } = await context.params;

    if (!contractorId) {
      return jsonError("Missing contractorId", 400);
    }

    const body = await request.json() as { documentId?: unknown; fileName?: unknown };
    const documentId = getString(body.documentId);
    const nextFileName = getString(body.fileName);

    if (!documentId) {
      return jsonError("Missing documentId", 400);
    }

    if (!nextFileName) {
      return jsonError("Missing fileName", 400);
    }

    const docRef = adminDb
      .collection("contractors")
      .doc(contractorId)
      .collection("documents")
      .doc(documentId);

    const snap = await docRef.get();

    if (!snap.exists) {
      return jsonError("Document not found", 404);
    }

    await docRef.set(
      {
        fileName: nextFileName,
        originalName: nextFileName,
      },
      { merge: true }
    );

    const updated = await docRef.get();

    return NextResponse.json(
      { document: normalizeDocument(updated.id, updated.data()) },
      { status: 200 }
    );
  }
  catch (error: any) {
    console.error(error);

    return jsonError(
      error?.message ?? "Failed to update document",
      500
    );
  }
}
