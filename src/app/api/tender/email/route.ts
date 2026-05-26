import { NextRequest, NextResponse } from "next/server";

import { getFirebaseAdmin } from "@/lib/firebase/admin";
import { generateSimplePack } from "@/lib/pdf/generateSimplePack";
import { AuthorizationError, assertCanAccessContractor, requireAuthorizedUser } from "@/lib/server/authz";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type EmailBody = {
  dealId?: string;
};

type DealAnalysis = {
  missing?: string[];
  score?: number;
  risk?: string;
};

function normalizeDealAnalysis(value: unknown): DealAnalysis | undefined {
  if (!value || typeof value !== "object") {
    return undefined;
  }

  const candidate = value as Record<string, unknown>;

  return {
    missing: Array.isArray(candidate.missing)
      ? candidate.missing.filter((item): item is string => typeof item === "string")
      : undefined,
    score: typeof candidate.score === "number" ? candidate.score : undefined,
    risk: typeof candidate.risk === "string" ? candidate.risk : undefined,
  };
}

export async function POST(req: NextRequest) {
  try {
    const db = getFirebaseAdmin();
    const user = await requireAuthorizedUser(req);

    if (!user.role) {
      return NextResponse.json({ error: "Invalid role" }, { status: 403 });
    }

    const body = (await req.json()) as EmailBody;
    const dealId = typeof body.dealId === "string" ? body.dealId.trim() : "";

    if (!dealId) {
      return NextResponse.json({ error: "dealId required" }, { status: 400 });
    }

    const dealDoc = await db.collection("deals").doc(dealId).get();

    if (!dealDoc.exists) {
      return NextResponse.json({ error: "Deal not found" }, { status: 404 });
    }

    const dealData = dealDoc.data() ?? {};
    const contractorId =
      typeof dealData.contractorId === "string" ? dealData.contractorId.trim() : "";

    if (!contractorId) {
      return NextResponse.json(
        { error: "Missing contractorId on deal" },
        { status: 400 },
      );
    }

    assertCanAccessContractor(user, contractorId);

    const contractorDoc = await db.collection("contractors").doc(contractorId).get();

    if (!contractorDoc.exists) {
      return NextResponse.json({ error: "Contractor not found" }, { status: 404 });
    }

    const contractorData = contractorDoc.data() ?? {};

    await generateSimplePack(
      {
        id: dealDoc.id,
        title:
          typeof dealData.title === "string"
            ? dealData.title
            : typeof dealData.name === "string"
              ? dealData.name
              : undefined,
        status: typeof dealData.status === "string" ? dealData.status : undefined,
        contractorId,
        analysis: normalizeDealAnalysis(dealData.analysis),
      },
      {
        id: contractorDoc.id,
        name: typeof contractorData.name === "string" ? contractorData.name : undefined,
        companyName:
          typeof contractorData.companyName === "string"
            ? contractorData.companyName
            : typeof contractorData.company === "string"
              ? contractorData.company
              : undefined,
        email:
          typeof contractorData.email === "string"
            ? contractorData.email
            : typeof contractorData.contactEmail === "string"
              ? contractorData.contactEmail
              : undefined,
        phone:
          typeof contractorData.phone === "string"
            ? contractorData.phone
            : typeof contractorData.contactPhone === "string"
              ? contractorData.contactPhone
              : undefined,
        registrationNumber:
          typeof contractorData.registrationNumber === "string"
            ? contractorData.registrationNumber
            : typeof contractorData.companyRegistrationNumber === "string"
              ? contractorData.companyRegistrationNumber
              : undefined,
      },
    );

    console.log("EMAIL READY FOR:", contractorData.email ?? contractorData.contactEmail ?? null);

    return NextResponse.json({
      success: true,
      message: "Email system ready (connect Resend/SMTP next)",
    });
  } catch (error: unknown) {
    if (error instanceof AuthorizationError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    return NextResponse.json(
      {
        error: "Email failed",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
