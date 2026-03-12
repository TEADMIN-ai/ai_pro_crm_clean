import { NextRequest, NextResponse } from "next/server";
import { getFirebaseAdmin } from "@/lib/firebase/admin";
import { AuthorizationError, assertCanAccessContractor, assertPrivilegedRole, requireAuthorizedUser } from "@/lib/server/authz";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ contractorId: string }> }
) {
  try {
    const db = getFirebaseAdmin();
    const user = await requireAuthorizedUser(req);
    const { contractorId } = await params;

    if (!contractorId) {
      return NextResponse.json({ success: false, error: "Missing contractorId" }, { status: 400 });
    }

    assertCanAccessContractor(user, contractorId);

    const contractorSnap = await db.collection("contractors").doc(contractorId).get();
    if (!contractorSnap.exists) {
      return NextResponse.json({ success: false, error: "Contractor not found" }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      id: contractorSnap.id,
      ...contractorSnap.data(),
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
    const db = getFirebaseAdmin();
    const user = await requireAuthorizedUser(req);
    const { contractorId } = await params;
    const body = await req.json();

    if (!contractorId) {
      return NextResponse.json({ success: false, error: "Missing contractorId" }, { status: 400 });
    }

    assertPrivilegedRole(user);

    await db.collection("contractors").doc(contractorId).update({
      ...body,
      updatedAt: new Date().toISOString(),
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

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ contractorId: string }> }
) {
  try {
    const db = getFirebaseAdmin();
    const user = await requireAuthorizedUser(req);
    const { contractorId } = await params;

    if (!contractorId) {
      return NextResponse.json({ success: false, error: "Missing contractorId" }, { status: 400 });
    }

    assertPrivilegedRole(user);

    await db.collection("contractors").doc(contractorId).delete();
    return NextResponse.json({ success: true, message: "Contractor deleted" });
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return NextResponse.json({ success: false, error: error.message }, { status: error.status });
    }

    console.error("DELETE Contractor Error:", error);
    return NextResponse.json({ success: false, error: "Delete failed" }, { status: 500 });
  }
}
