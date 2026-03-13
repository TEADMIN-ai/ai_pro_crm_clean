import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { getFirebaseAdmin } from "@/lib/firebase/admin";
import { normalizeDocsMissingCount, resolveTenderLockStatusFromScore } from "@/lib/compliance/contractorCompliance";
import { makeDealAuditEvent } from "@/lib/deals/recordDealAudit";
import { validateTenderSubmission } from "@/lib/tender/tenderLock";
import { recalculateContractorCompliance } from "@/lib/server/recalculateContractorCompliance";
import { AuthorizationError, assertCanAccessContractor, requireAuthorizedUser } from "@/lib/server/authz";
import { submitDealTender } from "@/server/services/dealService";

function getNumber(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

export async function POST(req: NextRequest) {
  try {
    const user = await requireAuthorizedUser(req);
    const db = getFirebaseAdmin();

    const body = (await req.json()) as Record<string, unknown>;
    const dealId = typeof body.dealId === "string" ? body.dealId.trim() : "";

    if (!dealId) {
      return NextResponse.json(
        { error: "Missing dealId" },
        { status: 400 }
      );
    }

    const dealRef = db.collection("deals").doc(dealId);
    const dealSnapshot = await dealRef.get();

    if (!dealSnapshot.exists) {
      return NextResponse.json({ error: "Deal not found" }, { status: 404 });
    }

    const deal = dealSnapshot.data() as Record<string, unknown>;
    const contractorId =
      typeof deal.contractorId === "string"
        ? deal.contractorId
        : typeof deal.companyId === "string"
          ? deal.companyId
          : "";
    if (user.role === "guest") {
      throw new AuthorizationError("unauthorized", 403);
    }
    if (user.role === "contractor") {
      assertCanAccessContractor(user, contractorId);
    }
    const compliance = contractorId
      ? await recalculateContractorCompliance(db, contractorId)
      : {
          readinessScore: getNumber(deal.readinessScore),
          docsMissing: normalizeDocsMissingCount(deal.docsMissing),
          tenderLockStatus: resolveTenderLockStatusFromScore(getNumber(deal.readinessScore)),
          isTenderLocked: true,
          readinessUpdatedAt: new Date().toISOString(),
        };
    const score = compliance.readinessScore;
    const docsMissing = compliance.docsMissing;
    const tenderLockStatus = compliance.tenderLockStatus;
    const result = validateTenderSubmission(score, docsMissing);

    if (!result.allowed) {
      const auditEntry = makeDealAuditEvent({
        type: "updated",
        actor: {
          uid: user.uid,
          email: user.email ?? null,
          role: user.role,
        },
        meta: {
          message: "Tender submission blocked by TenderLock",
          tenderLockReason: result.reason,
          readinessScore: score,
          docsMissing,
          tenderLockStatus,
        },
      });

      await dealRef.update({
        readinessScore: score,
        docsMissing,
        tenderLockStatus,
        isTenderLocked: true,
        auditTrail: FieldValue.arrayUnion(auditEntry),
        updatedAt: new Date(),
      });

      return NextResponse.json(
        {
          error: "Tender blocked",
          reason: result.reason,
        },
        { status: 403 }
      );
    }

    await submitDealTender({
      dealId,
      score,
      docsMissing,
      tenderLockStatus,
      userUid: user.uid,
    });

    return NextResponse.json({
      success: true,
      tenderLockStatus,
      reason: result.reason,
    });
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    console.error(error);
    return NextResponse.json(
      { error: "Failed to update deal" },
      { status: 500 }
    );
  }
}

