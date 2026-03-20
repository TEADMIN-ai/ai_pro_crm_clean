import { NextRequest, NextResponse } from "next/server";
import { getAuth } from "firebase-admin/auth";
import { getStorage } from "firebase-admin/storage";

import { buildCompanyProfile } from "@/lib/autofill/buildCompanyProfile";
import { fillTenderPack } from "@/lib/pdfs/empirePdfFill";
import { SBD_TEMPLATE_KEYS, type SbdFormKey } from "@/lib/pdfs/templates/sbdSchema";
import { CRITICAL_TENDER_FIELD_LABELS, getCriticalTenderMissingFields } from "@/lib/tender/criticalTenderFields";
import { createTenderPackRecord } from "@/server/services/tenderPackService";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ALLOWED_ROLES = new Set(["admin", "manager", "staff"]);

type GenerateBody = {
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

    const timestamp = Date.now();
    const storagePath = `tender-packs/${contractorId}/${timestamp}-${templateKey}.pdf`;
    const bucket = getStorage().bucket();
    const file = bucket.file(storagePath);

    await file.save(fillResult.filledPdfBuffer, {
      contentType: "application/pdf",
      metadata: {
        cacheControl: "private, max-age=300",
      },
    });

    const [downloadURL] = await file.getSignedUrl({
      action: "read",
      expires: "2035-01-01",
    });

    const packId = await createTenderPackRecord({
      storagePath,
      downloadURL,
      createdAt: timestamp,
      createdBy: uid,
      contractorId,
      templateKey,
      missingFields: profile.missingFields,
      warnings: fillResult.warnings,
      fieldMapUsed: fillResult.fieldMapUsed,
    });

    return NextResponse.json(
      {
        packId,
        downloadURL,
        missingFields: profile.missingFields,
        warnings: fillResult.warnings,
      },
      { status: 200 }
    );
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
