import { NextRequest, NextResponse } from "next/server";
import {
  AuthorizationError,
  assertCanAccessContractor,
  requireAuthorizedUser,
} from "@/lib/server/authz";
import {
  CONTRACTOR_ACKNOWLEDGEMENT_VERSION,
  createContractorAcknowledgement,
  getLatestContractorAcknowledgement,
} from "@/server/services/contractorAcknowledgementService";

function jsonError(message: string, status = 500) {
  return NextResponse.json({ error: message }, { status });
}

function getString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function getClientIp(request: NextRequest): string | null {
  const forwardedFor = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwardedFor || request.headers.get("x-real-ip")?.trim() || null;
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ contractorId: string }> },
) {
  try {
    const user = await requireAuthorizedUser(request);
    const { contractorId } = await context.params;

    if (!contractorId) {
      return jsonError("Missing contractorId", 400);
    }

    assertCanAccessContractor(user, contractorId);

    const latest = await getLatestContractorAcknowledgement(contractorId);
    return NextResponse.json({ acknowledgement: latest }, { status: 200 });
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return jsonError(error.message, error.status);
    }

    console.error("CONTRACTOR ACKNOWLEDGEMENT FETCH ERROR:", error);
    return jsonError("Failed to fetch acknowledgement", 500);
  }
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ contractorId: string }> },
) {
  try {
    const user = await requireAuthorizedUser(request);
    const { contractorId } = await context.params;

    if (!contractorId) {
      return jsonError("Missing contractorId", 400);
    }

    assertCanAccessContractor(user, contractorId);

    const body = (await request.json()) as Record<string, unknown>;
    const signedByName = getString(body.signedByName);
    const signedByCapacity = getString(body.signedByCapacity);
    const signatureText = getString(body.signatureText);
    const acknowledgementVersion = getString(body.acknowledgementVersion) || CONTRACTOR_ACKNOWLEDGEMENT_VERSION;

    const acknowledgement = await createContractorAcknowledgement({
      contractorId,
      userUid: user.uid,
      signedByName,
      signedByCapacity,
      signatureText,
      acceptedTerms: body.acceptedTerms === true,
      authorityConfirmed: body.authorityConfirmed === true,
      acknowledgementVersion,
      ipAddress: getClientIp(request),
      userAgent: request.headers.get("user-agent")?.slice(0, 500) ?? null,
    });

    return NextResponse.json({ acknowledgement }, { status: 201 });
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return jsonError(error.message, error.status);
    }

    const message = error instanceof Error ? error.message : "Failed to save acknowledgement";
    const status = message.includes("required") || message.includes("Missing") ? 400 : 500;
    if (status === 500) {
      console.error("CONTRACTOR ACKNOWLEDGEMENT SAVE ERROR:", error);
    }
    return jsonError(message, status);
  }
}
