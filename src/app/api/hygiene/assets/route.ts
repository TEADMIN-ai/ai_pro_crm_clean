import { NextResponse, type NextRequest } from "next/server";
import { AuthorizationError, requireAuthorizedUser } from "@/lib/server/authz";
import { upsertHygieneAsset } from "@/lib/hygiene/hygieneService";

export const dynamic = "force-dynamic";

function errorResponse(error: unknown) {
  if (error instanceof AuthorizationError) return NextResponse.json({ error: error.message }, { status: error.status });
  const message = error instanceof Error ? error.message : "Hygiene asset request failed";
  console.error("[HYGIENE_ASSET_API_ERROR]", error);
  return NextResponse.json({ error: message }, { status: 500 });
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuthorizedUser(request);
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const record = await upsertHygieneAsset(user, body);
    return NextResponse.json({ success: true, record });
  } catch (error) {
    return errorResponse(error);
  }
}
