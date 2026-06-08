import { NextRequest, NextResponse } from "next/server";
import {
  AuthorizationError,
  requireAuthorizedUser,
} from "@/lib/server/authz";
import {
  canCreateTenderPackRequest,
  createTenderPackRequest,
  listTenderPackRequests,
} from "@/server/services/tenderPackRequestService";
import { recordAuditLog } from "@/server/services/auditLogService";

function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

function getString(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

export async function GET(request: NextRequest) {
  try {
    const user = await requireAuthorizedUser(request);
    const requests = await listTenderPackRequests(user);
    return NextResponse.json({ requests }, { status: 200 });
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return jsonError(error.message, error.status);
    }

    console.error("Tender pack request list failed:", error);
    return jsonError("Failed to load tender pack requests", 500);
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuthorizedUser(request);
    const body = (await request.json()) as Record<string, unknown>;
    const contractorId = getString(body.contractorId) ?? user.contractorId ?? null;
    const dealId = getString(body.dealId);
    const note = getString(body.note);

    if (!contractorId) {
      return jsonError("Missing contractorId", 400);
    }

    if (!canCreateTenderPackRequest(user, contractorId)) {
      return jsonError("unauthorized", 403);
    }

    const tenderPackRequest = await createTenderPackRequest({
      contractorId,
      dealId,
      note,
      actor: user,
    });

    await recordAuditLog({
      userId: user.uid,
      action: "TENDER_PACK_REQUEST_CREATED",
      entityType: "tenderPackRequest",
      entityId: tenderPackRequest.id,
      metadata: {
        contractorId,
        dealId,
        status: tenderPackRequest.status,
      },
    });

    return NextResponse.json({ request: tenderPackRequest }, { status: 201 });
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return jsonError(error.message, error.status);
    }

    console.error("Tender pack request create failed:", error);
    return jsonError("Failed to create tender pack request", 500);
  }
}
