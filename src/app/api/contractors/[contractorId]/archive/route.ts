import { NextRequest, NextResponse } from "next/server";
import { AuthorizationError, requireAuthorizedUser } from "@/lib/server/authz";
import { archiveContractorById, getContractorById, getContractorDependencySummary } from "@/server/services/contractorService";

function validContractorId(value: string): boolean { return value.trim().length > 0 && value.length <= 150 && !value.includes("/"); }

export async function GET(request: NextRequest, context: { params: Promise<{ contractorId: string }> }) {
  try {
    const user = await requireAuthorizedUser(request);
    if (user.role !== "admin") throw new AuthorizationError("Contractor archive requires admin authorisation", 403);
    const { contractorId } = await context.params;
    if (!validContractorId(contractorId)) return NextResponse.json({ success: false, error: "Malformed contractor ID" }, { status: 400 });
    const contractor = await getContractorById(contractorId);
    if (!contractor) return NextResponse.json({ success: false, error: "Contractor not found" }, { status: 404 });
    if (user.workspaceId && contractor.workspaceId && user.workspaceId !== contractor.workspaceId) throw new AuthorizationError("Cross-workspace contractor archive rejected", 403);
    return NextResponse.json({ success: true, dependencySummary: await getContractorDependencySummary(contractorId) }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    if (error instanceof AuthorizationError) return NextResponse.json({ success: false, error: error.message }, { status: error.status });
    return NextResponse.json({ success: false, error: "Unable to load contractor dependencies" }, { status: 500 });
  }
}

export async function POST(request: NextRequest, context: { params: Promise<{ contractorId: string }> }) {
  try {
    const user = await requireAuthorizedUser(request);
    const { contractorId } = await context.params;
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const reason = typeof body.reason === "string" ? body.reason.trim() : "";
    if (!reason) return NextResponse.json({ success: false, error: "Archive reason is required" }, { status: 400 });
    const confirmActiveAssignments = body.confirmActiveAssignments === true;
    const contractor = await archiveContractorById({ contractorId, reason, actor: user, replacementContractorId: typeof body.replacementContractorId === "string" ? body.replacementContractorId : null, confirmActiveAssignments });
    return NextResponse.json({ success: true, contractor });
  } catch (error) {
    if (error instanceof AuthorizationError) return NextResponse.json({ success: false, error: error.message }, { status: error.status });
    const message = error instanceof Error ? error.message : "Archive failed";
    const status = message === "Contractor not found" ? 404 : message === "Malformed contractor ID" || message === "Archive reason is required" ? 400 : message === "Active assignments require explicit confirmation" ? 409 : 500;
    return NextResponse.json({ success: false, error: message }, { status });
  }
}
