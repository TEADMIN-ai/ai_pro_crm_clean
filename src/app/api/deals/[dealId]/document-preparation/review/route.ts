import { NextRequest, NextResponse } from "next/server";
import { AuthorizationError, assertCanAccessContractor, requireAuthorizedUser } from "@/lib/server/authz";
import { getFirebaseAdmin } from "@/lib/firebase/admin";
import { getDealById } from "@/server/services/dealService";
import { canReview } from "@/lib/auth/roleUtils";

export const runtime = "nodejs";

export async function PATCH(request: NextRequest, context: { params: Promise<{ dealId: string }> }) {
  try {
    const actor = await requireAuthorizedUser(request);
    if (!canReview(actor.role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    const { dealId: rawDealId } = await context.params;
    const dealId = decodeURIComponent(rawDealId).trim();
    const deal = await getDealById(dealId);
    if (!deal) return NextResponse.json({ error: "Deal not found" }, { status: 404 });
    if (deal.contractorId) assertCanAccessContractor(actor, deal.contractorId);
    const body = (await request.json()) as { documentId?: unknown; status?: unknown };
    const documentId = typeof body.documentId === "string" ? body.documentId : "";
    const status = body.status === "approved" || body.status === "rejected" ? body.status : null;
    if (!documentId || !status) return NextResponse.json({ error: "Document and review status are required" }, { status: 400 });
    const db = getFirebaseAdmin();
    const documentRef = db.collection("deals").doc(dealId).collection("documents").doc(documentId);
    const snapshot = await documentRef.get();
    const existing = snapshot.data() ?? {};
    if (!snapshot.exists || !existing.returnableCategory) return NextResponse.json({ error: "Returnable evidence not found" }, { status: 404 });
    const now = new Date();
    const reviewStatus = status === "approved" ? "APPROVED" : "REJECTED";
    await documentRef.set({ status, reviewStatus, reviewedByUid: actor.uid, reviewedByRole: actor.role, reviewedAt: now, updatedAt: now, rejectionReason: status === "rejected" ? "Rejected by reviewer" : "" }, { merge: true });
    const documents = Array.isArray(deal.documents) ? deal.documents : [];
    const projectedDocuments = documents.map((document) => typeof document === "object" && document !== null && (document as unknown as Record<string, unknown>).id === documentId ? { ...(document as unknown as Record<string, unknown>), status, reviewStatus, reviewedByUid: actor.uid, reviewedAt: now, updatedAt: now } : document);
    await db.collection("deals").doc(dealId).set({ documents: projectedDocuments }, { merge: true });
    await db.collection("deals").doc(dealId).collection("activity").add({ type: "returnable_evidence_reviewed", message: "Returnable evidence reviewed", documentId, status, actorUid: actor.uid, actorEmail: actor.email ?? null, createdAt: now });
    await db.collection("auditLogs").add({ action: "RETURNABLE_EVIDENCE_REVIEWED", entityType: "deal_document", entityId: documentId, dealId, metadata: { status, reviewStatus }, userId: actor.uid, createdAt: now });
    return NextResponse.json({ success: true, document: { id: documentId, ...existing, status, reviewStatus } });
  } catch (error) {
    if (error instanceof AuthorizationError) return NextResponse.json({ error: error.message }, { status: error.status });
    return NextResponse.json({ error: error instanceof Error ? error.message : "Review failed" }, { status: 500 });
  }
}
