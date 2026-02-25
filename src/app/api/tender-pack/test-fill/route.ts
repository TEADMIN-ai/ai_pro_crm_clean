import { NextRequest, NextResponse } from "next/server";
import { getAuth } from "firebase-admin/auth";
import { getStorage } from "firebase-admin/storage";

import { getFirebaseAdmin } from "@/lib/firebase/admin";
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

async function requireAdmin(request: NextRequest): Promise<{ uid: string }> {
  const authHeader = request.headers.get("authorization") ?? "";
  const token = authHeader.startsWith("Bearer ")
    ? authHeader.slice("Bearer ".length).trim()
    : "";

  if (!token) {
    throw new Error("Missing Authorization token");
  }

  const decoded = await getAuth().verifyIdToken(token);
  const role = typeof decoded.role === "string" ? decoded.role : "";
  if (role !== "admin") {
    throw new Error("Forbidden");
  }

  return { uid: decoded.uid };
}

export async function POST(request: NextRequest) {
  try {
    const { uid } = await requireAdmin(request);
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
      expires: "2035-01-01",
    });

    return NextResponse.json(
      {
        downloadURL,
        storagePath,
        contractorId,
        templateKey,
        generatedBy: uid,
        missingFields: profile.missingFields,
        warnings: fillResult.warnings,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Tender pack test fill failed:", error);

    const message = error instanceof Error ? error.message : "Internal server error";
    if (message === "Missing Authorization token") {
      return jsonError(message, 401);
    }
    if (message === "Forbidden") {
      return jsonError(message, 403);
    }

    return jsonError("Failed to test-fill tender pack", 500);
  }
}
