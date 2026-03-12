import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { adminAuth } from "@/lib/firebase/admin";

const SESSION_MAX_AGE = 60 * 60 * 24 * 5;
const SESSION_EXPIRES_IN_MS = SESSION_MAX_AGE * 1000;

function getSessionCookieDomain(): string | undefined {
  return process.env.NODE_ENV === "production" ? ".vercel.app" : undefined;
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as { idToken?: string };
    const idToken = typeof body.idToken === "string" ? body.idToken.trim() : "";

    if (!idToken) {
      return NextResponse.json({ error: "Missing idToken" }, { status: 400 });
    }

    await adminAuth.verifyIdToken(idToken);
    const sessionToken = await adminAuth.createSessionCookie(idToken, {
      expiresIn: SESSION_EXPIRES_IN_MS,
    });

    const cookieStore = await cookies();
    cookieStore.set("session", sessionToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: SESSION_MAX_AGE,
      domain: getSessionCookieDomain(),
    });

    console.log("Login success, session cookie created");

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error) {
    console.error("Login session creation failed", error);
    return NextResponse.json({ error: "Unable to create session" }, { status: 401 });
  }
}
