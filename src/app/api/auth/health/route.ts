import { NextRequest, NextResponse } from "next/server";
import { getAuth } from "firebase-admin/auth";
import { getFirebaseAdmin } from "@/lib/firebase/admin";
import { AuthorizationError, requireAuthorizedUser } from "@/lib/server/authz";

export async function GET(request: NextRequest) {
  try {
    const user = await requireAuthorizedUser(request);

    if (!user.role) {
      return NextResponse.json({ error: "Invalid role" }, { status: 403 });
    }
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let firebaseAdminInitialized = false;
  let sessionCookieWorking = false;
  let envValid = true;

  try {
    getFirebaseAdmin();
    firebaseAdminInitialized = true;
  } catch (error) {
    envValid = false;
    console.error("Firebase admin health check failed:", error);
  }

  try {
    getAuth();
    sessionCookieWorking = true;
  } catch (error) {
    console.error("Firebase auth health check failed:", error);
  }

  const response = {
    firebaseAdminInitialized,
    envValid,
    sessionCookieWorking,
  };

  return NextResponse.json(response, {
    status: response.firebaseAdminInitialized && response.envValid ? 200 : 503,
  });
}
