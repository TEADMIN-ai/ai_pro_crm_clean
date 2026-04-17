import { NextRequest, NextResponse } from "next/server";
import { normalizeRole } from "@/lib/auth/userProfile";
import { getAdminAuth, getFirebaseAdmin } from "@/lib/firebase/admin";

export const runtime = "nodejs";

function extractBearerToken(authorizationHeader: string | null): string | null {
  if (!authorizationHeader) {
    return null;
  }

  const [scheme, token] = authorizationHeader.split(" ");

  if (scheme !== "Bearer" || !token) {
    return null;
  }

  return token;
}

export async function GET(request: NextRequest) {
  const authorizationHeader = request.headers.get("authorization");
  const token = extractBearerToken(authorizationHeader);

  if (!token) {
    console.error("[/api/me] Missing bearer token");
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    console.info("[/api/me] Verifying bearer token");

    const decodedToken = await getAdminAuth().verifyIdToken(token);

    console.info("[/api/me] Token verified", { uid: decodedToken.uid });

    const profileSnapshot = await getFirebaseAdmin().collection("users").doc(decodedToken.uid).get();
    const profileData = profileSnapshot.exists ? profileSnapshot.data() ?? {} : {};
    const role = normalizeRole(profileData.role ?? decodedToken.role);

    const responseBody = {
      uid: decodedToken.uid,
      email: decodedToken.email ?? null,
      role,
    };

    console.info("[/api/me] Returning profile", responseBody);

    return NextResponse.json(responseBody, { status: 200 });
  } catch (error) {
    console.error("[/api/me] Token verification failed", error);
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}
