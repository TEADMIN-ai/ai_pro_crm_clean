import { NextRequest, NextResponse } from "next/server";
import { AuthorizationError, assertCanAccessContractor, assertPrivilegedRole, requireAuthorizedUser } from "@/lib/server/authz";
import { deleteContractorById, getContractorById, updateContractorById } from "@/server/services/contractorService";

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

    assertCanAccessContractor(user, contractorId);

    const contractor = await getContractorById(contractorId);
    if (!contractor) {
      return NextResponse.json({ success: false, error: "Contractor not found" }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      ...contractor,
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

    return NextResponse.json({ success: true, message: "Contractor updated successfully" });
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return NextResponse.json({ success: false, error: error.message }, { status: error.status });
    }

    console.error("PATCH Contractor Error:", error);
    return NextResponse.json({ success: false, error: "Update failed" }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ contractorId: string }> }
) {
  try {
    const user = await requireAuthorizedUser(req);
    const { contractorId } = await params;

    if (!contractorId) {
      return NextResponse.json({ success: false, error: "Missing contractorId" }, { status: 400 });
    }

    assertPrivilegedRole(user);

    await deleteContractorById(contractorId);
    return NextResponse.json({ success: true, message: "Contractor deleted" });
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return NextResponse.json({ success: false, error: error.message }, { status: error.status });
    }

    console.error("DELETE Contractor Error:", error);
    return NextResponse.json({ success: false, error: "Delete failed" }, { status: 500 });
  }
}
