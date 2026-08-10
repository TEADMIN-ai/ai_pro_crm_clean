import { NextRequest, NextResponse } from "next/server";
import { actorFromAuthorizedUser } from "@/lib/master-data/apiPayload";
import { EvidenceAuthorityError, reviewEvidenceDocument, type EvidenceReviewAction } from "@/lib/master-data/evidenceAuthority";
import { FirestoreMasterDataRepository } from "@/lib/master-data/firestoreRepository";
import { AuthorizationError, assertPrivilegedRole, requireAuthorizedUser } from "@/lib/server/authz";
import type { MasterDataEvidencePurpose } from "@/types/masterData";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ documentId: string }>;
};

const ACTIONS: readonly EvidenceReviewAction[] = ["verify", "reject", "historical_only", "review_required"];
const PURPOSES: readonly MasterDataEvidencePurpose[] = [
  "SUPPLIER_IDENTITY",
  "CURRENT_QS_PRICING",
  "HISTORICAL_PRICE",
  "SUPPLIER_QUOTE_REVIEW",
  "CONTRACTOR_COMPLIANCE",
  "HYGIENE_COLLECTION_ACKNOWLEDGEMENT",
  "HYGIENE_DISPOSAL_PROOF",
  "FINANCE_TRANSACTION_SUPPORT",
  "RFQ_SOURCE",
  "GENERAL_REFERENCE",
];

function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

function clean(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function isAction(value: unknown): value is EvidenceReviewAction {
  return ACTIONS.includes(value as EvidenceReviewAction);
}

function isPurpose(value: unknown): value is MasterDataEvidencePurpose {
  return PURPOSES.includes(value as MasterDataEvidencePurpose);
}

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const user = await requireAuthorizedUser(request);
    assertPrivilegedRole(user);
    const { documentId } = await context.params;
    const body = await request.json().catch(() => null) as Record<string, unknown> | null;
    if (!body || typeof body !== "object") return jsonError("Evidence review payload must be an object.", 400);

    const workspaceId = clean(body.workspaceId) || clean(user.workspaceId);
    const action = clean(body.action);
    const purpose = clean(body.purpose);
    const reason = clean(body.reason);
    if (!documentId || !workspaceId) return jsonError("documentId and workspaceId are required.", 400);
    if (user.workspaceId && user.workspaceId !== workspaceId) return jsonError("Cross-workspace evidence review rejected.", 403);
    if (!isAction(action)) return jsonError("Unsupported evidence review action.", 400);
    if (!isPurpose(purpose)) return jsonError("Unsupported evidence purpose.", 400);
    if (!reason) return jsonError("Evidence review reason is required.", 400);

    const result = await reviewEvidenceDocument({
      actor: actorFromAuthorizedUser(user, workspaceId),
      repository: new FirestoreMasterDataRepository(),
      documentId,
      workspaceId,
      action,
      purpose,
      reason,
    });

    return NextResponse.json({ success: true, document: result.document, auditEvent: result.auditEvent }, { status: 200 });
  } catch (error) {
    if (error instanceof AuthorizationError) return jsonError(error.message, error.status);
    if (error instanceof EvidenceAuthorityError) return jsonError(error.message, error.status);
    console.error("Master Data evidence review failed", error);
    return jsonError("Evidence review failed.", 500);
  }
}
