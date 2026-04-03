import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import {
  AuthorizationError,
  assertPrivilegedRole,
  requireAuthorizedUser,
} from "@/lib/server/authz";
import { getFirebaseAdmin } from "@/lib/firebase/admin";
import { generateFixSuggestion } from "@/lib/services/aiFixService";
import { computeReadiness } from "@/lib/services/readinessService";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ documentId: string }>;
};

function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const user = await requireAuthorizedUser(request);
    assertPrivilegedRole(user);

    const { documentId } = await context.params;
    if (!documentId) {
      return jsonError("Document ID is required", 400);
    }

    const payload = (await request.json().catch(() => null)) as { status?: unknown } | null;
    const status = typeof payload?.status === "string" ? payload.status.trim().toLowerCase() : "";

    if (status !== "approved" && status !== "rejected") {
      return jsonError("Invalid status", 400);
    }

    const db = getFirebaseAdmin();
    const docRef = db.collection("documents").doc(documentId);
    const snapshot = await docRef.get();

    if (!snapshot.exists) {
      return jsonError("Document not found", 404);
    }

    await docRef.update({
      status,
      reviewedAt: Date.now(),
      reviewedBy: user.uid,
      fixSuggestion: status === "rejected" ? FieldValue.delete() : null,
      updatedAt: FieldValue.serverTimestamp(),
    });

    let updatedSnapshot = await docRef.get();
    let updated = updatedSnapshot.data() ?? {};

    let fixSuggestion: string | null = null;

    if (status === "rejected") {
      fixSuggestion = await generateFixSuggestion(updated);
      await docRef.update({
        fixSuggestion,
        updatedAt: FieldValue.serverTimestamp(),
      });
      updatedSnapshot = await docRef.get();
      updated = updatedSnapshot.data() ?? {};
    }

    const contractorId =
      typeof updated.contractorId === "string" && updated.contractorId.trim().length > 0
        ? updated.contractorId.trim()
        : undefined;

    if (contractorId) {
      const readiness = await computeReadiness(contractorId);
      const dealsSnapshot = await db.collection("deals").where("contractorId", "==", contractorId).get();
      const batch = db.batch();

      dealsSnapshot.forEach((dealDoc) => {
        batch.update(dealDoc.ref, {
          readinessScore: readiness.score,
          readinessStatus: readiness.status,
          docsMissing: readiness.missing,
          tenderLockStatus:
            readiness.status === "READY"
              ? "READY"
              : readiness.status === "AT_RISK"
                ? "RISK"
                : "BLOCKED",
          isTenderLocked: readiness.status !== "READY",
          readinessUpdatedAt: new Date().toISOString(),
          updatedAt: FieldValue.serverTimestamp(),
        });
      });

      if (!dealsSnapshot.empty) {
        await batch.commit();
      }
    }

    return NextResponse.json(
      {
        success: true,
        document: {
          id: updatedSnapshot.id,
          status: typeof updated.status === "string" ? updated.status : status,
          fixSuggestion:
            typeof updated.fixSuggestion === "string"
              ? updated.fixSuggestion
              : fixSuggestion,
          reviewedAt:
            typeof updated.reviewedAt === "number"
              ? updated.reviewedAt
              : updated.reviewedAt &&
                  typeof updated.reviewedAt === "object" &&
                  "toMillis" in updated.reviewedAt &&
                  typeof updated.reviewedAt.toMillis === "function"
                ? updated.reviewedAt.toMillis()
                : Date.now(),
          reviewedBy: typeof updated.reviewedBy === "string" ? updated.reviewedBy : user.uid,
        },
      },
      { status: 200 }
    );
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return jsonError(error.message, error.status);
    }

    console.error("Document approval update failed", error);
    return jsonError("Failed to update document status", 500);
  }
}
