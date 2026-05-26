import { NextRequest, NextResponse } from "next/server";
import { getFirebaseAdmin } from "@/lib/firebase/admin";
import { AuthorizationError, requireAuthorizedUser } from "@/lib/server/authz";
import { extractTextFromPdf } from "@/lib/documents/extractTextFromPdf";
import { validateDocument } from "@/lib/documents/validateCompliance";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ contractorId: string }> }
) {
  try {
    const db = getFirebaseAdmin();
    const user = await requireAuthorizedUser(req);

    if (!user) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }

    const formData = await req.formData();
    const docTypeValue = formData.get("docType");
    const file = formData.get("file");
    const docType = typeof docTypeValue === "string" ? docTypeValue : "";
    const { contractorId } = await params;
    const allowedDocs = ["cipc", "tax", "bbbee", "coida", "bank"];
    const uploadedAt = new Date().toISOString();

    if (!docType) {
      return NextResponse.json({ error: "Missing docType" }, { status: 400 });
    }

    if (typeof contractorId !== "string" || contractorId.trim().length === 0) {
      return NextResponse.json({ error: "invalid_contractor_id" }, { status: 400 });
    }

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Missing file" }, { status: 400 });
    }

    if (typeof file.name !== "string" || file.name.trim().length === 0) {
      return NextResponse.json({ error: "invalid_file" }, { status: 400 });
    }

    if (!allowedDocs.includes(docType)) {
      return NextResponse.json(
        { error: "Invalid docType" },
        { status: 400 }
      );
    }

    const docRef = db.collection("contractors").doc(contractorId);
    const snap = await docRef.get();
    const existing =
      snap.data()?.documents &&
      typeof snap.data()?.documents === "object"
        ? (snap.data()?.documents as Record<string, unknown>)[docType]
        : undefined;

    if (
      existing &&
      typeof existing === "object" &&
      "uploaded" in existing &&
      (existing as { uploaded?: unknown }).uploaded === true
    ) {
      return NextResponse.json({ success: true, action: "updated" });
    }

    const fileBuffer = Buffer.from(await file.arrayBuffer());
    const text = await extractTextFromPdf(fileBuffer);
    const validation = validateDocument(docType, text);

    await docRef.set(
      {
        documents: {
          [docType]: {
            uploaded: true,
            valid: validation.valid,
            issues: validation.issues,
            extracted: validation.extracted,
            reviewed: false,
          },
        },
      },
      { merge: true }
    );

    await db.collection("contractorComplianceAudit").add({
      action: "document_updated",
      actorUid: user.uid,
      actorRole: user.role,
      contractorId,
      createdAt: uploadedAt,
      docType,
      fileName: file.name,
      validation,
    });

    return NextResponse.json({
      success: true,
      action: "updated",
      validation,
    });
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    console.error("DOC UPDATE ERROR:", error);
    return NextResponse.json({ error: "Failed to update document" }, { status: 500 });
  }
}
