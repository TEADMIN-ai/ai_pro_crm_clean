import { NextResponse, type NextRequest } from "next/server";
import { AuthorizationError, requireAuthorizedUser } from "@/lib/server/authz";
import { generateHygieneMonthlyReport } from "@/lib/hygiene/hygieneService";

export const dynamic = "force-dynamic";

function errorResponse(error: unknown) {
  if (error instanceof AuthorizationError) return NextResponse.json({ error: error.message }, { status: error.status });
  const message = error instanceof Error ? error.message : "Hygiene report request failed";
  console.error("[HYGIENE_REPORT_API_ERROR]", error);
  return NextResponse.json({ error: message }, { status: 500 });
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuthorizedUser(request);
    const body = (await request.json().catch(() => ({}))) as { period?: string };
    const report = await generateHygieneMonthlyReport(user, body.period || new Date().toISOString().slice(0, 7));
    return NextResponse.json({ success: true, report });
  } catch (error) {
    return errorResponse(error);
  }
}
