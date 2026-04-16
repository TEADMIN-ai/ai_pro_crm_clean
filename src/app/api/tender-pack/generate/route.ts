import { NextRequest, NextResponse } from "next/server";

import { adminDb } from "@/lib/firebaseAdmin";
import { AuthorizationError, assertPrivilegedRole, requireAuthorizedUser } from "@/lib/server/authz";
import { generateSimplePack } from "@/lib/pdf/generateSimplePack";
import { matchRequirements } from "@/lib/tender/matchRequirements";
import { persistTenderPackPdf } from "@/server/services/tenderPackService";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type GenerateBody = {
  dealId?: string;
};

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuthorizedUser(request);
    assertPrivilegedRole(user);
    const body = (await request.json()) as GenerateBody;
    const dealId = typeof body.dealId === "string" ? body.dealId.trim() : "";

    if (!dealId) {
      throw new Error("Missing dealId");
    }

    const dealSnapshot = await adminDb.collection("deals").doc(dealId).get();
    if (!dealSnapshot.exists) {
      throw new Error("Deal not found");
    }

    const deal = {
      id: dealSnapshot.id,
      ...(dealSnapshot.data() ?? {}),
    } as Record<string, unknown> & { id: string };

    const contractorId =
      typeof deal.contractorId === "string" && deal.contractorId.trim().length > 0
        ? deal.contractorId.trim()
        : "";

    if (!contractorId) {
      throw new Error("Missing deal or contractor data");
    }

    const contractorSnapshot = await adminDb.collection("contractors").doc(contractorId).get();
    if (!contractorSnapshot.exists) {
      throw new Error("Missing deal or contractor data");
    }

    const contractor = {
      id: contractorSnapshot.id,
      ...(contractorSnapshot.data() ?? {}),
    } as Record<string, unknown> & { id: string };
    const match = matchRequirements(contractor, deal);

    if (!match.ready || !contractor.complianceApproved) {
      return NextResponse.json(
        {
          error: "NOT_READY",
          score: match.score,
          missing: match.missing,
          message: "Contractor not ready for this tender",
        },
        { status: 403 }
      );
    }

    console.log("GENERATING PACK FOR:", {
      dealId: deal.id,
      contractorId: contractor.id,
    });

    const pdfBytes = await generateSimplePack(
      {
        id: deal.id,
        title: typeof deal.title === "string" ? deal.title : undefined,
        status: typeof deal.status === "string" ? deal.status : undefined,
        contractorId,
      },
      {
        id: contractor.id,
        name: typeof contractor.name === "string" ? contractor.name : undefined,
        companyName: typeof contractor.companyName === "string" ? contractor.companyName : undefined,
        email:
          typeof contractor.email === "string"
            ? contractor.email
            : typeof contractor.contactEmail === "string"
              ? contractor.contactEmail
              : undefined,
        phone:
          typeof contractor.phone === "string"
            ? contractor.phone
            : typeof contractor.contactPhone === "string"
              ? contractor.contactPhone
              : undefined,
        registrationNumber:
          typeof contractor.registrationNumber === "string"
            ? contractor.registrationNumber
            : typeof contractor.companyRegistrationNumber === "string"
              ? contractor.companyRegistrationNumber
              : undefined,
      }
    );

    const persistedPack = await persistTenderPackPdf({
      createdBy: user.uid,
      contractorId: contractor.id,
      templateKey: "simple",
      pdfBytes,
      missingFields: [],
      warnings: [],
      fieldMapUsed: {
        dealId: deal.id,
        contractorId: contractor.id,
      },
    });

    return NextResponse.json({
      success: true,
      base64: Buffer.from(pdfBytes).toString("base64"),
      packId: persistedPack.packId,
      downloadURL: persistedPack.downloadURL,
      missingFields: [],
      warnings: [],
    });
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    console.error("Tender pack generation failed:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Tender pack generation failed  no fallback allowed",
      },
      { status: 500 }
    );
  }
}
