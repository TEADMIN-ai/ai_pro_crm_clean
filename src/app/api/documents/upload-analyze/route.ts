import { NextRequest } from "next/server";
import { AuthorizationError, assertCanAccessContractor, requireAuthorizedUser } from "@/lib/server/authz";
import { extractTextFromPdf } from "@/lib/extractTextFromPdf";
import { analyzeTenderText } from "@/lib/tenderAnalysisService";
import { adminDb } from "@/lib/firebaseAdmin";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
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
    const dealSnapshot = await adminDb.collection("deals").doc(dealId).get();

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
    const analysis = analyzeTenderText(text);

    await adminDb.collection("deals").doc(dealId).update({
      analysis,
      extractedText: text,
    });

    return Response.json({
      extractedText: text,
      analysis,
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
