import { NextRequest, NextResponse } from "next/server";
import { AuthorizationError, isPrivilegedRole, requireAuthorizedUser } from "@/lib/server/authz";
import { extractOpportunityMetadataFromPdf } from "@/lib/opportunities/opportunityDocumentExtraction";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuthorizedUser(request);
    if (!isPrivilegedRole(user.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const formData = await request.formData();
    const uploadedFile = formData.get("file");
    if (!(uploadedFile instanceof File)) {
      return NextResponse.json({ error: "file is required" }, { status: 400 });
    }
    if (!uploadedFile.name.toLowerCase().endsWith(".pdf")) {
      return NextResponse.json({ error: "Only PDF files can be analyzed" }, { status: 400 });
    }

    const buffer = Buffer.from(await uploadedFile.arrayBuffer());
    const extraction = await extractOpportunityMetadataFromPdf({
      fileName: uploadedFile.name,
      buffer,
    });

    return NextResponse.json({ extraction }, { status: 200 });
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    console.error("[opportunity-register/analyze] failed", error);
    return NextResponse.json(
      { error: "Failed to analyze opportunity document", details: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 },
    );
  }
}
