import { NextRequest, NextResponse } from "next/server";
import { adminStorage, adminDb } from "@/lib/firebaseAdmin";

export async function POST(req: NextRequest) {
  console.log("📥 DOCUMENT UPLOAD START");

  try {
    const formData = await req.formData();

    const file = formData.get("file") as File;
    const contractorId = formData.get("contractorId") as string;
    const documentType = formData.get("documentType") as string;

    console.log("📊 Incoming Data:", {
      hasFile: !!file,
      contractorId,
      documentType,
    });

    if (!file || !contractorId || !documentType) {
      console.error("❌ Missing fields");
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());

    const filePath = `contractors/${contractorId}/${documentType}/${file.name}`;

    console.log("📁 Uploading to:", filePath);

    const bucket = adminStorage.bucket();
    const blob = bucket.file(filePath);

    await blob.save(buffer, {
      contentType: file.type,
    });

    const fileUrl = `https://storage.googleapis.com/${bucket.name}/${filePath}`;

    console.log("✅ Uploaded to storage:", fileUrl);

    const docRef = await adminDb
      .collection("documents")
      .add({
        contractorId,
        documentType,
        fileUrl,
        status: "pending",
        uploadedAt: new Date().toISOString(),
      });

    console.log("✅ Saved to Firestore:", docRef.id);

    return NextResponse.json({
      success: true,
      fileUrl,
    });

  } catch (error: any) {
    console.error("🔥 UPLOAD ERROR:", error);

    return NextResponse.json(
      {
        error: error.message || "Upload failed",
      },
      { status: 500 }
    );
  }
}