import { NextRequest, NextResponse } from "next/server";
import { AuthorizationError, requireAuthorizedUser } from "@/lib/server/authz";
import { createSubmissionEvidence, getSubmissionEvidenceAuthoritySnapshot, listSubmissionEvidence, reviewSubmissionEvidence, type SubmissionEvidenceType } from "@/server/services/submissionEvidenceAuthorityService";

function errorResponse(error: unknown) { const status = typeof error === "object" && error && "status" in error && typeof (error as { status?: unknown }).status === "number" ? (error as { status: number }).status : 500; return NextResponse.json({ error: error instanceof Error ? error.message : "Submission evidence request failed" }, { status }); }

export async function GET(_request: NextRequest, context: { params: Promise<{ dealId: string }> }) {
  try { const actor = await requireAuthorizedUser(_request); const { dealId } = await context.params; const decodedDealId = decodeURIComponent(dealId); return NextResponse.json({ evidence: await listSubmissionEvidence(decodedDealId, actor), authority: await getSubmissionEvidenceAuthoritySnapshot({ dealId: decodedDealId, actor }) }); } catch (error) { if (error instanceof AuthorizationError) return NextResponse.json({ error: error.message }, { status: error.status }); return errorResponse(error); }
}

export async function POST(request: NextRequest, context: { params: Promise<{ dealId: string }> }) {
  try {
    const actor = await requireAuthorizedUser(request); const { dealId: rawDealId } = await context.params; const dealId = decodeURIComponent(rawDealId);
    const form = await request.formData(); const file = form.get("file"); const type = String(form.get("evidenceType") ?? "") as SubmissionEvidenceType;
    if (!["PORTAL_RECEIPT", "SENT_EMAIL", "SUBMISSION_DOCUMENT"].includes(type)) return NextResponse.json({ error: "A valid submission evidence type is required" }, { status: 400 });
    return NextResponse.json({ evidence: await createSubmissionEvidence({ dealId, actor, type, portalReference: String(form.get("portalReference") ?? "") || null, note: String(form.get("note") ?? "") || null, testMarker: String(form.get("testMarker") ?? "") || null, file: file instanceof File ? file : null }) }, { status: 201 });
  } catch (error) { if (error instanceof AuthorizationError) return NextResponse.json({ error: error.message }, { status: error.status }); return errorResponse(error); }
}

export async function PATCH(request: NextRequest, context: { params: Promise<{ dealId: string }> }) {
  try { const actor = await requireAuthorizedUser(request); const { dealId: rawDealId } = await context.params; const body = await request.json() as { evidenceId?: string; status?: "APPROVED" | "REJECTED"; reason?: string }; if (!body.evidenceId || !body.status) return NextResponse.json({ error: "Evidence ID and review status are required" }, { status: 400 }); return NextResponse.json({ evidence: await reviewSubmissionEvidence({ dealId: decodeURIComponent(rawDealId), evidenceId: body.evidenceId, actor, status: body.status, reason: body.reason }) }); } catch (error) { if (error instanceof AuthorizationError) return NextResponse.json({ error: error.message }, { status: error.status }); return errorResponse(error); }
}
