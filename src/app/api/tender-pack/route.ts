import { NextRequest, NextResponse } from "next/server";

import { getFirebaseAdmin } from "@/lib/firebase/admin";
import { AuthorizationError, assertPrivilegedRole, requireAuthorizedUser } from "@/lib/server/authz";
import { generateMergedPack, getMergedPackTemplateIds } from "@/lib/pdf/mergeTenderPack";
import { persistTenderPackPdf } from "@/server/services/tenderPackService";
import { assertApprovedClientQuote } from "@/server/services/commercialAuthorityService";
import { registerTenderPackDocument } from "@/server/services/tenderPackCommercialAuthorityService";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const db = getFirebaseAdmin();
    const user = await requireAuthorizedUser(request);
    assertPrivilegedRole(user);
    const dealId = request.nextUrl.searchParams.get("dealId")?.trim() ?? "";
    const clientQuoteId = request.nextUrl.searchParams.get("clientQuoteId")?.trim() ?? "";

    if (!dealId) {
      throw new Error("Missing dealId");
    }

    const dealSnapshot = await db.collection("deals").doc(dealId).get();
    if (!dealSnapshot.exists) {
      throw new Error("Deal not found");
    }

    const deal = {
      id: dealSnapshot.id,
      ...(dealSnapshot.data() ?? {}),
    } as Record<string, unknown> & { id: string };

    await assertApprovedClientQuote({ opportunityId: deal.id, clientQuoteId, actor: user });

    const contractorId =
      typeof deal.contractorId === "string" && deal.contractorId.trim().length > 0
        ? deal.contractorId.trim()
        : "";

    if (!contractorId) {
      throw new Error("Missing deal or contractor data");
    }

    const contractorSnapshot = await db.collection("contractors").doc(contractorId).get();
    if (!contractorSnapshot.exists) {
      throw new Error("Missing deal or contractor data");
    }

    const contractor = {
      id: contractorSnapshot.id,
      ...(contractorSnapshot.data() ?? {}),
    } as Record<string, unknown> & { id: string };

    console.log("GENERATING PACK FOR:", {
      dealId: deal.id,
      contractorId: contractor.id,
    });

    const templateIds = getMergedPackTemplateIds(deal);
    const pdfBytes = await generateMergedPack(deal, contractor);

    const persistedPack = await persistTenderPackPdf({
      createdBy: user.uid,
      contractorId: contractor.id,
      templateKey: templateIds.join("-"),
      pdfBytes,
      missingFields: [],
      warnings: [],
      fieldMapUsed: {
        dealId: deal.id,
        contractorId: contractor.id,
        templateIds: templateIds.join(","),
      },
    });

    const tenderPackDocumentId = await registerTenderPackDocument({ packId: persistedPack.packId, opportunityId: deal.id, workspaceId: typeof deal.workspaceId === "string" ? deal.workspaceId : null, clientQuoteId, storagePath: persistedPack.storagePath, filename: persistedPack.fileName, actor: user });

    return new NextResponse(Buffer.from(pdfBytes), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename=${deal.id}-tender-pack.pdf`,
        "X-Tender-Pack-Id": persistedPack.packId,
        "X-Tender-Pack-Url": persistedPack.downloadURL,
        "X-Tender-Pack-Document-Id": tenderPackDocumentId,
      },
    });
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    console.error("Tender pack generation failed:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Tender pack generation failed",
      },
      { status: 500 }
    );
  }
}
