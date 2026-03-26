"use server";

import { NextResponse } from "next/server";

import { getFirebaseAdmin } from "@/lib/firebase/admin";
import { extractTextFromPdf } from "@/lib/pdf/extractTextFromPdf";
import { runAIAnalysis } from "@/lib/services/aiService";
import { calculateReadiness } from "@/lib/services/readinessService";

export async function POST(
  req: Request,
  context: { params: Promise<{ documentId: string }> }
) {
  const { documentId } = await context.params;
  const body = await req.json();
  const { contractorId } = body;

  if (!documentId || documentId.trim() === "") {
    return NextResponse.json({ error: "INVALID_DOCUMENT_ID" }, { status: 400 });
  }

  if (!contractorId) {
    return NextResponse.json({
      error: "MISSING_CONTRACTOR_ID"
    }, { status: 400 });
  }

  try {
    console.log("DOCUMENT EXECUTION START:", documentId);
    console.log("Using documentId:", documentId);
    console.log("EXECUTE:", { contractorId, documentId });

    const db = getFirebaseAdmin();
    const docRef = db.collection("contractors")
      .doc(contractorId)
      .collection("documents")
      .doc(documentId);
    const doc = await docRef.get();

    if (!doc.exists) {
      return NextResponse.json({
        error: "DOCUMENT_NOT_FOUND"
      }, { status: 404 });
    }

    const document = doc.data() as any;

    if (!document?.fileUrl) {
      throw new Error("FILE_URL_MISSING");
    }

    const res = await fetch(document.fileUrl as string);

    if (!res.ok) {
      throw new Error("FILE_FETCH_FAILED");
    }

    const arrayBuffer = await res.arrayBuffer();
    const uint8Array = new Uint8Array(arrayBuffer);
    const text: string = await extractTextFromPdf(uint8Array);

    console.log("Extracted text length:", text?.length || 0);

    function parseExpiryDate(dateStr?: string | null) {
      if (!dateStr) return null;

      const clean = dateStr.replace(/[\.\-]/g, "/").trim();
      const parts = clean.split("/");

      if (parts.length === 3) {
        const [d, m, y] = parts.map(Number);
        if (y > 1900) return new Date(y, m - 1, d);
      }

      const fallback = new Date(dateStr);
      return isNaN(fallback.getTime()) ? null : fallback;
    }

    let aiResult;

    try {
      aiResult = await runAIAnalysis(text);
    } catch (err) {
      aiResult = {
        finalStatus: "FAIL",
        suggestions: ["AI analysis failed"],
        extractedFields: {},
      };
    }

    const today = new Date();
    let isExpired = false;

    let expiryRaw = aiResult.extractedFields?.expiryDate;

    if (!expiryRaw && text) {
      const match = text.match(
        /\b(\d{1,2}[\/\-\s](Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec|\d{1,2})[\/\-\s]\d{2,4})\b/i
      );

      if (match) {
        expiryRaw = match[0];
      }
    }

    if (!expiryRaw) {
      aiResult.finalStatus = "FAIL";

      aiResult.suggestions = [
        ...(aiResult.suggestions || []),
        "Expiry date not detected  verify document manually"
      ];
    }

    console.log("EXPIRY DETECTED:", expiryRaw);

    const expiry = parseExpiryDate(expiryRaw);

    if (expiry && expiry < today) {
      isExpired = true;
    }

    let verified = false;
    let status = "PENDING_REVIEW";

    if (aiResult.finalStatus === "FAIL") {
      status = "FLAGGED";
    }

    if (isExpired) {
      verified = false;
      aiResult.finalStatus = "FAIL";
      status = "FLAGGED";

      aiResult.suggestions = [
        ...(aiResult.suggestions || []),
        "Document is expired and must be renewed",
      ];
    }

    const processedAt = new Date().toISOString();

    await docRef.update({
      extractedText: text ?? "",
      aiAnalysis: aiResult ?? {},
      suggestions: aiResult?.suggestions ?? [],
      verified,
      isExpired,
      status,
      processedAt,
    } as any);

    if (contractorId) {
      // 1. UPDATE DOCUMENT FIRST
      await db
        .collection("contractors")
        .doc(contractorId)
        .collection("documents")
        .doc(documentId)
        .set({
          ...document,
          extractedText: text ?? "",
          verified: false,
          status,
          aiAnalysis: aiResult,
          suggestions: aiResult?.suggestions ?? [],
          isExpired,
          processedAt,
        }, { merge: true });

      // 2. THEN FETCH UPDATED DOCUMENTS
      const contractorDocsSnapshot = await db
        .collection("contractors")
        .doc(contractorId)
        .collection("documents")
        .get();

      const documents = contractorDocsSnapshot.docs.map((doc) => {
        const data = doc.data();

        return {
          ...data,
          verified: data.verified ?? false,
          isExpired: data.isExpired ?? false,
        };
      });

      // 3. THEN CALCULATE
      const readinessScore = calculateReadiness(documents);

      await db.collection("contractors").doc(contractorId).update({
        readinessScore,
      });
    }

    return NextResponse.json({
      success: true,
      textLength: text?.length ?? 0,
    });
  } catch (error: any) {
    console.error("DOCUMENT EXECUTION FAILED:", error);

    return NextResponse.json(
      {
        error: error?.message || "UNKNOWN_ERROR",
      },
      { status: 500 }
    );
  }
}

export async function GET(
  req: Request,
  context: { params: Promise<{ documentId: string }> }
) {
  return POST(req, context);
}
