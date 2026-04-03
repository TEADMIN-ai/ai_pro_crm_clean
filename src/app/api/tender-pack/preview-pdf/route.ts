import { NextRequest, NextResponse } from "next/server";

import { adminAuth, adminDb } from "@/lib/firebaseAdmin";
import { generateMergedPack } from "@/lib/pdf/mergeTenderPack";

export async function GET(req: NextRequest) {
  try {
    const authHeader = req.headers.get("authorization");
    const token = authHeader?.split("Bearer ")[1];

    if (!token) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    await adminAuth.verifyIdToken(token);

    const dealId = req.nextUrl.searchParams.get("dealId");
    if (!dealId) {
      return new NextResponse("Missing dealId", { status: 400 });
    }

    const dealSnap = await adminDb.collection("deals").doc(dealId).get();
    if (!dealSnap.exists) {
      return new NextResponse("Deal not found", { status: 404 });
    }

    const deal = dealSnap.data() ?? {};
    const contractorId =
      typeof deal.contractorId === "string" && deal.contractorId.trim().length > 0
        ? deal.contractorId.trim()
        : "";

    if (!contractorId) {
      return new NextResponse("Missing deal or contractor data", { status: 400 });
    }

    const contractorSnap = await adminDb.collection("contractors").doc(contractorId).get();
    if (!contractorSnap.exists) {
      return new NextResponse("Missing deal or contractor data", { status: 404 });
    }

    const contractor = contractorSnap.data() ?? {};
    const pdfBytes = await generateMergedPack(deal, contractor);

    return new NextResponse(Buffer.from(pdfBytes), {
      headers: {
        "Content-Type": "application/pdf",
      },
    });
  } catch (err: any) {
    console.error("PREVIEW PDF ERROR:", err);
    return new NextResponse(err?.message || "Preview PDF failed", { status: 500 });
  }
}
