import { NextRequest, NextResponse } from "next/server";
import { AuthorizationError, requireAuthorizedUser } from "@/lib/server/authz";

export async function GET(request: NextRequest) {
  try {
    const user = await requireAuthorizedUser(request);

    return NextResponse.json(
      {
        sessionExists: true,
        userId: user.uid,
      },
      { status: 200 }
    );
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}
