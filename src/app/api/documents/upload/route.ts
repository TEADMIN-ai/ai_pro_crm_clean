import { NextRequest, NextResponse } from "next/server";

import admin from "@/lib/firebase/admin";
import { updateContractorIntelligence } from "@/lib/contractors/updateContractorIntelligence";

function jsonError(message: string, status = 500) {
  return NextResponse.json({ error: message }, { status });
}

export async function POST(req: NextRequest) {
  console.log("🔥 UPLOAD STARTED");

  try {
    const formData = await req.formData();

    const uploadedFile = formData.get("file");
    const contractorId = String(formData.get("contractorId") ?? "").trim();
    const documentType = String(formData.get("documentType") ?? "").trim();

    console.log("Incoming Data:", {
      hasFile: uploadedFile instanceof File,
      contractorId,
      documentType,
    });

    if (!(uploadedFile instanceof File) || !contractorId || !documentType) {
      return jsonError("Missing required fields", 400);
    }

    const buffer = Buffer.from(await uploadedFile.arrayBuffer());
    const bucket = admin.storage().bucket();
    const timestamp = Date.now();
    const file = bucket.file(`contractors/${contractorId}/${documentType}_${timestamp}.pdf`);

    console.log("📦 Bucket:", bucket.name);
    console.log("📁 Path:", file.name);
    console.log("👤 Contractor:", contractorId);
    console.log("📄 Doc Type:", documentType);

    await file.save(buffer, {
      contentType: uploadedFile.type || "application/pdf",
      resumable: false,
      metadata: {
        cacheControl: "private, max-age=0, no-transform",
      },
    });

    console.log("✅ File uploaded");

    const [fileUrl] = await file.getSignedUrl({
      action: "read",
      expires: Date.now() + 1000 * 60 * 60 * 24 * 365 * 10,
    });

    console.log("File URL:", fileUrl);
    console.log("💾 Writing to Firestore...");

    const documentRef = admin
      .firestore()
      .collection("contractors")
      .doc(contractorId)
      .collection("documents")
      .doc(documentType);

    await admin
      .firestore()
      .collection("contractors")
      .doc(contractorId)
      .collection("documents")
      .doc(documentType)
      .set({
        contractorId,
        documentType,
        docType: documentType,
        documentName: uploadedFile.name,
        fileName: uploadedFile.name,
        originalName: uploadedFile.name,
        filename: file.name,
        storagePath: file.name,
        fileUrl,
        downloadURL: fileUrl,
        url: fileUrl,
        uploadedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
        verified: false,
        verifiedAt: null,
        aiStatus: "pending",
        aiError: null,
        aiValidated: false,
        validationError: null,
        status: "uploaded",
        isExpired: false,
      });

    console.log("✅ Firestore write complete");

    const intelligenceSummary = await updateContractorIntelligence(admin.firestore(), contractorId);

    const savedDocument = await documentRef.get();

    return NextResponse.json(
      {
        success: true,
        document: {
          id: savedDocument.id,
          ...(savedDocument.data() ?? {}),
        },
        compliance: {
          complianceScore: intelligenceSummary.complianceScore,
          complianceCompleted: intelligenceSummary.complianceCompleted,
          complianceMissing: intelligenceSummary.complianceMissing,
          complianceStatus: intelligenceSummary.complianceStatus,
        },
        readiness: {
          documentQualityScore: intelligenceSummary.documentQualityScore,
          readinessScore: intelligenceSummary.readinessScore,
          readinessStatus: intelligenceSummary.readinessStatus,
        },
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("🔥 UPLOAD ERROR:", error);

    return jsonError(error instanceof Error ? error.message : "Upload failed", 500);
  }
}
