import { NextResponse } from "next/server";
import { getFirebaseAdmin } from "@/lib/firebase/admin";

export async function GET() {
  try {
    const db = getFirebaseAdmin();

    const snapshot = await db.collection("contractors").get();

    const contractors = snapshot.docs.map((doc: any) => ({
      id: doc.id,
      ...doc.data(),
    }));

    return NextResponse.json(
      { contractors },
      { status: 200 }
    );
  } catch (error) {
    console.error("GET /api/contractors error:", error);

    return NextResponse.json(
      { error: "Failed to fetch contractors" },
      { status: 500 }
    );
  }
}