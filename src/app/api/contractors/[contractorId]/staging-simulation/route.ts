import { NextRequest, NextResponse } from "next/server";
import { AuthorizationError, assertCanAccessContractor, isPrivilegedRole, requireAuthorizedUser } from "@/lib/server/authz";
import { isStagingSimulationAllowed, StagingSimulationSafetyError, STAGING_SIMULATION_MESSAGE } from "@/lib/server/stagingSimulationSafety";
import { resolveContractorForAccess } from "@/server/services/contractorService";
import { simulateStagingCsdVerification, simulateStagingSarsTcsVerification } from "@/server/services/stagingVerificationSimulationService";

function jsonError(message: string, status = 500) { return NextResponse.json({ error: message }, { status }); }
function str(value: unknown): string | null { return typeof value === "string" && value.trim() ? value.trim() : null; }

export async function GET() { return NextResponse.json({ available: isStagingSimulationAllowed(), message: STAGING_SIMULATION_MESSAGE }); }

export async function POST(request: NextRequest, context: { params: Promise<{ contractorId: string }> }) {
  try {
    if (!isStagingSimulationAllowed()) return jsonError("Staging simulation is not available in this environment", 403);
    const user = await requireAuthorizedUser(request);
    if (!isPrivilegedRole(user.role)) return jsonError("Privileged actor role is required", 403);
    const { contractorId } = await context.params;
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const resolved = await resolveContractorForAccess({ contractorReference: contractorId, actor: user, logContext: "api.contractors.staging-simulation" });
    if (resolved.ok === false) return jsonError("Contractor not found", resolved.failureReason === "cross_workspace" || resolved.failureReason === "unauthorized_contractor" ? 403 : 404);
    assertCanAccessContractor(user, resolved.contractorId);
    const action = str(body.action);
    if (action === "simulate_csd") return NextResponse.json(await simulateStagingCsdVerification({ contractorId: resolved.contractorId, actor: user }));
    if (action === "simulate_sars_tcs") return NextResponse.json(await simulateStagingSarsTcsVerification({ contractorId: resolved.contractorId, actor: user }));
    return jsonError("Unsupported staging simulation action", 400);
  } catch (error) {
    if (error instanceof AuthorizationError) return jsonError(error.message, error.status);
    if (error instanceof StagingSimulationSafetyError) return jsonError(error.message, 403);
    return jsonError(error instanceof Error ? error.message : "Staging simulation failed", 500);
  }
}
