import { NextResponse, type NextRequest } from "next/server";
import { AuthorizationError, requireAuthorizedUser } from "@/lib/server/authz";
import { generateHygieneManifest, updateHygieneManifest } from "@/lib/hygiene/hygieneService";

export const dynamic = "force-dynamic";

function errorResponse(error: unknown) {
  if (error instanceof AuthorizationError) return NextResponse.json({ error: error.message }, { status: error.status });
  const message = error instanceof Error ? error.message : "Hygiene manifest request failed";
  console.error("[HYGIENE_MANIFEST_API_ERROR]", error);
  return NextResponse.json({ error: message }, { status: 500 });
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuthorizedUser(request);
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown> & { action?: string };
    if (body.action === "generate") {
      const manifest = await generateHygieneManifest(user, typeof body.collectionId === "string" ? body.collectionId : "");
      return NextResponse.json({ success: true, manifest });
    }

    const manifest = await updateHygieneManifest(user, body as never);
    return NextResponse.json({ success: true, manifest });
  } catch (error) {
    return errorResponse(error);
  }
}
