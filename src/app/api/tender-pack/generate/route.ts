import { NextRequest, NextResponse } from "next/server";
import { getAuth } from "firebase-admin/auth";
import { PDFDocument, StandardFonts } from "pdf-lib";

import { buildCompanyProfile } from "@/lib/autofill/buildCompanyProfile";
import { fillTenderPack } from "@/lib/pdfs/empirePdfFill";
import { SBD_TEMPLATE_KEYS, type SbdFormKey } from "@/lib/pdfs/templates/sbdSchema";
import { CRITICAL_TENDER_FIELD_LABELS, getCriticalTenderMissingFields } from "@/lib/tender/criticalTenderFields";
import { getContractorById, listContractorDocuments } from "@/server/services/contractorService";
import { getDealById } from "@/server/services/dealService";
import { persistTenderPackPdf } from "@/server/services/tenderPackService";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ALLOWED_ROLES = new Set(["admin", "manager", "staff"]);

type GenerateBody = {
  dealId?: string;
  contractorId?: string;
  templateKey?: string;
};

function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

async function requireRole(request: NextRequest): Promise<{ uid: string; role: string }> {
  const authHeader = request.headers.get("authorization") ?? "";
  const token = authHeader.startsWith("Bearer ")
    ? authHeader.slice("Bearer ".length).trim()
    : "";

  if (!token) {
    throw new Error("Missing Authorization token");
  }

  const decoded = await getAuth().verifyIdToken(token);
  const role = typeof decoded.role === "string" ? decoded.role : "";
  if (!ALLOWED_ROLES.has(role)) {
    throw new Error("Forbidden");
  }

  return { uid: decoded.uid, role };
}

export async function POST(request: NextRequest) {
  try {
    const { uid } = await requireRole(request);
    const body = (await request.json()) as GenerateBody;
    console.log("API Body:", body);

    const dealId = typeof body.dealId === "string" ? body.dealId.trim() : "";
    const contractorId = typeof body.contractorId === "string" ? body.contractorId.trim() : "";
    const templateKey = typeof body.templateKey === "string" ? body.templateKey.trim() : "";

    if (!contractorId) {
      return jsonError("contractorId is required", 400);
    }

    if (!SBD_TEMPLATE_KEYS.includes(templateKey as SbdFormKey)) {
      return jsonError("Invalid templateKey", 400);
    }

    const profile = await buildCompanyProfile(contractorId);
    const criticalMissingFields = getCriticalTenderMissingFields(profile.missingFields);
    if (criticalMissingFields.length > 0) {
      return NextResponse.json(
        {
          error: "Missing critical contractor fields",
          missingFields: criticalMissingFields,
          warnings: criticalMissingFields.map((field) => `Missing ${CRITICAL_TENDER_FIELD_LABELS[field]}`),
        },
        { status: 422 }
      );
    }

    console.log("Mapped Data:", profile);
    const fillResult = await fillTenderPack({
      templateKey: templateKey as SbdFormKey,
      profile,
      outputMode: "final",
    });

    if (!fillResult.ok) {
      return NextResponse.json(
        {
          error: fillResult.error,
          missingFields: profile.missingFields,
          warnings: fillResult.warnings,
        },
        { status: 422 }
      );
    }

    const persistedPack = await persistTenderPackPdf({
      createdBy: uid,
      contractorId,
      templateKey,
      pdfBytes: fillResult.filledPdfBuffer,
      missingFields: profile.missingFields,
      warnings: fillResult.warnings,
      fieldMapUsed: fillResult.fieldMapUsed,
    });

    const [deal, contractor, documents] = await Promise.all([
      dealId ? getDealById(dealId) : Promise.resolve(null),
      getContractorById(contractorId),
      listContractorDocuments(contractorId),
    ]);

    const payload = {
      packId: persistedPack.packId,
      downloadURL: persistedPack.downloadURL,
      missingFields: profile.missingFields,
      warnings: fillResult.warnings,
    };

    console.log("Tender Pack Payload:", payload);
    const contractorData =
      contractor && typeof contractor === "object" ? (contractor as Record<string, unknown>) : null;

    const summary = {
      dealTitle: deal?.title || "Untitled Deal",
      value: deal?.value || 0,
      contractorName:
        (typeof contractorData?.companyName === "string" && contractorData.companyName) ||
        (typeof contractorData?.registrationNumber === "string" && contractorData.registrationNumber) ||
        "Unknown Contractor",
      complianceStatus: documents.length > 0 ? "Documents Available" : "No Documents",
      documentCount: documents.length,
      generatedAt: new Date().toISOString(),
    };

    console.log("Tender Pack Summary:", summary);
    const formattedValue = new Intl.NumberFormat("en-ZA", {
      style: "currency",
      currency: "ZAR",
    }).format(summary.value);

    const pdfDoc = await PDFDocument.create();
    const page = pdfDoc.addPage([600, 400]);
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const logoUrl = new URL("/logo.png", request.nextUrl.origin).toString();
    let y = 350;

    try {
      const logoResponse = await fetch(logoUrl);
      if (logoResponse.ok) {
        const logoBytes = await logoResponse.arrayBuffer();
        const logoImage = await pdfDoc.embedPng(logoBytes);

        page.drawImage(logoImage, {
          x: 50,
          y: 330,
          width: 120,
          height: 40,
        });

        y = 270;
      }
    } catch (logoError) {
      console.warn("Failed to load tender pack logo:", logoError);
    }

    const drawText = (text: string) => {
      page.drawText(text, {
        x: 50,
        y,
        size: 12,
        font,
      });
      y -= 20;
    };

    drawText("TORQUE EMPIRE");
    drawText("Tender Pack Summary");
    drawText("--------------------------------------");
    y -= 15;

    drawText("DEAL INFORMATION");
    drawText(`Title: ${summary.dealTitle}`);
    drawText(`Value: ${formattedValue}`);
    y -= 15;

    drawText("CONTRACTOR");
    drawText(`${summary.contractorName}`);
    y -= 15;

    drawText("COMPLIANCE");
    drawText(`Documents: ${summary.documentCount}`);
    drawText(`Status: ${summary.complianceStatus}`);
    y -= 15;

    drawText("SYSTEM GENERATED");
    drawText(`${summary.generatedAt}`);

    const pdfBytes = await pdfDoc.save();
    const pdfBlob = new Blob([Buffer.from(pdfBytes)], { type: "application/pdf" });

    return new Response(pdfBlob, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": "attachment; filename=tender-pack.pdf",
      },
    });
  } catch (error) {
    console.error("Tender pack generation failed:", error);

    const message = error instanceof Error ? error.message : "Internal server error";
    if (message === "Missing Authorization token") {
      return jsonError(message, 401);
    }
    if (message === "Forbidden") {
      return jsonError(message, 403);
    }

    return jsonError("Failed to generate tender pack", 500);
  }
}
