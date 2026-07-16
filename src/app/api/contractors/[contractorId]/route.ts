import { NextRequest, NextResponse } from "next/server";
import { logActivity } from "@/lib/activity/logActivity";
import { AuthorizationError, assertCanAccessContractor, assertPrivilegedRole, requireAuthorizedUser } from "@/lib/server/authz";
import { listContractorDocuments, resolveContractorForAccess, updateContractorById } from "@/server/services/contractorService";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ contractorId: string }> }
) {
  try {
    const user = await requireAuthorizedUser(req);
    const { contractorId } = await params;

    if (!contractorId) {
      return NextResponse.json({ success: false, error: "Missing contractorId" }, { status: 400 });
    }

    const resolved = await resolveContractorForAccess({
      contractorReference: contractorId,
      actor: user,
      logContext: "api.contractors.detail",
    });

    if (resolved.ok === false) {
      const status = resolved.failureReason === "unauthorized_contractor" || resolved.failureReason === "cross_workspace" ? 403 : 404;
      return NextResponse.json({ success: false, error: "Contractor not found", reason: resolved.failureReason }, { status });
    }

    assertCanAccessContractor(user, resolved.contractorId);

    const documentRecords = await listContractorDocuments(resolved.contractorId);

    return NextResponse.json({
      success: true,
      ...resolved.contractor,
      id: resolved.contractorId,
      contractorId: resolved.contractorId,
      storedContractorReference: resolved.storedReference,
      contractorReferenceType: resolved.referenceType,
      documentRecords,
    });
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return NextResponse.json({ success: false, error: error.message }, { status: error.status });
    }

    console.error("GET Contractor Error:", error);
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ contractorId: string }> }
) {
  try {
    const user = await requireAuthorizedUser(req);
    const { contractorId } = await params;
    const body = await req.json();

    if (!contractorId) {
      return NextResponse.json({ success: false, error: "Missing contractorId" }, { status: 400 });
    }

    assertPrivilegedRole(user);

    await updateContractorById(contractorId, body as Record<string, unknown>);
    await logActivity({
      contractorId,
      action: "Contractor updated",
      performedBy: user.email?.trim() || user.uid,
    });

    return NextResponse.json({ success: true, message: "Contractor updated successfully" });
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return NextResponse.json({ success: false, error: error.message }, { status: error.status });
    }

    console.error("PATCH Contractor Error:", error);
    return NextResponse.json({ success: false, error: "Update failed" }, { status: 500 });
  }
}

export async function DELETE() {
  return NextResponse.json({ success: false, error: "Hard deletion is disabled. Use contractor archive instead." }, { status: 405 });
}
