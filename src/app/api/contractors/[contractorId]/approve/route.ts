import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { getFirebaseAdmin } from "@/lib/firebase/admin";
import {
  getDocumentTypeLabel,
  SUPPORTED_DOCUMENT_TYPES,
  type SupportedDocumentType,
} from "@/lib/compliance/contractorCompliance";
import { CONTRACTOR_REPOSITORY_DECISION_LOGIC_VERSION } from "@/lib/contractors/contractorRepositoryDecision";
import { recalculateContractorCompliance } from "@/lib/server/recalculateContractorCompliance";
import { AuthorizationError, requireAuthorizedUser } from "@/lib/server/authz";

function asApprovalNotes(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function isSupportedDocumentType(value: string): value is SupportedDocumentType {
  return SUPPORTED_DOCUMENT_TYPES.includes(value as SupportedDocumentType);
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ contractorId: string }> }
) {
  try {
    const db = getFirebaseAdmin();
    const user = await requireAuthorizedUser(req);

    if (!["admin", "manager", "staff"].includes(user.role)) {
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }

    const { contractorId } = await params;
    if (typeof contractorId !== "string" || contractorId.trim().length === 0) {
      return NextResponse.json({ error: "invalid_contractor_id" }, { status: 400 });
    }

    const body = (await req.json().catch(() => ({}))) as { approvalNotes?: unknown } | null;
    const approvalNotes = asApprovalNotes(body?.approvalNotes);
    const docRef = db.collection("contractors").doc(contractorId);
    const existingSnapshot = await docRef.get();

    if (!existingSnapshot.exists) {
      return NextResponse.json({ error: "contractor_not_found" }, { status: 404 });
    }

    const summary = await recalculateContractorCompliance(db, contractorId);
    const missingLabels = summary.missingDocumentTypes
      .filter((type): type is SupportedDocumentType => isSupportedDocumentType(type))
      .map(getDocumentTypeLabel);
    const blockers = [
      ...missingLabels.map((label) => `${label} is not approved`),
      ...(summary.expiredDocumentCount > 0 ? [`${summary.expiredDocumentCount} approved document(s) expired`] : []),
      ...(summary.tenderLockStatus !== "READY" ? [`Readiness status is ${summary.tenderLockStatus}`] : []),
      ...summary.intelligence.reviewRecommendations,
    ];

    if (
      summary.readinessScore < 100 ||
      summary.docsMissing > 0 ||
      summary.expiredDocumentCount > 0 ||
      summary.tenderLockStatus !== "READY"
    ) {
      return NextResponse.json(
        {
          error: "approval_blocked",
          message: "Required onboarding documents must be verified before approval.",
          readinessScore: summary.readinessScore,
          docsMissing: summary.docsMissing,
          blockers,
        },
        { status: 409 },
      );
    }

    const auditRef = db.collection("contractorComplianceAudit").doc();
    const reviewedAt = new Date().toISOString();
    const approvedByName = user.email?.trim() || user.uid;
    let previousStatus = "Onboarding";
    const newStatus = "Approved / Compliant";

    await db.runTransaction(async (transaction) => {
      const snap = await transaction.get(docRef);

      if (!snap.exists) {
        throw new Error("contractor_not_found");
      }

      const currentData = (snap.data() ?? {}) as Record<string, unknown>;
      previousStatus =
        typeof currentData.status === "string" && currentData.status.trim().length > 0
          ? currentData.status.trim()
          : "Onboarding";

      transaction.update(docRef, {
        status: "active",
        overallStatus: newStatus,
        complianceStatus: "approved",
        complianceApproved: true,
        complianceRejected: false,
        rejectionReason: null,
        approvedByUid: user.uid,
        approvedByName,
        approvedAt: reviewedAt,
        approvalNotes,
        previousStatus,
        newStatus,
        complianceReviewedBy: user.uid,
        complianceReviewedAt: reviewedAt,
        readinessScore: summary.readinessScore,
        readinessStatus: summary.tenderLockStatus,
        readinessDecisionStatus: summary.tenderLockStatus === "READY" ? "READY" : "BLOCKED",
        decisionEvaluatedAt: reviewedAt,
        readinessUpdatedAt: reviewedAt,
        decisionLogicVersion: CONTRACTOR_REPOSITORY_DECISION_LOGIC_VERSION,
        updatedAt: reviewedAt,
        auditTrail: FieldValue.arrayUnion({
          id: `${contractorId}:onboarding_approved:${Date.now()}`,
          type: "onboarding_approved",
          message: "Contractor onboarding portfolio approved and contractor activated",
          performedByUid: user.uid,
          performedByEmail: user.email ?? null,
          performedByRole: user.role,
          createdAt: reviewedAt,
          previousStatus,
          newStatus,
          approvalNotes,
          decisionLogicVersion: CONTRACTOR_REPOSITORY_DECISION_LOGIC_VERSION,
        }),
      });

      transaction.set(auditRef, {
        action: "onboarding_approved",
        actorUid: user.uid,
        actorName: approvedByName,
        actorRole: user.role,
        contractorId,
        approvedByUid: user.uid,
        approvedByName,
        approvedAt: reviewedAt,
        approvalNotes,
        previousStatus,
        newStatus,
        readinessScore: summary.readinessScore,
        readinessDecisionStatus: summary.tenderLockStatus === "READY" ? "READY" : "BLOCKED",
        decisionLogicVersion: CONTRACTOR_REPOSITORY_DECISION_LOGIC_VERSION,
        requiredDocsApprovedCount: SUPPORTED_DOCUMENT_TYPES.length - summary.docsMissing,
        requiredDocsTotalCount: SUPPORTED_DOCUMENT_TYPES.length,
        docsMissing: summary.docsMissing,
        reviewRequiredCount: 0,
        createdAt: reviewedAt,
      });

      transaction.set(db.collection("contractorActivity").doc(), {
        contractorId,
        action: "Onboarding approved",
        performedBy: approvedByName,
        performedByUid: user.uid,
        previousStatus,
        newStatus,
        timestamp: FieldValue.serverTimestamp(),
      });
    });

    return NextResponse.json({
      success: true,
      action: "approved",
      previousStatus,
      newStatus,
      readinessScore: summary.readinessScore,
      decisionLogicVersion: CONTRACTOR_REPOSITORY_DECISION_LOGIC_VERSION,
    });
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
