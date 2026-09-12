import { NextResponse, type NextRequest } from "next/server";
import { downloadFirebaseStorageObject } from "@/lib/firebase/storageRest";
import { buildHygieneManifestFileName, buildPdfContentDisposition, generateHygieneClientPackPdf } from "@/lib/hygiene/hygienePdfBranding";
import { evaluateGovernedStoragePath, isExpectedHygieneCollectionEvidencePath } from "@/lib/master-data/storagePathPolicy";
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
  console.error("[HYGIENE_CLIENT_PACK_ERROR]", error);
  return NextResponse.json({ error: "Hygiene client pack request failed" }, { status: 500 });
}

function certificateStoragePath(data: Awaited<ReturnType<typeof getHygieneManifestPdfData>>): string | null {
  const certificate = data.disposalEvidence?.find((item) => {
    const path = "storagePath" in item ? item.storagePath : null;
    const url = "fileUrl" in item ? item.fileUrl : null;
    return Boolean((path || url) && /\.(pdf)(?:$|\?)/i.test(path || url || ""));
  });
  if (!certificate) return null;
  return ("storagePath" in certificate ? certificate.storagePath : null) || ("fileUrl" in certificate ? certificate.fileUrl : null) || null;
}

async function loadCertificatePdf(data: Awaited<ReturnType<typeof getHygieneManifestPdfData>>): Promise<Uint8Array | null> {
  const storagePath = certificateStoragePath(data);
  if (!storagePath || /^https?:\/\//i.test(storagePath)) return null;
  const decision = evaluateGovernedStoragePath(storagePath, ["hygiene/evidence/", "hygiene/compliance/"]);
  if (!decision.allowed || !decision.normalizedPath) return null;
  if (decision.normalizedPath.startsWith("hygiene/evidence/") && !isExpectedHygieneCollectionEvidencePath({ path: decision.normalizedPath, clientId: data.manifest.clientId, collectionId: data.manifest.collectionId })) return null;
  return downloadFirebaseStorageObject(decision.normalizedPath);
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ manifestId: string }> }
) {
  try {
    const user = await requireAuthorizedUser(request);
    const { manifestId } = await context.params;
    const data = await getHygieneManifestPdfData(user, manifestId);
    const certificateBytes = await loadCertificatePdf(data).catch(() => null);
    const bytes = await generateHygieneClientPackPdf(data, certificateBytes);
    const filename = buildHygieneManifestFileName(data).replace("_Waste-Manifest_", "_Client-Pack_Waste-Manifest_");
    return new NextResponse(Buffer.from(bytes), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": buildPdfContentDisposition("attachment", filename),
        "Cache-Control": "private, no-store, max-age=0",
      },
    });
  } catch (error) {
    return errorResponse(error);
  }
}
