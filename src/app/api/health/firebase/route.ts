import { NextResponse } from "next/server";
import { getStorage } from "firebase-admin/storage";
import { getFirebaseAdmin } from "@/lib/firebase/admin";

export async function GET() {
  try {
    getFirebaseAdmin();
    getStorage();

    return NextResponse.json({
      status: "ok",
      firestore: true,
      storage: true,
    });
  } catch (error) {
    console.error("Firebase health check failed:", error);

    return NextResponse.json(
      {
        status: "error",
        firestore: false,
        storage: false,
        error: error instanceof Error ? error.message : "Firebase initialization failed",
      },
      { status: 503 }
    );
  }
}
