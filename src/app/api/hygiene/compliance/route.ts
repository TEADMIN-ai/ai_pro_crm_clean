import { randomUUID } from "crypto";
import { NextResponse, type NextRequest } from "next/server";
import { getFirebaseStorageBucket } from "@/lib/firebase/admin";
import { upsertHygieneComplianceDocument } from "@/lib/hygiene/hygieneService";
import { AuthorizationError, requireAuthorizedUser } from "@/lib/server/authz";
import type { HygieneDocumentStatus } from "@/types/hygiene";

export const dynamic = "force-dynamic";

function errorResponse(error: unknown) {
  if (error instanceof AuthorizationError) return NextResponse.json({ error: error.message }, { status: error.status });
  const message = error instanceof Error ? error.message : "Hygiene compliance request failed";
  console.error("[HYGIENE_COMPLIANCE_API_ERROR]", error);
  return NextResponse.json({ error: message }, { status: 500 });
}

function formString(formData: FormData, key: string, fallback = ""): string {
  const value = formData.get(key);
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

async function uploadFile(file: File, documentId: string): Promise<{ fileUrl: string; storagePath: string }> {
  const safeFileName = file.name.replace(/[^a-zA-Z0-9._-]+/g, "_");
  const storagePath = `hygiene/compliance/${documentId}/${Date.now()}-${safeFileName}`;
  const bucketFile = getFirebaseStorageBucket().file(storagePath);
  await bucketFile.save(Buffer.from(await file.arrayBuffer()), {
    contentType: file.type || "application/octet-stream",
    resumable: false,
    metadata: { metadata: { documentId } },
  });
  const [fileUrl] = await bucketFile.getSignedUrl({ action: "read", expires: "2036-01-01" });
  return { fileUrl, storagePath };
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuthorizedUser(request);
    const contentType = request.headers.get("content-type") ?? "";

    if (contentType.includes("multipart/form-data")) {
      const formData = await request.formData();
      const documentId = formString(formData, "documentId", `TE-HC-${randomUUID().slice(0, 8)}`);
      const file = formData.get("file");
      const uploaded = file instanceof File ? await uploadFile(file, documentId) : { fileUrl: formString(formData, "fileUrl", ""), storagePath: "" };
      const record = await upsertHygieneComplianceDocument(user, {
        documentId,
        documentType: formString(formData, "documentType", "Compliance Document"),
        title: formString(formData, "title", formString(formData, "documentType", "Compliance Document")),
        registrationNumber: formString(formData, "registrationNumber", "Pending"),
        issueDate: formString(formData, "issueDate") || null,
        expiryDate: formString(formData, "expiryDate") || null,
        status: formString(formData, "status", "Pending") as HygieneDocumentStatus,
        fileUrl: uploaded.fileUrl || null,
        storagePath: uploaded.storagePath || null,
        owner: formString(formData, "owner", "Torque Empire"),
        uploadedAt: new Date().toISOString(),
      });
      return NextResponse.json({ success: true, record });
    }

    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const record = await upsertHygieneComplianceDocument(user, body);
    return NextResponse.json({ success: true, record });
  } catch (error) {
    return errorResponse(error);
  }
}
