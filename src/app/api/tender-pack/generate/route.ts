import { NextRequest, NextResponse } from "next/server";

import { getFirebaseAdmin } from "@/lib/firebase/admin";
import { AuthorizationError, assertPrivilegedRole, requireAuthorizedUser } from "@/lib/server/authz";
import { generateMergedPack } from "@/lib/pdf/mergeTenderPack";
import { generateSimplePack } from "@/lib/pdf/generateSimplePack";
import { recalculateContractorCompliance } from "@/lib/server/recalculateContractorCompliance";
import { persistTenderPackPdf } from "@/server/services/tenderPackService";
import { getTenderPackRequest, markTenderPackRequestGenerated } from "@/server/services/tenderPackRequestService";
import { recordAuditLog } from "@/server/services/auditLogService";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type GenerateBody = {
  dealId?: string;
  requestId?: string;
};

function isEmpirePdfGenerationEnabled(): boolean {
  const value = process.env.EMPIREPDF_GENERATION_ENABLED?.trim().toLowerCase();
  return value === "true" || value === "1" || value === "yes";
}

export async function POST(request: NextRequest) {
  try {
    const db = getFirebaseAdmin();
    const user = await requireAuthorizedUser(request);
    assertPrivilegedRole(user);
    const body = (await request.json()) as GenerateBody;
    const dealId = typeof body.dealId === "string" ? body.dealId.trim() : "";
    const requestId = typeof body.requestId === "string" ? body.requestId.trim() : "";

    if (!dealId) {
      throw new Error("Missing dealId");
    }

    const tenderPackRequest = requestId ? await getTenderPackRequest(requestId) : null;
    if (requestId && !tenderPackRequest) {
      throw new Error("Tender pack request not found");
    }
    if (tenderPackRequest && tenderPackRequest.status !== "approved") {
      return NextResponse.json(
        {
          error: "REQUEST_NOT_APPROVED",
          message: "Tender pack request must be approved before generation",
        },
        { status: 403 }
      );
    }
    if (tenderPackRequest && user.role !== "admin") {
      return NextResponse.json(
        {
          error: "REQUEST_GENERATION_ADMIN_REQUIRED",
          message: "Only an admin can generate an approved contractor tender pack request",
        },
        { status: 403 }
      );
    }

    const dealSnapshot = await db.collection("deals").doc(dealId).get();
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

    if (
      tenderPackRequest &&
      (tenderPackRequest.dealId !== deal.id || tenderPackRequest.contractorId !== contractorId)
    ) {
      return NextResponse.json(
        {
          error: "REQUEST_DEAL_MISMATCH",
          message: "Tender pack request does not match this deal and contractor",
        },
        { status: 400 }
      );
    }

    const contractorSnapshot = await db.collection("contractors").doc(contractorId).get();
    if (!contractorSnapshot.exists) {
      throw new Error("Missing deal or contractor data");
    }

    const contractor = {
      id: contractorSnapshot.id,
      ...(contractorSnapshot.data() ?? {}),
    } as Record<string, unknown> & { id: string };
    const compliance = await recalculateContractorCompliance(db, contractorId);
    const unresolvedDocuments = Object.entries(compliance.legacyDocuments)
      .filter(([, value]) => value.valid !== true)
      .map(([key]) => key);

    if (
      compliance.complianceApproved !== true ||
      compliance.docsMissing > 0 ||
      compliance.expiredDocumentCount > 0 ||
      compliance.tenderLockStatus !== "READY"
    ) {
      return NextResponse.json(
        {
          error: "NOT_READY",
          score: compliance.readinessScore,
          missing: unresolvedDocuments,
          message: "Contractor not ready for this tender",
        },
        { status: 403 }
      );
    }

    console.log("GENERATING PACK FOR:", {
      dealId: deal.id,
      contractorId: contractor.id,
    });

    const empirePdfGenerationEnabled = isEmpirePdfGenerationEnabled();
    const templateKey = empirePdfGenerationEnabled ? "summary-sbd1-sbd4" : "simple";
    const pdfCompliance = {
      readinessScore: compliance.readinessScore,
      tenderLockStatus: compliance.tenderLockStatus,
      complianceApproved: compliance.complianceApproved,
      riskGrade: compliance.intelligence.riskGrade,
      docsMissing: compliance.docsMissing,
      missingDocumentTypes: compliance.missingDocumentTypes,
      expiredDocumentCount: compliance.expiredDocumentCount,
      legacyDocuments: compliance.legacyDocuments,
      intelligence: compliance.intelligence,
    };
    const pdfBytes = empirePdfGenerationEnabled
      ? await generateMergedPack(deal, contractor, pdfCompliance)
      : await generateSimplePack(
          {
            id: deal.id,
            title: typeof deal.title === "string" ? deal.title : undefined,
            status: typeof deal.status === "string" ? deal.status : undefined,
            contractorId,
            readinessScore: compliance.readinessScore,
            tenderLockStatus: compliance.tenderLockStatus,
            complianceApproved: compliance.complianceApproved,
            riskGrade: compliance.intelligence.riskGrade,
            docsMissing: compliance.docsMissing,
            missingDocs: unresolvedDocuments,
            missingRequirements: unresolvedDocuments,
            suggestions: compliance.intelligence.reviewRecommendations,
            compliance: pdfCompliance,
          },
          {
            id: contractor.id,
            name: typeof contractor.name === "string" ? contractor.name : undefined,
            companyName: typeof contractor.companyName === "string" ? contractor.companyName : undefined,
            csdNumber:
              typeof contractor.csdNumber === "string"
                ? contractor.csdNumber
                : typeof contractor.csdRegistrationNumber === "string"
                  ? contractor.csdRegistrationNumber
                  : undefined,
            contactPerson:
              typeof contractor.contactPerson === "string"
                ? contractor.contactPerson
                : typeof contractor.contactName === "string"
                  ? contractor.contactName
                  : undefined,
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
            readinessScore: compliance.readinessScore,
            tenderLockStatus: compliance.tenderLockStatus,
            complianceApproved: compliance.complianceApproved,
            riskGrade: compliance.intelligence.riskGrade,
            docsMissing: compliance.docsMissing,
            missingDocumentTypes: compliance.missingDocumentTypes,
            missingCriticalDocuments: compliance.intelligence.missingCriticalDocuments,
            explainableSummary: compliance.intelligence.explainableSummary,
            blockedReasons: compliance.intelligence.blockedReasons,
            reviewRecommendations: compliance.intelligence.reviewRecommendations,
            complianceDocumentBreakdown: compliance.intelligence.documentBreakdown,
            documents: compliance.legacyDocuments,
          }
        );

    const persistedPack = await persistTenderPackPdf({
      createdBy: user.uid,
      contractorId: contractor.id,
      templateKey,
      pdfBytes,
      missingFields: [],
      warnings: [],
      fieldMapUsed: {
        dealId: deal.id,
        contractorId: contractor.id,
        generationMode: templateKey,
      },
    });

    if (tenderPackRequest) {
      await markTenderPackRequestGenerated({
        requestId: tenderPackRequest.id,
        actor: user,
        packId: persistedPack.packId,
        downloadURL: persistedPack.downloadURL,
      });

      await recordAuditLog({
        userId: user.uid,
        action: "TENDER_PACK_REQUEST_GENERATED",
        entityType: "tenderPackRequest",
        entityId: tenderPackRequest.id,
        metadata: {
          contractorId: contractor.id,
          dealId: deal.id,
          packId: persistedPack.packId,
        },
      });
    }

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
