import { NextRequest, NextResponse } from "next/server";

import { adminAuth, adminDb } from "@/lib/firebaseAdmin";
import { getTemplates } from "@/lib/pdf/mergeTenderPack";

export async function GET(req: NextRequest) {
  try {
    const authHeader = req.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const token = authHeader.split("Bearer ")[1];
    await adminAuth.verifyIdToken(token);

    const dealId = req.nextUrl.searchParams.get("dealId");
    if (!dealId) {
      return NextResponse.json({ error: "Missing dealId" }, { status: 400 });
    }

    const dealSnap = await adminDb.collection("deals").doc(dealId).get();
    if (!dealSnap.exists) {
      return NextResponse.json({ error: "Deal not found" }, { status: 404 });
    }

    const deal = dealSnap.data() ?? {};
    const templates = getTemplates(deal);

    return NextResponse.json({
      success: true,
      templates,
      templateCount: templates.length,
      dealType: typeof deal.type === "string" && deal.type.trim().length > 0 ? deal.type : "unknown",
    });
  } catch (err: any) {
    console.error("PREVIEW ERROR:", err);
    return NextResponse.json(
      { error: err?.message || "Preview failed" },
      { status: 500 }
    );
  }
}
