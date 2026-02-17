import { NextRequest, NextResponse } from "next/server";
import { getFirestore } from "firebase-admin/firestore";
import { getApps, initializeApp, cert } from "firebase-admin/app";

/* =========================
   FIREBASE ADMIN INIT
========================= */

function initFirebaseAdmin() {
  if (getApps().length > 0) return;

  if (
    !process.env.FIREBASE_PROJECT_ID ||
    !process.env.FIREBASE_CLIENT_EMAIL ||
    !process.env.FIREBASE_PRIVATE_KEY
  ) {
    throw new Error("Missing Firebase Admin environment variables.");
  }

  initializeApp({
    credential: cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n"),
    }),
  });
}

/* =========================
   POST: MARK DEAL SUBMITTED
========================= */

export async function POST(req: NextRequest) {
  try {
    initFirebaseAdmin();
    const db = getFirestore();

    const body = await req.json();
    const { dealId } = body;

    if (!dealId) {
      return NextResponse.json(
        { error: "Missing dealId" },
        { status: 400 }
      );
    }

    await db.collection("deals").doc(dealId).update({
      stage: "submitted",
      submittedAt: new Date(),
      updatedAt: new Date(),
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "Failed to update deal" },
      { status: 500 }
    );
  }
}

