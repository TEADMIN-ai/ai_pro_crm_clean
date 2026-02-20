import { NextRequest, NextResponse } from "next/server";
import { getAuth } from "firebase-admin/auth";
import { FieldValue, getFirestore } from "firebase-admin/firestore";
import { adminDb, initFirebaseAdmin } from "@/lib/firebase/admin";
import { extractDocumentData, extractExpiryFromDocumentText } from "@/lib/ai/extractDocumentData";
import { classifyDocument } from "@/lib/ai/classifyDocument";
import type { ContractorDocument } from "@/types/document";

export const runtime = "nodejs";

function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

function normalizeDocument(
  id: string,
  data: any
): ContractorDocument {
  return {
    id,

    contractorId:
      typeof data.contractorId === "string"
        ? data.contractorId
        : "",

    fileName:
      typeof data.fileName === "string"
        ? data.fileName
        : undefined,

    originalName:
      typeof data.originalName === "string"
        ? data.originalName
        : undefined,

    filename:
      typeof data.filename === "string"
        ? data.filename
        : undefined,

    docType:
      typeof data.docType === "string"
        ? data.docType
        : undefined,

    status:
      typeof data.status === "string"
        ? data.status
        : undefined,

    expiresAt:
      typeof data.expiresAt === "number"
        ? data.expiresAt
        : undefined,

    createdAt:
      typeof data.createdAt === "number"
        ? data.createdAt
        : Date.now(),

    storagePath:
      typeof data.storagePath === "string"
        ? data.storagePath
        : undefined,

    downloadURL:
      typeof data.downloadURL === "string"
        ? data.downloadURL
        : undefined,
  };
}

async function authenticate(request: NextRequest): Promise<{ uid: string }> {
  const authHeader = request.headers.get("authorization");

  if (!authHeader?.startsWith("Bearer ")) {
    throw new Error("Missing token");
  }

  const token = authHeader.slice("Bearer ".length).trim();
  if (!token) {
    throw new Error("Missing token");
  }

  initFirebaseAdmin();
  const decoded = await getAuth().verifyIdToken(token);
  return { uid: decoded.uid };
}

export async function GET(
  request: NextRequest,
  context: { params: { contractorId: string } }
) {
  try {
    const contractorId = context?.params?.contractorId;

    if (!contractorId) {
      return jsonError("Missing contractorId", 400);
    }

    await authenticate(request);

    const db = adminDb();
    const snapshot = await db
      .collection("contractors")
      .doc(contractorId)
      .collection("documents")
      .orderBy("createdAt", "desc")
      .get();

    const documents: ContractorDocument[] = snapshot.docs.map((snapshotDoc) =>
      normalizeDocument(snapshotDoc.id, snapshotDoc.data())
    );

    return NextResponse.json({
      documents
    });
  } catch (error) {
    console.error("Document route failure:", error);

    return NextResponse.json(
      {
        error: "Document processing failed",
        message: error instanceof Error
          ? error.message
          : "Unknown error"
      },
      { status: 500 }
    );
  }
}

export async function POST(
  request: NextRequest,
  context: { params: { contractorId: string } }
) {
  try {
    const contractorId = context?.params?.contractorId;

    if (!contractorId) {
      return jsonError("Missing contractorId", 400);
    }

    const { uid } = await authenticate(request);

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return jsonError("Invalid JSON body", 400);
    }

    if (typeof body !== "object" || body === null) {
      return jsonError("Invalid JSON body", 400);
    }

    const { name, storagePath, downloadURL } = body as {
      name?: unknown;
      storagePath?: unknown;
      downloadURL?: unknown;
    };

    if (
      typeof name !== "string" ||
      typeof storagePath !== "string" ||
      typeof downloadURL !== "string" ||
      !name.trim() ||
      !storagePath.trim() ||
      !downloadURL.trim()
    ) {
      return jsonError("Missing required fields", 400);
    }

    const db = getFirestore();
    const docRef = db
      .collection("contractors")
      .doc(contractorId)
      .collection("documents")
      .doc();

    const now = Date.now();
    const trimmedName = name.trim();
    const trimmedStoragePath = storagePath.trim();
    const trimmedDownloadUrl = downloadURL.trim();

    await docRef.set({
      contractorId,
      name: trimmedName,
      storagePath: trimmedStoragePath,
      downloadURL: trimmedDownloadUrl,
      uploadedBy: uid,
      uploadedAt: now,
      status: "active",
      createdAt: now,
      updatedAt: now,
    });

    let extractedText = "";
    let expiresAt: number | null = null;
    let docType: string | null = null;

    try {
      const extracted = await extractDocumentData({
        storagePath: trimmedStoragePath,
        filename: trimmedName,
      });

      extractedText = extracted.text || "";

      const classification = await classifyDocument({
        text: extractedText,
        fileName: trimmedName,
      });

      docType = classification?.docType ?? null;

      expiresAt = await extractExpiryFromDocumentText({
        text: extractedText,
        fileName: trimmedName,
        docType,
      });
    } catch (aiError) {
      console.error("AI failed safely:", aiError);
    }

    const status = expiresAt && expiresAt < Date.now() ? "expired" : "active";

    await docRef.update({
      text: extractedText,
      docType,
      expiresAt,
      status,
      updatedAt: FieldValue.serverTimestamp(),
    });

    const savedDocSnapshot = await docRef.get();
    const savedDocData = savedDocSnapshot.data() as Record<string, unknown> | undefined;

    if (!savedDocData) {
      return jsonError("Internal server error", 500);
    }

    const document = normalizeDocument(docRef.id, savedDocData);
    return NextResponse.json({ document }, { status: 201 });
  } catch (error) {
    console.error("Document route failure:", error);

    return NextResponse.json(
      {
        error: "Document processing failed",
        message: error instanceof Error
          ? error.message
          : "Unknown error"
      },
      { status: 500 }
    );
  }
}
