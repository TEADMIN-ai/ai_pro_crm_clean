import { NextRequest, NextResponse } from "next/server";
import { normalizeContractorId, normalizeRole } from "@/lib/auth/userProfile";
import { getAdminAuth, getFirebaseAdmin } from "@/lib/firebase/admin";

export async function POST(req: NextRequest) {
  try {
    const adminAuth = getAdminAuth();
    const db = getFirebaseAdmin();
    const authHeader = req.headers.get("authorization");

    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json({ error: "Missing token" }, { status: 401 });
    }

    const idToken = authHeader.split("Bearer ")[1];
    const decodedToken = await adminAuth.verifyIdToken(idToken);
    const uid = decodedToken.uid;
    const userDoc = await db.collection("users").doc(uid).get();
    const userData = userDoc.data() ?? {};
    const role = userDoc.exists ? normalizeRole(userData.role) : "guest";
    const contractorId = userDoc.exists ? normalizeContractorId(userData.contractorId) : undefined;

    const userRecord = await adminAuth.getUser(uid);
    const currentRole = userRecord.customClaims?.role;
    const currentContractorId = normalizeContractorId(userRecord.customClaims?.contractorId);

    if (currentRole !== role || currentContractorId !== contractorId) {
      await adminAuth.setCustomUserClaims(uid, {
        role,
        contractorId: contractorId ?? null,
      });
    }

    return NextResponse.json({
      success: true,
      role,
      contractorId: contractorId ?? null,
    });
  } catch (error) {
    console.error("Sync role failed:", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
