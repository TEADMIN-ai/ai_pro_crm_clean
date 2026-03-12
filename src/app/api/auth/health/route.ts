import { NextResponse } from "next/server";
import { getFirebaseAdminStatus, getFirebaseAdminServices } from "@/lib/firebase/admin";

export async function GET() {
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
