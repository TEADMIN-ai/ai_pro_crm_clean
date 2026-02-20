import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import type { ContractorDocument } from "@/types/document";

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
  const fileName =
    typeof data?.fileName === "string" && data.fileName.trim().length > 0
      ? data.fileName
      : typeof data?.originalName === "string" && data.originalName.trim().length > 0
      ? data.originalName
      : typeof data?.filename === "string" && data.filename.trim().length > 0
      ? data.filename
      : typeof data?.docType === "string" && data.docType.trim().length > 0
      ? data.docType
      : "Recovered document";

  const originalName =
    typeof data?.originalName === "string" && data.originalName.trim().length > 0
      ? data.originalName
      : fileName;

  const docType =
    typeof data?.docType === "string" && data.docType.trim().length > 0
      ? data.docType
      : "general";

  const status =
    typeof data?.status === "string" && data.status.trim().length > 0
      ? data.status
      : "active";

  const createdAt =
    typeof data?.createdAt === "number" && Number.isFinite(data.createdAt)
      ? data.createdAt
      : Date.now();

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
      docType: data?.docType,
      status: data?.status,
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
          docType: normalized.docType,
          status: normalized.status,
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
