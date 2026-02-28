import { NextResponse } from "next/server";
import { db } from "@/lib/firebase/admin";

export async function GET() {
  try {
    const snapshot = await db.collection("contractors").get();

    const contractors = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));

    return NextResponse.json({ contractors }, { status: 200 });
  } catch (error: any) {
    console.error("Failed to fetch contractors:", error);

    return NextResponse.json(
      {
        error: "Failed to fetch contractors",
        details: error.message || "Unknown error",
      },
      { status: 500 }
    );
  }
}