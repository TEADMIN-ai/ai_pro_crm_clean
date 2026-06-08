import { NextRequest, NextResponse } from "next/server";
import {
  AuthorizationError,
  assertPrivilegedRole,
  requireAuthorizedUser,
} from "@/lib/server/authz";
import {
  getTenderPackRequest,
  updateTenderPackRequestStatus,
} from "@/server/services/tenderPackRequestService";
import { recordAuditLog } from "@/server/services/auditLogService";
import type { TenderPackRequestStatus } from "@/types/tenderPackRequest";

function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

function parseStatus(value: unknown): Exclude<TenderPackRequestStatus, "generated"> | null {
  if (
    value === "pending" ||
    value === "under_review" ||
    value === "approved" ||
    value === "rejected"
  ) {
    return value;
  }

  return null;
}

function getString(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ requestId: string }> },
) {
  try {
    const user = await requireAuthorizedUser(request);
    const { requestId } = await params;
    const tenderPackRequest = await getTenderPackRequest(requestId);

    if (!tenderPackRequest) {
      return jsonError("Tender pack request not found", 404);
    }

    if (
      user.role === "contractor" &&
      user.contractorId !== tenderPackRequest.contractorId
    ) {
      return jsonError("unauthorized", 403);
    }

    return NextResponse.json({ request: tenderPackRequest }, { status: 200 });
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return jsonError(error.message, error.status);
    }

    console.error("Tender pack request fetch failed:", error);
    return jsonError("Failed to load tender pack request", 500);
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ requestId: string }> },
) {
  try {
    const user = await requireAuthorizedUser(request);
    assertPrivilegedRole(user);

    const { requestId } = await params;
    const body = (await request.json()) as Record<string, unknown>;
    const status = parseStatus(body.status);
    const note = getString(body.note);

    if (!status) {
      return jsonError("Invalid tender pack request status", 400);
    }

    const tenderPackRequest = await updateTenderPackRequestStatus({
      requestId,
      status,
      note,
      actor: user,
    });

    await recordAuditLog({
      userId: user.uid,
      action: "TENDER_PACK_REQUEST_STATUS_CHANGED",
      entityType: "tenderPackRequest",
      entityId: tenderPackRequest.id,
      metadata: {
        contractorId: tenderPackRequest.contractorId,
        dealId: tenderPackRequest.dealId,
        status: tenderPackRequest.status,
        note,
      },
    });

    return NextResponse.json({ request: tenderPackRequest }, { status: 200 });
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return jsonError(error.message, error.status);
    }

    if (error instanceof Error && error.message === "Tender pack request not found") {
      return jsonError(error.message, 404);
    }

    console.error("Tender pack request update failed:", error);
    return jsonError("Failed to update tender pack request", 500);
  }
}
