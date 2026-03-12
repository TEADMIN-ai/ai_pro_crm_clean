import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { getAdminAuth, getFirebaseAdminStatus } from "@/lib/firebase/admin";

const SESSION_MAX_AGE = 60 * 60 * 24 * 5;
const SESSION_EXPIRES_IN_MS = SESSION_MAX_AGE * 1000;

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as { idToken?: string };
    const idToken = typeof body.idToken === "string" ? body.idToken.trim() : "";

    if (!idToken) {
      return NextResponse.json({ error: "MISSING_ID_TOKEN" }, { status: 400 });
    }

    const firebaseStatus = getFirebaseAdminStatus();
    if (!firebaseStatus.valid) {
      console.error("Auth login failure:", {
        code: "FIREBASE_ENV_INVALID",
        message: firebaseStatus.message,
      });
      return NextResponse.json({ error: "FIREBASE_ENV_INVALID" }, { status: 503 });
    }

    const adminAuth = getAdminAuth();

    try {
      await adminAuth.verifyIdToken(idToken);
    } catch (error) {
      console.error("Auth login failure:", {
        code: "ID_TOKEN_VERIFICATION_FAILED",
        error,
      });
      return NextResponse.json({ error: "ID_TOKEN_VERIFICATION_FAILED" }, { status: 401 });
    }

    let sessionToken: string;
    try {
      sessionToken = await adminAuth.createSessionCookie(idToken, {
        expiresIn: SESSION_EXPIRES_IN_MS,
      });
    } catch (error) {
      console.error("Auth login failure:", {
        code: "SESSION_CREATION_FAILED",
        error,
      });
      return NextResponse.json({ error: "SESSION_CREATION_FAILED" }, { status: 401 });
    }

    const cookieStore = await cookies();
    cookieStore.set("session", sessionToken, {
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      path: "/",
      maxAge: SESSION_MAX_AGE,
    });

    console.log("Login success, session cookie created");

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error) {
    console.error("Auth login failure:", error);
    return NextResponse.json({ error: "AUTH_LOGIN_FAILED" }, { status: 500 });
  }
}
