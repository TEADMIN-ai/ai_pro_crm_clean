import { NextRequest, NextResponse } from "next/server";
import { getApps, initializeApp, cert } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import fs from "fs";
import path from "path";
import { normalizeContractorId, normalizeRole } from "@/lib/auth/userProfile";

if (!getApps().length) {
  const serviceAccountPath = path.join(process.cwd(), "secrets", "service-account.json");
  const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, "utf8"));

  initializeApp({
    credential: cert(serviceAccount),
  });
}

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get("authorization");

    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json({ error: "Missing token" }, { status: 401 });
    }

    const idToken = authHeader.split("Bearer ")[1];
    const adminAuth = getAuth();
    const db = getFirestore();

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
