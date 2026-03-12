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

    const decodedToken = await auth.verifyIdToken(idToken);

    const sessionCookie = await auth.createSessionCookie(idToken, {
      expiresIn: 60 * 60 * 24 * 5 * 1000,
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
      maxAge: 60 * 60 * 24 * 5,
    });

    console.log("User authenticated:", decodedToken.uid);

    return response;

  } catch (error: any) {
    console.error("Login error:", error);

    return NextResponse.json(
      {
        error: "Authentication failed",
        details: error?.message ?? "Unknown error",
      },
      { status: 401 }
    );
  }
}