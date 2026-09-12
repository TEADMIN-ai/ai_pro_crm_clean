import { NextResponse, type NextRequest } from "next/server";
import { buildHygieneManifestFileName, buildPdfContentDisposition, generateHygieneManifestPdf } from "@/lib/hygiene/hygienePdfBranding";
import { getHygieneManifestPdfData } from "@/lib/hygiene/hygienePdfData";
import { AuthorizationError, requireAuthorizedUser } from "@/lib/server/authz";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function isMissingManifestError(error: unknown): boolean {
  return error instanceof Error && error.message === "Hygiene manifest was not found.";
}

function errorResponse(error: unknown) {
  if (error instanceof AuthorizationError) return NextResponse.json({ error: error.message }, { status: error.status });
  if (isMissingManifestError(error)) return NextResponse.json({ error: "Hygiene manifest was not found." }, { status: 404 });
  console.error("[HYGIENE_MANIFEST_PDF_ERROR]", error);
  return NextResponse.json({ error: "Hygiene manifest PDF request failed" }, { status: 500 });
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ manifestId: string }> }
) {
  try {
    const user = await requireAuthorizedUser(request);
    const { manifestId } = await context.params;
    const data = await getHygieneManifestPdfData(user, manifestId);
    const bytes = await generateHygieneManifestPdf(data);
    const disposition = request.nextUrl.searchParams.get("download") === "1" ? "attachment" : "inline";
    return new NextResponse(Buffer.from(bytes), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": buildPdfContentDisposition(disposition, buildHygieneManifestFileName(data)),
        "Cache-Control": "private, no-store, max-age=0",
      },
    });
  } catch (error) {
    return errorResponse(error);
  }
}
