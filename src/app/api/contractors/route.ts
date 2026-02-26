import { NextResponse } from "next/server";
import { getFirebaseAdmin } from "@/lib/firebase/admin";

/**
 * GET /api/contractors
 *
 * Returns all contractors with proper ID mapping.
 * This ensures frontend dropdowns and linking work correctly.
 */
export async function GET() {
  try {
    const { db } = getFirebaseAdmin();

    if (!db) {
      return NextResponse.json(
        { error: "Firestore not initialized" },
        { status: 500 }
      );
    }

    const snapshot = await db.collection("contractors").get();

    return NextResponse.json(
      snapshot.docs.map((doc) => ({
        id: doc.id,
        companyName: doc.data().companyName ?? "",
        email: doc.data().email ?? "",
        status: doc.data().status ?? "active",
      }))
    );
  } catch (error: any) {
    console.error("Failed to fetch contractors:", error);

    return NextResponse.json(
      {
        error: "Failed to fetch contractors",
        details: error?.message || "Unknown error",
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/contractors
 *
 * Creates a new contractor safely.
 */
export async function POST(req: Request) {
  try {
    const body = await req.json();

    const { db } = getFirebaseAdmin();

    if (!db) {
      return NextResponse.json(
        { error: "Firestore not initialized" },
        { status: 500 }
      );
    }

    const newContractor = {
      name: body.name || "",
      companyName: body.companyName || "",
      email: body.email || "",
      status: body.status || "active",
      createdAt: Date.now(),
    };

    const docRef = await db.collection("contractors").add(newContractor);

    return NextResponse.json(
      {
        success: true,
        id: docRef.id,
        ...newContractor,
      },
      { status: 201 }
    );
  } catch (error: any) {
    console.error("Failed to create contractor:", error);

    return NextResponse.json(
      {
        error: "Failed to create contractor",
        details: error?.message || "Unknown error",
      },
      { status: 500 }
    );
  }
}
