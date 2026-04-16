import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebaseAdmin";
import { AuthorizationError, requireAuthorizedUser } from "@/lib/server/authz";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuthorizedUser(req);

    if (!["admin", "manager"].includes(user.role)) {
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }

    const { id: contractorId } = await params;
    if (typeof contractorId !== "string" || contractorId.trim().length === 0) {
      return NextResponse.json({ error: "invalid_contractor_id" }, { status: 400 });
    }

    const docRef = adminDb.collection("contractors").doc(contractorId);
    const auditRef = adminDb.collection("contractorComplianceAudit").doc();
    const reviewedAt = new Date().toISOString();
    let action: "approved" | "noop" = "approved" as "approved" | "noop";

    await adminDb.runTransaction(async (transaction) => {
      const snap = await transaction.get(docRef);

      if (!snap.exists) {
        throw new Error("contractor_not_found");
      }

      if (snap.data()?.complianceApproved === true) {
        action = "noop";
        return;
      }

      transaction.update(docRef, {
        complianceApproved: true,
        complianceRejected: false,
        rejectionReason: null,
        complianceReviewedBy: user.uid,
        complianceReviewedAt: reviewedAt,
      });

      transaction.set(auditRef, {
        action: "approved",
        actorUid: user.uid,
        actorRole: user.role,
        contractorId,
        createdAt: reviewedAt,
      });
    });

    return NextResponse.json({ success: true, action: action === "noop" ? "approved" : action });
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    if (error instanceof Error && error.message === "contractor_not_found") {
      return NextResponse.json({ error: "contractor_not_found" }, { status: 404 });
    }

    console.error("COMPLIANCE APPROVAL ERROR:", error);
    return NextResponse.json({ error: "Failed to approve compliance" }, { status: 500 });
  }
}
