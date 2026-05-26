import { NextRequest, NextResponse } from "next/server";
import { getFirebaseAdmin } from "@/lib/firebase/admin";
import { AuthorizationError, requireAuthorizedUser } from "@/lib/server/authz";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ contractorId: string }> }
) {
  try {
    const db = getFirebaseAdmin();
    const user = await requireAuthorizedUser(req);

    if (!["admin", "manager"].includes(user.role)) {
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }

    const { contractorId } = await params;
    if (typeof contractorId !== "string" || contractorId.trim().length === 0) {
      return NextResponse.json({ error: "invalid_contractor_id" }, { status: 400 });
    }

    const body = (await req.json()) as unknown;
    if (body !== null && typeof body !== "object") {
      return NextResponse.json({ error: "invalid_payload" }, { status: 400 });
    }

    const reasonValue = (body as { reason?: unknown } | null)?.reason;
    if (reasonValue !== undefined && typeof reasonValue !== "string") {
      return NextResponse.json({ error: "invalid_reason" }, { status: 400 });
    }

    const reason =
      typeof reasonValue === "string" && reasonValue.trim().length > 0
        ? reasonValue.trim()
        : "Documents not valid";

    const docRef = db.collection("contractors").doc(contractorId);
    const auditRef = db.collection("contractorComplianceAudit").doc();
    const reviewedAt = new Date().toISOString();
    let action: "rejected" | "noop" = "rejected" as "rejected" | "noop";

    await db.runTransaction(async (transaction) => {
      const snap = await transaction.get(docRef);

      if (!snap.exists) {
        throw new Error("contractor_not_found");
      }

      if (snap.data()?.complianceRejected === true) {
        action = "noop";
        return;
      }

      transaction.update(docRef, {
        complianceApproved: false,
        complianceRejected: true,
        rejectionReason: reason,
        complianceReviewedBy: user.uid,
        complianceReviewedAt: reviewedAt,
      });

      transaction.set(auditRef, {
        action: "rejected",
        actorUid: user.uid,
        actorRole: user.role,
        contractorId,
        createdAt: reviewedAt,
        reason,
      });
    });

    return NextResponse.json({ success: true, action: action === "noop" ? "rejected" : action });
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    if (error instanceof Error && error.message === "contractor_not_found") {
      return NextResponse.json({ error: "contractor_not_found" }, { status: 404 });
    }

    console.error("COMPLIANCE REJECTION ERROR:", error);
    return NextResponse.json({ error: "Failed to reject compliance" }, { status: 500 });
  }
}
