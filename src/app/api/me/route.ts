import { NextRequest, NextResponse } from "next/server";
import { getAuth } from "firebase-admin/auth";
import { normalizeContractorId, resolveRole } from "@/lib/auth/userProfile";
import { getFirebaseAdmin } from "@/lib/firebase/admin";
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
  console.info("[/api/me] START /api/me");

  const authorizationHeader = request.headers.get("authorization");
  const token = extractBearerToken(authorizationHeader);

  if (!token) {
    console.error("[/api/me] Missing bearer token");
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    console.info("[/api/me] Verifying bearer token");

    const decodedToken = await getAuth().verifyIdToken(token);

    console.info("[/api/me] TOKEN VERIFIED", { uid: decodedToken.uid });

    console.info("[/api/me] BEFORE FIRESTORE READ", { uid: decodedToken.uid });

    let profileData: Record<string, unknown> = {};
    const firestoreReadStartedAt = Date.now();

    try {
      console.info("[/api/me] FIRESTORE READ START", { uid: decodedToken.uid });
      const profileSnapshot = await getFirebaseAdmin()
        .collection("users")
        .doc(decodedToken.uid)
        .get();
      const firestoreReadDurationMs = Date.now() - firestoreReadStartedAt;
      profileData = profileSnapshot.exists
        ? ((profileSnapshot.data() ?? {}) as Record<string, unknown>)
        : {};
      console.info("[/api/me] FIRESTORE READ SUCCESS", {
        uid: decodedToken.uid,
        profileExists: profileSnapshot.exists,
        durationMs: firestoreReadDurationMs,
      });
    } catch (profileError) {
      const firestoreReadDurationMs = Date.now() - firestoreReadStartedAt;
      console.error("[/api/me] FIRESTORE READ FAILURE", {
        uid: decodedToken.uid,
        durationMs: firestoreReadDurationMs,
        error: profileError,
      });
      return NextResponse.json({ error: "PROFILE_LOOKUP_FAILED" }, { status: 500 });
    }

    console.info("[/api/me] BEFORE ROLE RESOLUTION", { uid: decodedToken.uid });

    const role = resolveRole(profileData.role, decodedToken.role);
    const contractorId =
      normalizeContractorId(profileData.contractorId) ??
      normalizeContractorId(decodedToken.contractorId);

    const responseBody = {
      uid: decodedToken.uid,
      email: decodedToken.email ?? null,
      role,
      contractorId: contractorId ?? null,
    };

    console.info("[/api/me] RESPONSE SENT", responseBody);

    return NextResponse.json(responseBody, { status: 200 });
  } catch (error) {
    console.error("[/api/me] Auth flow failed", error);
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}
