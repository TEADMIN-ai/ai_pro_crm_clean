import { NextRequest, NextResponse } from "next/server";
import { getManusHealthSummary } from "@/lib/manus/health/manusHealth";
import { AuthorizationError, requireAuthorizedUser } from "@/lib/server/authz";

export const runtime = "nodejs";

function jsonError(message: string, status = 500) {
  return NextResponse.json({ error: message }, { status });
}

export async function GET(request: NextRequest) {
  try {
    const user = await requireAuthorizedUser(request);
    if (user.role !== "admin") {
      throw new AuthorizationError("admin_only", 403);
    }

    const summary = await getManusHealthSummary();
    return NextResponse.json(summary);
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return jsonError(error.message, error.status);
    }

    return jsonError(error instanceof Error ? error.message : "Failed to load Manus health");
  }
}
