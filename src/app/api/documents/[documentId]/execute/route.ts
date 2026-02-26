import { NextRequest, NextResponse } from "next/server";
import { getAuth } from "firebase-admin/auth";
import { FieldPath } from "firebase-admin/firestore";

import { getFirebaseAdmin } from "@/lib/firebase/admin";
import {
  DocumentExecutionError,
  guardDocumentExecution,
} from "@/lib/server/documentExecutionGuard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function asString(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function fallbackNameFromPath(pathValue: string): string {
  const cleanPath = pathValue.split("?")[0];
  const parts = cleanPath.split("/").filter(Boolean);
  return parts[parts.length - 1] ?? "document";
}

function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

async function requireRole(request: NextRequest): Promise<string> {
  const authHeader = request.headers.get("authorization") ?? "";
  const token = authHeader.startsWith("Bearer ")
    ? authHeader.slice("Bearer ".length).trim()
    : "";

  if (!token) {
    throw new DocumentExecutionError("Missing Authorization token", 401);
  }

  try {
    const { app } = getFirebaseAdmin();
    const decoded = await getAuth(app).verifyIdToken(token);
    return typeof decoded.role === "string" ? decoded.role : "";
  } catch {
    throw new DocumentExecutionError("Invalid Authorization token", 401);
  }
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ documentId: string }> }
) {
  try {
    const role = await requireRole(request);
    const { documentId } = await context.params;

    if (!documentId) {
      return jsonError("Missing documentId", 400);
    }

    const { db } = getFirebaseAdmin();

    const snap = await db
      .collectionGroup("documents")
      .where(FieldPath.documentId(), "==", documentId)
      .limit(1)
      .get();

    const docSnap = snap.docs[0];
    const exists = Boolean(docSnap?.exists);

    if (!exists) {
      guardDocumentExecution({ exists, role, url: "https://placeholder.local" });
    }

    const metadata = (docSnap.data() ?? {}) as Record<string, unknown>;
    const storagePath = asString(metadata.storagePath);

    if (!storagePath) {
      throw new DocumentExecutionError("Document is missing storagePath", 500);
    }

    const bucketName = process.env.FIREBASE_STORAGE_BUCKET;
    if (!bucketName) {
      throw new DocumentExecutionError("FIREBASE_STORAGE_BUCKET is not configured", 500);
    }

    const { storage } = getFirebaseAdmin();
    const bucket = storage.bucket(bucketName);
    const [signedUrl] = await bucket.file(storagePath).getSignedUrl({
      action: "read",
      expires: Date.now() + 24 * 60 * 60 * 1000,
    });

    const filename =
      asString(metadata.name) ??
      asString(metadata.fileName) ??
      asString(metadata.filename) ??
      asString(metadata.originalName) ??
      fallbackNameFromPath(storagePath);

    guardDocumentExecution({
      exists,
      role,
      url: signedUrl,
    });

    return NextResponse.json(
      {
        url: signedUrl,
        name: filename,
        storagePath,
      },
      { status: 200 }
    );
  } catch (error) {
    if (error instanceof DocumentExecutionError) {
      return jsonError(error.message, error.status);
    }

    console.error("Document execution resolve failed:", error);
    return jsonError("Failed to prepare document execution", 500);
  }
}
