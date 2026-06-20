import { NextRequest, NextResponse } from "next/server";
import { getAuth } from "firebase-admin/auth";
import { AuthorizationError, requireAuthorizedUser } from "@/lib/server/authz";

export async function GET(request: NextRequest) {
  const refreshToken = request.nextUrl.searchParams.get("refreshToken");

  if (refreshToken) {
    try {
      const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY?.trim();
      const deploymentBaseUrl = process.env.NEXT_PUBLIC_SITE_URL?.trim() || "https://ai-pro-crm-clean.vercel.app";

      if (!apiKey) {
        return NextResponse.json({ error: "Missing FIREBASE API key" }, { status: 500 });
      }

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
        return NextResponse.json(
          {
            error: "Token refresh failed",
            status: tokenResponse.status,
            body: body.slice(0, 500),
          },
          { status: 500 }
        );
      }

      const tokenJson = (await tokenResponse.json()) as { id_token?: string; user_id?: string; refresh_token?: string };
      const idToken = tokenJson.id_token;

      if (!idToken) {
        return NextResponse.json({ error: "Missing id_token in refresh response" }, { status: 500 });
      }

      const adminAuth = getAuth();
      const sessionCookie = await adminAuth.createSessionCookie(idToken, {
        expiresIn: 5 * 24 * 60 * 60 * 1000,
      });

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
