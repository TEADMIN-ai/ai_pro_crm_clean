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

    const contractors = snapshot.docs.map((doc) => {
      const data = doc.data() as Record<string, unknown>;
      return {
        id: doc.id,
        name: typeof data.name === "string" ? data.name : "",
        companyName: typeof data.companyName === "string" ? data.companyName : "",
        email: typeof data.email === "string" ? data.email : "",
        status: typeof data.status === "string" ? data.status : "",
        createdAt: typeof data.createdAt === "number" ? data.createdAt : 0,
      };
    });

    console.log("Contractors returned:", contractors.length);

    return NextResponse.json(contractors, { status: 200 });
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
