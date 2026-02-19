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

function normalizeTimestamp(value: unknown): number {
  if (typeof value === "number") {
    return value;
  }

  if (
    typeof value === "object" &&
    value !== null &&
    "toMillis" in value &&
    typeof (value as { toMillis: unknown }).toMillis === "function"
  ) {
    return (value as { toMillis: () => number }).toMillis();
  }

  if (
    typeof value === "object" &&
    value !== null &&
    "seconds" in value &&
    typeof (value as { seconds: unknown }).seconds === "number"
  ) {
    return (value as { seconds: number }).seconds * 1000;
  }

  return Date.now();
}

function toDocument(
  id: string,
  contractorId: string,
  data: Record<string, unknown>
): ContractorDocument {
  const uploadedAtRaw = data.uploadedAt ?? data.createdAt;
  const uploadedAt = normalizeTimestamp(uploadedAtRaw);

  const expiresAtRaw = data.expiresAt;
  const expiresAt = expiresAtRaw == null ? null : normalizeTimestamp(expiresAtRaw);

  const statusRaw = data.status;
  const status: ContractorDocument["status"] =
    statusRaw === "expired" || statusRaw === "replaced" ? statusRaw : "active";

  return {
    id,
    contractorId,
    name: typeof data.name === "string" ? data.name : "",
    storagePath: typeof data.storagePath === "string" ? data.storagePath : "",
    downloadURL: typeof data.downloadURL === "string" ? data.downloadURL : "",
    uploadedBy: typeof data.uploadedBy === "string" ? data.uploadedBy : "",
    uploadedAt,
    status,
    expiresAt,
    docType: typeof data.docType === "string" ? data.docType : null,
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
      toDocument(snapshotDoc.id, contractorId, snapshotDoc.data() as Record<string, unknown>)
    );

    return NextResponse.json({ documents }, { status: 200 });
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

    const document = toDocument(docRef.id, contractorId, savedDocData);
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
