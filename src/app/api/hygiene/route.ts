import { NextResponse, type NextRequest } from "next/server";
import { AuthorizationError, isPrivilegedRole, requireAuthorizedUser } from "@/lib/server/authz";
import { getHygieneDashboardData, seedCbavoHygieneDataset } from "@/lib/hygiene/hygieneService";

export const dynamic = "force-dynamic";

function errorResponse(error: unknown) {
  if (error instanceof AuthorizationError) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }

  const message = error instanceof Error ? error.message : "Hygiene request failed";
  console.error("[HYGIENE_API_ERROR]", error);
  return NextResponse.json({ error: message }, { status: 500 });
}

export async function GET(request: NextRequest) {
  try {
    await requireAuthorizedUser(request);
    const data = await getHygieneDashboardData();
    return NextResponse.json({ success: true, data });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuthorizedUser(request);
    if (user.role !== "admin" && user.role !== "manager") {
      return NextResponse.json({ error: "Only admin and manager users may seed hygiene data." }, { status: 403 });
    }

    const body = (await request.json().catch(() => ({}))) as { action?: string };
    if (body.action !== "seed-cbavo") {
      return NextResponse.json({ error: "Unsupported hygiene admin action." }, { status: 400 });
    }

    if (!isPrivilegedRole(user.role)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const result = await seedCbavoHygieneDataset();
    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    return errorResponse(error);
  }
}
