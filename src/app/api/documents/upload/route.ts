import { NextRequest, NextResponse } from "next/server";
import { getStorage } from "firebase-admin/storage";
import { adminDb } from "@/lib/firebaseAdmin";
import { AuthorizationError, requireAuthorizedUser } from "@/lib/server/authz";

export const runtime = "nodejs";

function jsonError(message: string, status = 500) {
  return NextResponse.json({ error: message }, { status });
}

export async function POST(req: NextRequest) {
  try {
    const user = await requireAuthorizedUser(req);
    const contentType = req.headers.get("content-type") || "";

    let fileUrl = "";
    let fileName = "";
    let contractorId: string | null = null;
    let dealId: string | null = null;
    let documentType = "general";

    if (contentType.includes("multipart/form-data")) {
      const formData = await req.formData();

      const file = formData.get("file") as File | null;
      contractorId =
        typeof formData.get("contractorId") === "string"
          ? String(formData.get("contractorId"))
          : null;
      dealId =
        typeof formData.get("dealId") === "string"
          ? String(formData.get("dealId"))
          : null;
      documentType =
        typeof formData.get("documentType") === "string"
          ? String(formData.get("documentType"))
          : "general";

      if (!file) {
        return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
      }

      fileName = file.name;
      const bucket = getStorage().bucket();
      const buffer = Buffer.from(await file.arrayBuffer());
      const filePath = `documents/${contractorId || "general"}/${Date.now()}-${file.name}`;
      const fileUpload = bucket.file(filePath);

      await fileUpload.save(buffer, {
        metadata: {
          contentType: file.type,
        },
      });

      await fileUpload.makePublic();

      fileUrl = `https://storage.googleapis.com/${bucket.name}/${filePath}`;
    } else {
      const body = (await req.json()) as {
        fileUrl?: string;
        fileName?: string;
        contractorId?: string | null;
        dealId?: string | null;
        documentType?: string;
      };

      fileUrl = body.fileUrl || "";
      fileName = body.fileName || "unknown";
      contractorId = body.contractorId || null;
      dealId = body.dealId || null;
      documentType = body.documentType || "general";
    }

    if (!fileUrl) {
      return NextResponse.json(
        { error: "Missing fileUrl or file" },
        { status: 400 }
      );
    }

    const docRef = await adminDb.collection("documents").add({
      contractorId,
      dealId,
      fileName,
      fileUrl,
      documentType,
      status: "pending",
      uploadedBy: user.uid,
      role: user.role,
      createdAt: Date.now(),
    });

    return NextResponse.json({ success: true, id: docRef.id }, { status: 200 });
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return jsonError(error.message, error.status);
    }

    console.error("DOCUMENT UPLOAD ERROR:", error);
    return jsonError("Failed to store document metadata", 500);
  }
}
