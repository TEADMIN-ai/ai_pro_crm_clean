import { NextRequest, NextResponse } from "next/server";
import { Timestamp } from "firebase-admin/firestore";
import { getReturnableContext, getReturnableContextByCategory } from "@/lib/opportunities/returnableEvidence";
import { assertCanAccessContractor, AuthorizationError, requireAuthorizedUser } from "@/lib/server/authz";
import { getFirebaseAdmin, getFirebaseStorageBucket } from "@/lib/firebase/admin";
import { getDealById } from "@/server/services/dealService";
import { getOpportunityExecutionView } from "@/server/services/opportunityExecutionService";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function errorResponse(message: string, status = 500) {
  return NextResponse.json({ success: false, error: message }, { status });
}

export async function POST(request: NextRequest, context: { params: Promise<{ dealId: string }> }) {
  try {
    const actor = await requireAuthorizedUser(request);
    const { dealId: rawDealId } = await context.params;
    const dealId = decodeURIComponent(rawDealId).trim();
    const deal = await getDealById(dealId);
    if (!deal) return errorResponse("Deal not found", 404);
    if (deal.contractorId) assertCanAccessContractor(actor, deal.contractorId);

    const formData = await request.formData();
    const file = formData.get("file");
    const contextByKey = getReturnableContext(formData.get("returnableKey"));
    const contextByCategory = getReturnableContextByCategory(formData.get("returnableCategory"));
    if (!contextByKey || !contextByCategory || contextByKey.category !== contextByCategory.category) return errorResponse("A valid returnable category is required.", 400);
    const executionView = await getOpportunityExecutionView(dealId, actor);
    const checklistItem = executionView.state.documentChecklist.find((item) => item.key === contextByKey?.key);
    if (!checklistItem || !checklistItem.required) return errorResponse("Returnable is not a required item for this deal.", 400);
    if (!(file instanceof File) || file.size <= 0 || !file.name.toLowerCase().endsWith(".pdf")) return errorResponse("A PDF file is required.", 400);

    const subtype = String(formData.get("returnableSubtype") ?? "").trim() || null;
    const note = String(formData.get("returnableNote") ?? "").trim() || null;
    const now = Timestamp.now();
    const documentRef = getFirebaseAdmin().collection("deals").doc(dealId).collection("documents").doc();
    const storagePath = `uploads/deals/${dealId}/returnables/${now.toMillis()}_${file.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
    const storageFile = getFirebaseStorageBucket().file(storagePath);
    await storageFile.save(Buffer.from(await file.arrayBuffer()), { contentType: "application/pdf", resumable: false });

    const metadata = {
      id: documentRef.id,
      dealId,
      name: file.name,
      fileName: file.name,
      contentType: "application/pdf",
      size: file.size,
      storagePath,
      uploadedByUid: actor.uid,
      uploadedByRole: actor.role,
      uploadedAt: now,
      updatedAt: now,
      status: "pending",
      reviewStatus: "READY_FOR_REVIEW",
      returnableKey: contextByKey.key,
      returnableCategory: contextByKey.category,
      returnableSubtype: subtype,
      returnableNote: note,
      documentPreparationItem: contextByKey.key,
      workspaceId: typeof (deal as unknown as { workspaceId?: unknown }).workspaceId === "string" ? (deal as unknown as { workspaceId: string }).workspaceId : null,
      documentPreparationWorkspaceId: executionView.state.executionWorkspaceId,
      reviewedAt: null,
      version: 1,
    };
    await documentRef.set(metadata);
    const existingDocuments = Array.isArray(deal.documents) ? deal.documents : [];
    await getFirebaseAdmin().collection("deals").doc(dealId).set({ documents: [...existingDocuments, metadata] }, { merge: true });
    await getFirebaseAdmin().collection("deals").doc(dealId).collection("activity").add({ type: "returnable_evidence_uploaded", message: "Returnable evidence uploaded for staff review", returnableKey: contextByKey.key, returnableCategory: contextByKey.category, returnableSubtype: subtype, actorUid: actor.uid, actorEmail: actor.email ?? null, createdAt: now });
    await getFirebaseAdmin().collection("auditLogs").add({ action: "RETURNABLE_EVIDENCE_UPLOADED", entityType: "deal_document", entityId: documentRef.id, dealId, metadata: { returnableKey: contextByKey.key, returnableCategory: contextByKey.category, returnableSubtype: subtype, reviewStatus: "READY_FOR_REVIEW" }, userId: actor.uid, createdAt: now });
    return NextResponse.json({ success: true, document: metadata }, { status: 200 });
  } catch (error) {
    if (error instanceof AuthorizationError) return errorResponse(error.message, error.status);
    return errorResponse(error instanceof Error ? error.message : "Returnable upload failed", 500);
  }
}
