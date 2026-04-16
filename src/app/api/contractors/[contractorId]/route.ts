import { NextRequest, NextResponse } from "next/server";
import { getAuth } from "firebase-admin/auth";
import { db } from "@/lib/firebaseAdmin";
import { AuthorizationError, assertCanAccessContractor, assertPrivilegedRole, requireAuthorizedUser } from "@/lib/server/authz";
import { getContractorById, updateContractorById } from "@/server/services/contractorService";

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

    const contractorRef = db.collection("contractors").doc(contractorId);
    const contractorSnap = await contractorRef.get();

    if (!contractorSnap.exists) {
      return NextResponse.json({ error: "Contractor not found" }, { status: 404 });
    }

    const contractor = contractorSnap.data() as Record<string, unknown> | undefined;
    const authUid =
      typeof contractor?.authUid === "string" && contractor.authUid.trim().length > 0
        ? contractor.authUid.trim()
        : "";

    if (!authUid) {
      return NextResponse.json(
        { error: "Missing authUid. Cannot delete securely." },
        { status: 400 }
      );
    }

    await getAuth().deleteUser(authUid);
    await contractorRef.delete();

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return NextResponse.json({ success: false, error: error.message }, { status: error.status });
    }

    console.error("DELETE Contractor Error:", error);
    return NextResponse.json({ success: false, error: "Delete failed" }, { status: 500 });
  }
}
