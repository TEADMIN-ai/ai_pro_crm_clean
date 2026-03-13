import { NextRequest, NextResponse } from "next/server";
import { syncUserClaims } from "@/server/services/authService";

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get("authorization");

    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json({ error: "Missing token" }, { status: 401 });
    }

    const idToken = authHeader.split("Bearer ")[1];
    const { role, contractorId } = await syncUserClaims(idToken);

    return NextResponse.json({
      success: true,
      role,
      contractorId: contractorId ?? null,
    });
  } catch (error) {
    console.error("Sync role failed:", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
