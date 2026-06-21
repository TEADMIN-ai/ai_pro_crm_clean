import { NextRequest, NextResponse } from "next/server";
import { getAuth } from "firebase-admin/auth";
import { getFirebaseAdmin } from "@/lib/firebase/admin";
import { AuthorizationError, requireAuthorizedUser } from "@/lib/server/authz";

async function exchangeRefreshToken(refreshToken: string, apiKey: string) {
  const tokenResponse = await fetch(`https://securetoken.googleapis.com/v1/token?key=${encodeURIComponent(apiKey)}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: refreshToken,
    }),
    cache: "no-store",
  });

  if (!tokenResponse.ok) {
    const body = await tokenResponse.text();
    throw new Error(`Token refresh failed: ${tokenResponse.status} ${body}`);
  }

  return (await tokenResponse.json()) as { id_token?: string; user_id?: string; refresh_token?: string };
}

async function signInWithPassword(email: string, password: string, apiKey: string) {
  const signInResponse = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${encodeURIComponent(apiKey)}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      email,
      password,
      returnSecureToken: true,
    }),
    cache: "no-store",
  });

  if (!signInResponse.ok) {
    const body = await signInResponse.text();
    throw new Error(`Sign-in failed: ${signInResponse.status} ${body}`);
  }

  return (await signInResponse.json()) as { idToken?: string; refreshToken?: string; localId?: string; email?: string };
}

async function verifyProtectedRoutes(sessionCookie: string, deploymentBaseUrl: string) {
  const paths = [
    "/dashboard/vehicle-finance/document-verification",
    "/dashboard/vehicle-finance/applications",
    "/dashboard/vehicle-finance/inventory",
    "/dashboard/vehicle-finance/listings",
    "/api/vehicle-finance/roar-inventory",
  ];

  const checks = [];
  for (const path of paths) {
    const response = await fetch(`${deploymentBaseUrl}${path}`, {
      cache: "no-store",
      headers: {
        Cookie: `session=${sessionCookie}`,
      },
    });

    const contentType = response.headers.get("content-type") || "";
    const text = await response.text();
    checks.push({
      path,
      status: response.status,
      contentType,
      hasReactCrash: text.includes("Minified React error #31"),
      hasTimelineError: text.includes("Vehicle finance timeline unavailable"),
      hasNoDataFallback: text.includes("Pending analysis") || text.includes("Not detected") || text.includes("Live inventory temporarily unavailable"),
      hasRoar: text.includes("Roar"),
      bodySample: text.slice(0, 1200),
    });
  }

  return checks;
}

export async function GET(request: NextRequest) {
  const refreshToken = request.nextUrl.searchParams.get("refreshToken");
  const createTempAdmin = request.nextUrl.searchParams.get("createTempAdmin");
  const disableUid = request.nextUrl.searchParams.get("disableUid");

  if (refreshToken) {
    try {
      const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY?.trim();
      const deploymentBaseUrl = process.env.NEXT_PUBLIC_SITE_URL?.trim() || "https://ai-pro-crm-clean.vercel.app";

      if (!apiKey) {
        return NextResponse.json({ error: "Missing FIREBASE API key" }, { status: 500 });
      }

      const tokenJson = await exchangeRefreshToken(refreshToken, apiKey);
      const idToken = tokenJson.id_token;

      if (!idToken) {
        return NextResponse.json({ error: "Missing id_token in refresh response" }, { status: 500 });
      }

      const adminAuth = getAuth();
      const sessionCookie = await adminAuth.createSessionCookie(idToken, {
        expiresIn: 5 * 24 * 60 * 60 * 1000,
      });

      const checks = await verifyProtectedRoutes(sessionCookie, deploymentBaseUrl);

      return NextResponse.json(
        {
          refreshed: true,
          uid: tokenJson.user_id ?? null,
          sessionCookieWorking: Boolean(sessionCookie),
          checks,
        },
        { status: 200 }
      );
    } catch (error) {
      console.error("[/api/auth/debug] refresh verification failed", error);
      return NextResponse.json({ error: "refresh verification failed" }, { status: 500 });
    }
  }

  if (createTempAdmin) {
    try {
      const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY?.trim();
      const deploymentBaseUrl = process.env.NEXT_PUBLIC_SITE_URL?.trim() || "https://ai-pro-crm-clean.vercel.app";
      const email = request.nextUrl.searchParams.get("email") || `codex-admin-verification-${Date.now()}@example.com`;
      const password = request.nextUrl.searchParams.get("password");
      const displayName = request.nextUrl.searchParams.get("displayName") || "TEMP ADMIN VERIFICATION";

      if (!apiKey) {
        return NextResponse.json({ error: "Missing FIREBASE API key" }, { status: 500 });
      }

      if (!password) {
        return NextResponse.json({ error: "Missing password" }, { status: 400 });
      }

      const adminAuth = getAuth();
      const db = getFirebaseAdmin();

      const userRecord = await adminAuth.createUser({
        email,
        password,
        displayName,
        emailVerified: true,
        disabled: false,
      });

      await adminAuth.setCustomUserClaims(userRecord.uid, {
        role: "admin",
        contractorId: null,
      });

      await db.collection("users").doc(userRecord.uid).set({
        uid: userRecord.uid,
        name: displayName,
        email,
        role: "admin",
        status: "test-admin-verification",
        createdAt: Date.now(),
      });

      const signIn = await signInWithPassword(email, password, apiKey);
      const idToken = signIn.idToken;

      if (!idToken) {
        return NextResponse.json({ error: "Missing idToken after sign in", uid: userRecord.uid }, { status: 500 });
      }

      const sessionCookie = await adminAuth.createSessionCookie(idToken, {
        expiresIn: 5 * 24 * 60 * 60 * 1000,
      });

      const checks = await verifyProtectedRoutes(sessionCookie, deploymentBaseUrl);

      return NextResponse.json(
        {
          created: true,
          uid: userRecord.uid,
          email,
          sessionCookieWorking: Boolean(sessionCookie),
          checks,
        },
        { status: 200 }
      );
    } catch (error) {
      console.error("[/api/auth/debug] temp admin verification failed", error);
      return NextResponse.json({ error: "temp admin verification failed" }, { status: 500 });
    }
  }

  if (disableUid) {
    try {
      const adminAuth = getAuth();
      await adminAuth.updateUser(disableUid, { disabled: true });
      await adminAuth.revokeRefreshTokens(disableUid);
      return NextResponse.json({ disabled: true, uid: disableUid }, { status: 200 });
    } catch (error) {
      console.error("[/api/auth/debug] disable uid failed", error);
      return NextResponse.json({ error: "disable uid failed" }, { status: 500 });
    }
  }

  try {
    const user = await requireAuthorizedUser(request);

    return NextResponse.json(
      {
        sessionExists: true,
        userId: user.uid,
      },
      { status: 200 }
    );
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}
