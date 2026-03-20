import { NextRequest, NextResponse } from "next/server";

import { buildCompanyProfile } from "@/lib/autofill/buildCompanyProfile";
import { SBD_TEMPLATE_KEYS, type SbdFormKey } from "@/lib/pdfs/templates/sbdSchema";
import { assertPrivilegedRole, AuthorizationError, requireAuthorizedUser } from "@/lib/server/authz";
import {
  CRITICAL_TENDER_FIELD_LABELS,
  getCriticalTenderMissingFields,
} from "@/lib/tender/criticalTenderFields";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type ValidateBody = {
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

    const body = (await request.json()) as ValidateBody;
    const contractorId = typeof body.contractorId === "string" ? body.contractorId.trim() : "";
    const templateKey = typeof body.templateKey === "string" ? body.templateKey.trim() : "";

    if (!contractorId) {
      return jsonError("contractorId is required", 400);
    }

    if (!SBD_TEMPLATE_KEYS.includes(templateKey as SbdFormKey)) {
      return jsonError("Invalid templateKey", 400);
    }

    const profile = await buildCompanyProfile(contractorId);
    const missingFields = getCriticalTenderMissingFields(profile.missingFields);

    return NextResponse.json(
      {
        contractorId,
        templateKey,
        missingFields,
        missingLabels: missingFields.map((field) => CRITICAL_TENDER_FIELD_LABELS[field]),
      },
      { status: 200 }
    );
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return jsonError(error.message, error.status);
    }

    console.error("Tender pack validation failed:", error);
    return jsonError("Failed to validate tender pack", 500);
  }
}
