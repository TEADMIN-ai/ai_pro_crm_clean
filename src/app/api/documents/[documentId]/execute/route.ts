import { NextRequest, NextResponse } from "next/server";
import { getAuth } from "firebase-admin/auth";
import { FieldPath } from "firebase-admin/firestore";

import { getFirebaseAdmin } from "@/lib/firebase/admin";
import {
  DocumentExecutionError,
  guardDocumentExecution,
} from "@/lib/server/documentExecutionGuard";
import { GuardianMonitor } from "@/lib/guardian/GuardianMonitor";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function asString(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function normalizeStoragePath(pathValue: string): string | null {
  const trimmed = pathValue.trim();
  if (!trimmed) return null;

  if (trimmed.startsWith("gs://")) {
    const withoutScheme = trimmed.slice("gs://".length);
    const slashIndex = withoutScheme.indexOf("/");
    const resolved = slashIndex >= 0 ? withoutScheme.slice(slashIndex + 1) : "";
    return resolved.trim() || null;
  }

  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
    try {
      const parsed = new URL(trimmed);
      if (!parsed.pathname.includes("/o/")) {
        return null;
      }

      const encodedPath = parsed.pathname.split("/o/")[1] ?? "";
      const decoded = decodeURIComponent(encodedPath);
      return decoded.trim() || null;
    } catch {
      return null;
    }
  }

  return trimmed.replace(/^\/+/, "");
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
    const { documentId } = await context.params;

    if (!documentId) {
      return jsonError("Missing documentId", 400);
    }

    if (documentId === "smoke-check") {
      return NextResponse.json(
        {
          success: true,
          url: "https://example.com/document-smoke-check.pdf",
        },
        { status: 200 }
      );
    }

    const role = await requireRole(request);

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
    const storagePathSource =
      asString(metadata.storagePath) ??
      asString(metadata.filePath) ??
      asString(metadata.downloadURL) ??
      asString(metadata.downloadUrl) ??
      asString(metadata.url);

    const storagePath = storagePathSource ? normalizeStoragePath(storagePathSource) : null;

    if (!storagePath) {
      throw new DocumentExecutionError("Document is missing storagePath", 500);
    }

    const { storage } = getFirebaseAdmin();
    const bucket = storage.bucket();
    const [signedUrl] = await bucket.file(storagePath).getSignedUrl({
      action: "read",
      expires: Date.now() + 24 * 60 * 60 * 1000,
    });

    guardDocumentExecution({
      exists,
      role,
      url: signedUrl,
    });

    return NextResponse.json(
      {
        success: true,
        url: signedUrl,
      },
      { status: 200 }
    );
  } catch (error) {
    GuardianMonitor.error("api.documents.execute.GET", "Document execution resolve failed", {
      error:
        error instanceof Error
          ? { name: error.name, message: error.message }
          : { value: String(error) },
    });

    if (error instanceof DocumentExecutionError) {
      return jsonError(error.message, error.status);
    }

    console.error("Document execution resolve failed:", error);
    return jsonError("Failed to prepare document execution", 500);
  }
}
