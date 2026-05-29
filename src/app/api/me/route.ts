import { NextRequest, NextResponse } from "next/server";
import { getAuth } from "firebase-admin/auth";
import { normalizeContractorId, resolveRole } from "@/lib/auth/userProfile";
import { getFirebaseAdmin } from "@/lib/firebase/admin";
export const runtime = "nodejs";

const PROFILE_READ_TIMEOUT_MS = 1500;

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

async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  label: string,
): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;

  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timeoutId = setTimeout(() => {
          reject(new Error(`${label} timed out after ${timeoutMs}ms`));
        }, timeoutMs);
      }),
    ]);
  } finally {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
  }
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

    try {
      const profileSnapshot = await withTimeout(
        getFirebaseAdmin().collection("users").doc(decodedToken.uid).get(),
        PROFILE_READ_TIMEOUT_MS,
        "users profile read",
      );
      profileData = profileSnapshot.exists
        ? ((profileSnapshot.data() ?? {}) as Record<string, unknown>)
        : {};
      console.info("[/api/me] AFTER FIRESTORE READ", {
        uid: decodedToken.uid,
        profileExists: profileSnapshot.exists,
      });
    } catch (profileError) {
      console.error("[/api/me] FIRESTORE READ FAILED_OR_TIMED_OUT", {
        uid: decodedToken.uid,
        error: profileError,
      });
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
