import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebaseAdmin";
import { isPrivilegedRole, requireAuthorizedUser } from "@/lib/server/authz";

export async function GET(req: NextRequest) {
  try {
    const user = await requireAuthorizedUser(req);

    let snapshot;

    if (isPrivilegedRole(user.role)) {
      snapshot = await adminDb.collection("deals").get();
    } else if (user.role === "contractor" && user.contractorId) {
      snapshot = await adminDb
        .collection("deals")
        .where("contractorId", "==", user.contractorId)
        .get();
    } else {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 403 }
      );
    }

    const deals = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));

    return NextResponse.json({ deals });
  } catch (error) {
    console.error("DEALS API ERROR:", error);

    return NextResponse.json(
      { error: "Unauthorized or invalid token" },
      { status: 401 }
    );
  }
}
