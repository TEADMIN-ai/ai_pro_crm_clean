import { NextRequest, NextResponse } from "next/server";
import { AuthorizationError, requireAuthorizedUser } from "@/lib/server/authz";

export async function GET(request: NextRequest) {
  try {
    const user = await requireAuthorizedUser(request);

    if (!user.role) {
      return NextResponse.json({ error: "Invalid role" }, { status: 403 });
    }

    return NextResponse.json({ user }, { status: 200 });
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    console.error("Auth bootstrap failed:", error);
    return NextResponse.json({ error: "Failed to bootstrap auth" }, { status: 500 });
  }
}
