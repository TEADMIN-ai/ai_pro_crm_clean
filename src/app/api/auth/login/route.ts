import { NextRequest, NextResponse } from "next/server";
import { getAdminAuth, SESSION_COOKIE_EXPIRES_IN_MS } from "@/lib/firebase/admin";
import { requireAuth } from "@/lib/server/requireAuth";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    await requireAuth(request);

    console.log("LOGIN START");

    const { idToken } = (await request.json()) as { idToken?: string };

    if (!idToken) {
      return NextResponse.json({ error: "Missing ID token" }, { status: 400 });
    }

    console.log("TOKEN LENGTH:", idToken?.length);

    const adminAuth = getAdminAuth();

    console.log("VERIFYING TOKEN");
    const decodedToken = await adminAuth.verifyIdToken(idToken);

    console.log("LOGIN DEBUG UID:", decodedToken.uid);

    const expiresIn = SESSION_COOKIE_EXPIRES_IN_MS;
    const sessionCookie = await adminAuth.createSessionCookie(idToken, { expiresIn });

    console.log("SESSION COOKIE CREATED");

    const response = NextResponse.json({
      success: true,
      uid: decodedToken.uid,
    });

    response.cookies.set("session", sessionCookie, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: expiresIn / 1000,
    });

    return response;
  } catch (error: unknown) {
    console.error("LOGIN ERROR:", error);

    const details = error instanceof Error ? error.message : "Unknown error";
    const status = details === "Unauthorized" || details === "Invalid token" ? 401 : 500;

    return NextResponse.json(
      {
        error: "Session creation failed",
        details,
      },
      { status }
    );
  }
}
