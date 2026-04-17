import { NextRequest, NextResponse } from "next/server";
import { getStorage } from "firebase-admin/storage";

import { getFirebaseAdmin } from "@/lib/firebase/admin";
import { AuthorizationError, assertPrivilegedRole, requireAuthorizedUser } from "@/lib/server/authz";
import { buildCompanyProfile } from "@/lib/autofill/buildCompanyProfile";
import { fillTenderPack } from "@/lib/pdfs/empirePdfFill";
import { SBD_TEMPLATE_KEYS, type SbdFormKey } from "@/lib/pdfs/templates/sbdSchema";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type TestFillBody = {
  contractorId?: string;
  templateKey?: string;
};

function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuthorizedUser(request);
    assertPrivilegedRole(user);
    const body = (await request.json()) as TestFillBody;

    const contractorId = typeof body.contractorId === "string" ? body.contractorId.trim() : "";
    const templateKey = typeof body.templateKey === "string" ? body.templateKey.trim() : "";

    if (!contractorId) {
      return jsonError("contractorId is required", 400);
    }

    if (!SBD_TEMPLATE_KEYS.includes(templateKey as SbdFormKey)) {
      return jsonError("Invalid templateKey", 400);
    }

    const profile = await buildCompanyProfile(contractorId);
    const fillResult = await fillTenderPack({
      templateKey: templateKey as SbdFormKey,
      profile,
      outputMode: "preview",
    });

    if ("error" in fillResult) {
      return NextResponse.json(
        {
          error: fillResult.error,
          missingFields: profile.missingFields,
          warnings: fillResult.warnings,
        },
        { status: 422 }
      );
    }

    getFirebaseAdmin();
    const timestamp = Date.now();
    const storagePath = `tender-pack-tests/${contractorId}/${timestamp}-${templateKey}.pdf`;
    const file = getStorage().bucket().file(storagePath);

    await file.save(fillResult.filledPdfBuffer, {
      contentType: "application/pdf",
      metadata: {
        cacheControl: "private, max-age=300",
      },
    });

    const [downloadURL] = await file.getSignedUrl({
      action: "read",
      expires: Date.now() + 1000 * 60 * 60 * 24 * 365 * 10,
    });

    return NextResponse.json(
      {
        downloadURL,
        storagePath,
        contractorId,
        templateKey,
        generatedBy: user.uid,
        missingFields: profile.missingFields,
        warnings: fillResult.warnings,
      },
      { status: 200 }
    );
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return jsonError(error.message, error.status);
    }

    console.error("Tender pack test fill failed:", error);

    return jsonError("Failed to test-fill tender pack", 500);
  }
}
