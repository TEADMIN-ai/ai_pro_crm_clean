import { NextRequest, NextResponse } from "next/server";
import { getFirebaseAdminStatus, getFirebaseAdminServices } from "@/lib/firebase/admin";
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

  const status = getFirebaseAdminStatus();

  let firebaseAdminInitialized = status.firebaseAdminInitialized;
  let sessionCookieWorking = false;

  try {
    getFirebaseAdminServices();
    firebaseAdminInitialized = true;
    sessionCookieWorking = true;
  } catch (error) {
    console.error("Firebase auth health check failed:", error);
  }

  const response = {
    firebaseAdminInitialized,
    envValid: status.valid,
    sessionCookieWorking,
  };

  return NextResponse.json(response, {
    status: response.firebaseAdminInitialized && response.envValid ? 200 : 503,
  });
}
