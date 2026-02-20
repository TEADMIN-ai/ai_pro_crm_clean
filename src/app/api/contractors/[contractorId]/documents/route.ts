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

  return {

    id,

    contractorId:
      typeof data.contractorId === "string"
        ? data.contractorId
        : null,

    fileName:
      typeof data.fileName === "string"
        ? data.fileName
        : null,

    originalName:
      typeof data.originalName === "string"
        ? data.originalName
        : null,

    filename:
      typeof data.filename === "string"
        ? data.filename
        : null,

    docType:
      typeof data.docType === "string"
        ? data.docType
        : null,

    status:
      typeof data.status === "string"
        ? data.status
        : null,

    expiresAt:
      typeof data.expiresAt === "number"
        ? data.expiresAt
        : null,

    createdAt:
      typeof data.createdAt === "number"
        ? data.createdAt
        : null,

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

    const body =
      await request.json();

    const docRef =
      await adminDb
        .collection("contractors")
        .doc(contractorId)
        .collection("documents")
        .add({

          contractorId,

          fileName:
            typeof body.fileName === "string"
              ? body.fileName
              : null,

          docType:
            typeof body.docType === "string"
              ? body.docType
              : null,

          status: "active",

          createdAt: Date.now(),

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