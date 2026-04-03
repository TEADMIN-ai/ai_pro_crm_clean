import { NextRequest, NextResponse } from "next/server";
import { getBootstrapUser, syncUserClaims } from "@/server/services/authService";

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get("authorization");

    if (authHeader?.startsWith("Bearer ")) {
      const idToken = authHeader.split("Bearer ")[1];
      const { role, contractorId } = await syncUserClaims(idToken);

      return NextResponse.json({
        success: true,
        role,
        contractorId: contractorId ?? null,
      });
    }

    const user = await getBootstrapUser({
      sessionCookie: req.cookies.get("session")?.value,
    });

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    return NextResponse.json({
      success: true,
      role: user.role,
      contractorId: user.contractorId ?? null,
    });
  } catch (error) {
    console.error("Sync role failed:", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
