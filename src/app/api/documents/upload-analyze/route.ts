import { NextRequest } from "next/server";
import { AuthorizationError, assertCanAccessContractor, requireAuthorizedUser } from "@/lib/server/authz";
import { extractTextFromPdf } from "@/lib/extractTextFromPdf";
import { analyzeTenderText } from "@/lib/tenderAnalysisService";
import { getFirebaseAdmin } from "@/lib/firebase/admin";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const db = getFirebaseAdmin();
    const user = await requireAuthorizedUser(req);

    if (!user.role) {
      return Response.json({ error: "Invalid role" }, { status: 403 });
    }

    const formData = await req.formData();

    const file = formData.get("file");
    const dealId = formData.get("dealId");

    if (!(file instanceof File) || typeof dealId !== "string" || !dealId.trim()) {
      return Response.json(
        { error: "file and dealId are required" },
        { status: 400 }
      );
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = new Uint8Array(arrayBuffer);
    const dealSnapshot = await db.collection("deals").doc(dealId).get();

    if (!dealSnapshot.exists) {
      return Response.json({ error: "Deal not found" }, { status: 404 });
    }

    const contractorId = typeof dealSnapshot.data()?.contractorId === "string"
      ? dealSnapshot.data()?.contractorId
      : "";

    if (!contractorId) {
      return Response.json({ error: "Missing contractorId on deal" }, { status: 400 });
    }

    assertCanAccessContractor(user, contractorId);

    const text = await extractTextFromPdf(buffer);
    const normalizedText = text.toLowerCase();
    const analysis = analyzeTenderText(text);
    const compliance = {
      taxClearance: normalizedText.includes("tax"),
      bbbee: normalizedText.includes("bee"),
      cipc: normalizedText.includes("registration"),
      coida: normalizedText.includes("coida"),
    };

    let score = 0;
    Object.values(compliance).forEach((value) => {
      if (value) {
        score += 25;
      }
    });

    const missing = Object.entries(compliance)
      .filter(([, value]) => !value)
      .map(([key]) => key);

    let risk: "LOW" | "MEDIUM" | "HIGH" = "LOW";
    if (score < 60) {
      risk = "HIGH";
    } else if (score < 80) {
      risk = "MEDIUM";
    }

    const suggestions = missing.map((item) => `Upload valid ${item} document`);
    const isTenderLocked = score < 60;

    await db.collection("deals").doc(dealId).update({
      analysis,
      extractedText: text,
      readinessScore: score,
      missingDocs: missing,
      riskLevel: risk,
      suggestions,
      isTenderLocked,
      compliance,
    });

    return Response.json({
      extractedText: text,
      analysis,
      compliance,
      readinessScore: score,
      missingDocs: missing,
      riskLevel: risk,
      suggestions,
      isTenderLocked,
    });
  } catch (error: any) {
    if (error instanceof AuthorizationError) {
      return Response.json({ error: error.message }, { status: error.status });
    }

    console.error(" DOCUMENT PIPELINE ERROR:", error);

    return Response.json(
      { error: "Failed to process document", details: error.message },
      { status: 500 }
    );
  }
}
