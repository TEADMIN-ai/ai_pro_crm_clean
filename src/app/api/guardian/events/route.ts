import { NextRequest, NextResponse } from "next/server";

import { GuardianMonitor } from "@/lib/guardian/GuardianMonitor";
import { AuthorizationError, requireAuthorizedUser } from "@/lib/server/authz";

export async function GET(request: NextRequest) {
  try {
    const user = await requireAuthorizedUser(request);

    if (!user.role) {
      return NextResponse.json({ error: "Invalid role" }, { status: 403 });
    }

    return NextResponse.json(
      {
        success: true,
        events: GuardianMonitor.getRecentEvents(),
      },
      { status: 200 }
    );
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    return NextResponse.json(
      {
        success: true,
        events: [],
      },
      { status: 200 }
    );
  }
}
