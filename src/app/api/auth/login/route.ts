import { NextResponse } from "next/server";
import { getApps, initializeApp, cert } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";

export const runtime = "nodejs";

function getFirebaseAdmin() {
  if (!getApps().length) {
    const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n");

    initializeApp({
      credential: cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey,
      }),
    });
  }
  return getAuth();
}

export async function POST(req: Request) {
  console.log("LOGIN REQUEST RECEIVED");
  console.log("Firebase Project:", process.env.FIREBASE_PROJECT_ID);

  try {
    const body = await req.json();
    const idToken: string | undefined = body?.idToken;

    if (!idToken) {
      return NextResponse.json({ error: "Missing idToken" }, { status: 400 });
    }

    const auth = getFirebaseAdmin();

    // Verify client token
    const decodedToken = await auth.verifyIdToken(idToken);

    // 5 days expressed in both units clearly
    const SESSION_EXPIRES_MS = 5 * 24 * 60 * 60 * 1000; // milliseconds
    const COOKIE_MAX_AGE_SEC = 5 * 24 * 60 * 60;       // seconds

    const sessionCookie = await auth.createSessionCookie(idToken, {
      expiresIn: SESSION_EXPIRES_MS,
    });

    const response = NextResponse.json({
      success: true,
      uid: decodedToken.uid,
    });

    response.cookies.set("session", sessionCookie, {
      httpOnly: true,
      secure: true,
      path: "/",
      sameSite: "lax",
      maxAge: COOKIE_MAX_AGE_SEC,
    });

    console.log("Session cookie created for:", decodedToken.uid);

    return response;

  } catch (error: any) {
    console.error("Session creation error:", error);

    return NextResponse.json(
      {
        error: "Failed to create server session",
        details: error?.message ?? "Unknown error",
      },
      { status: 401 }
    );
  }
}