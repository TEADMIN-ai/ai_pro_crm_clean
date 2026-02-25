import { NextRequest, NextResponse } from "next/server";
import { getAuth } from "firebase-admin/auth";
import { FieldPath } from "firebase-admin/firestore";

import { getFirebaseAdmin } from "@/lib/firebase/admin";
import { resolveDocumentUrl } from "@/lib/documents/resolveDocumentUrl";
import {
  DocumentExecutionError,
  guardDocumentExecution,
} from "@/lib/server/documentExecutionGuard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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
    const decoded = await getAuth().verifyIdToken(token);
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

    const db = getFirebaseAdmin();

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
    const resolved = await resolveDocumentUrl(metadata);

    guardDocumentExecution({
      exists,
      role,
      url: resolved.url,
    });

    return NextResponse.json(
      {
        fileName: resolved.fileName,
        url: resolved.url,
        previewable: resolved.isPreviewable,
        extension: resolved.extension,
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
