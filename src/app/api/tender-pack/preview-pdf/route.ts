import { NextRequest, NextResponse } from "next/server";

import { adminDb } from "@/lib/firebaseAdmin";
import { AuthorizationError, assertPrivilegedRole, requireAuthorizedUser } from "@/lib/server/authz";
import { generateMergedPack } from "@/lib/pdf/mergeTenderPack";

export async function GET(req: NextRequest) {
  try {
    const user = await requireAuthorizedUser(req);
    assertPrivilegedRole(user);

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
  } catch (err: unknown) {
    if (err instanceof AuthorizationError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }

    console.error("PREVIEW PDF ERROR:", err);
    const message = err instanceof Error ? err.message : "Preview PDF failed";
    return new NextResponse(message, { status: 500 });
  }
}
