import { NextResponse } from "next/server";
import { getFirebaseAdmin } from "@/lib/firebase/admin";

export async function POST(req: Request) {
  try {
    const db = getFirebaseAdmin();
    const body = await req.json();

    const contractor = {
      companyName: body.companyName,
      email: body.email,
      status: "pending",
      createdAt: Date.now(),
      compliancePercentage: 0
    };

    const docRef = await db.collection("contractors").add(contractor);

    return NextResponse.json({
      success: true,
      contractorId: docRef.id
    });

  } catch (error) {
    return NextResponse.json({
      success: false,
      error: "Registration failed"
    }, { status: 500 });
  }
}
