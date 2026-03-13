import { NextRequest, NextResponse } from "next/server";
import { AuthorizationError, requireAuthorizedUser } from "@/lib/server/authz";
import { getDashboardAnalytics } from "@/server/services/analyticsService";

export async function GET(request: NextRequest) {
  try {
    const actor = await requireAuthorizedUser(request);
    const analytics = await getDashboardAnalytics(actor);
    return NextResponse.json(analytics, { status: 200 });
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    console.error("Failed to fetch dashboard analytics:", error);
    return NextResponse.json({ error: "Failed to fetch dashboard analytics" }, { status: 500 });
  }
}
