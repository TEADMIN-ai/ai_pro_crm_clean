import { NextRequest, NextResponse } from "next/server";
import { executeBoqIngestion } from "@/lib/qs/boq";
import { AuthorizationError, requireAuthorizedUser } from "@/lib/server/authz";
import type { QsBoqDocumentType } from "@/types/qs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

function jsonError(message: string, status = 500) {
  return NextResponse.json({ error: message }, { status });
}

function normalizeDocumentType(value: FormDataEntryValue | null): QsBoqDocumentType {
  return value === "rfq" || value === "scopeOfWork" ? value : "boq";
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuthorizedUser(request);
    if (!["admin", "manager", "staff", "contractor"].includes(user.role)) {
      return jsonError("unauthorized", 403);
    }

    const formData = await request.formData();
    const file = formData.get("file");

    if (!(file instanceof File) || file.size <= 0) {
      return jsonError("A BOQ, RFQ or Scope of Work file is required.", 400);
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const document = await executeBoqIngestion({
      fileName: file.name,
      mimeType: file.type || null,
      buffer,
      uploadedBy: user.uid,
      uploadedByRole: user.role,
      projectId: String(formData.get("projectId") ?? "").trim() || null,
      projectName: String(formData.get("projectName") ?? "").trim() || null,
      documentType: normalizeDocumentType(formData.get("documentType")),
    });

    return NextResponse.json({ document });
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return jsonError(error.message, error.status);
    }

    console.error("[QS_BOQ_UPLOAD_FAILED]", error);
    return jsonError(error instanceof Error ? error.message : "BOQ upload failed.");
  }
}
