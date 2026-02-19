import { NextRequest, NextResponse } from "next/server";
import { getApps, initializeApp, cert } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import fs from "fs";
import path from "path";

// 🔒 Initialize Firebase Admin once
if (!getApps().length) {
  const serviceAccountPath = path.join(
    process.cwd(),
    "secrets",
    "service-account.json"
  );

  const serviceAccount = JSON.parse(
    fs.readFileSync(serviceAccountPath, "utf8")
  );

  initializeApp({
    credential: cert(serviceAccount),
  });
}

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get("authorization");

    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json(
        { error: "Missing token" },
        { status: 401 }
      );
    }

    const idToken = authHeader.split("Bearer ")[1];

    const adminAuth = getAuth();
    const db = getFirestore();

    // ✅ Verify user
    const decodedToken = await adminAuth.verifyIdToken(idToken);
    const uid = decodedToken.uid;

    // 🔍 Get role from Firestore
    const userDoc = await db.collection("users").doc(uid).get();

    if (!userDoc.exists) {
      return NextResponse.json(
        { error: "User document not found" },
        { status: 404 }
      );
    }

    const userData = userDoc.data();
    const role = userData?.role ?? "guest";

    // 🛑 Only allow valid roles
    const validRoles = ["admin", "manager", "staff", "contractor"];
    const finalRole = validRoles.includes(role) ? role : "guest";

    // 🧠 Get current claims
    const userRecord = await adminAuth.getUser(uid);
    const currentRole = userRecord.customClaims?.role;

    // 🔁 Only update if different
    if (currentRole !== finalRole) {
      await adminAuth.setCustomUserClaims(uid, { role: finalRole });
    }

    return NextResponse.json({ success: true, role: finalRole });

  } catch (error) {
    console.error("Sync role failed:", error);
    return NextResponse.json(
      { error: "Internal error" },
      { status: 500 }
    );
  }
}