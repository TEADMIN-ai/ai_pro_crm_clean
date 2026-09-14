import { NextResponse, type NextRequest } from "next/server";
import { downloadFirebaseStorageObject } from "@/lib/firebase/storageRest";
import {
  buildConsolidatedHygieneClientPackFileName,
  buildPdfContentDisposition,
  generateConsolidatedHygieneClientPackPdf,
  type ConsolidatedCertificateAttachment,
} from "@/lib/hygiene/hygienePdfBranding";
import { getConsolidatedHygieneClientPackData } from "@/lib/hygiene/hygieneConsolidatedPack";
import { AuthorizationError, requireAuthorizedUser } from "@/lib/server/authz";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function errorResponse(error: unknown) {
  if (error instanceof AuthorizationError) return NextResponse.json({ error: error.message }, { status: error.status });
  console.error("[HYGIENE_CONSOLIDATED_CLIENT_PACK_ERROR]", error);
  return NextResponse.json({ error: "Hygiene consolidated client pack request failed" }, { status: 500 });
}

async function loadCertificateAttachments(data: Awaited<ReturnType<typeof getConsolidatedHygieneClientPackData>>): Promise<ConsolidatedCertificateAttachment[]> {
  const candidates = data.entries.flatMap((entry) =>
    entry.disposalEvidence
      .filter((item) => item.storagePath)
      .map((item) => ({
        evidenceId: item.evidenceId,
        manifestId: entry.manifest.manifestId,
        collectionId: entry.collection.collectionId,
        storagePath: item.storagePath as string,
      }))
  );
  const unique = new Map(candidates.map((item) => [item.evidenceId + ":" + item.storagePath, item]));
  const attachments = await Promise.all(Array.from(unique.values()).map(async (item) => {
    try {
      return {
        evidenceId: item.evidenceId,
        manifestId: item.manifestId,
        collectionId: item.collectionId,
        bytes: await downloadFirebaseStorageObject(item.storagePath),
      };
    } catch {
      return null;
    }
  }));
  return attachments.filter((item): item is ConsolidatedCertificateAttachment => Boolean(item));
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ clientId: string }> },
) {
  try {
    const user = await requireAuthorizedUser(request);
    const { clientId } = await context.params;
    const search = request.nextUrl.searchParams;
    const data = await getConsolidatedHygieneClientPackData(user, {
      clientId,
      startDate: search.get("startDate"),
      endDate: search.get("endDate"),
      siteId: search.get("siteId"),
      includeIncomplete: search.get("includeIncomplete") === "1",
    });
    const attachments = await loadCertificateAttachments(data);
    const bytes = await generateConsolidatedHygieneClientPackPdf(data, attachments);
    return new NextResponse(Buffer.from(bytes), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": buildPdfContentDisposition("attachment", buildConsolidatedHygieneClientPackFileName(data)),
        "Cache-Control": "private, no-store, max-age=0",
      },
    });
  } catch (error) {
    return errorResponse(error);
  }
}
