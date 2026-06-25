import { NextRequest, NextResponse } from "next/server";
import { updateBoqReviewItem } from "@/lib/qs/boq";
import { AuthorizationError, requireAuthorizedUser } from "@/lib/server/authz";
import type { QsBoqReviewStatus } from "@/types/qs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function jsonError(message: string, status = 500) {
  return NextResponse.json({ error: message }, { status });
}

function reviewStatus(action: string): QsBoqReviewStatus {
  switch (action) {
    case "accept":
      return "accepted";
    case "edit":
      return "edited";
    case "reject":
      return "rejected";
    case "rematch":
      return "rematchRequired";
    default:
      return "pending";
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuthorizedUser(request);
    if (user.role !== "admin" && user.role !== "manager" && user.role !== "staff") {
      return jsonError("unauthorized", 403);
    }

    const formData = await request.formData();
    const reviewQueueId = String(formData.get("reviewQueueId") ?? "").trim();
    const action = String(formData.get("action") ?? "").trim();

    if (!reviewQueueId || !action) {
      return jsonError("Missing review action.", 400);
    }

    const status = reviewStatus(action);
    const updated = await updateBoqReviewItem(reviewQueueId, {
      status,
      lineItemStatus: status,
      updatedBy: user.uid,
    });

    return NextResponse.json({ updated });
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return jsonError(error.message, error.status);
    }

    console.error("[QS_BOQ_REVIEW_FAILED]", error);
    return jsonError(error instanceof Error ? error.message : "BOQ review update failed.");
  }
}
