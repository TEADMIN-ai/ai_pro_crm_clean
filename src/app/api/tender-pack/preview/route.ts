import { NextRequest, NextResponse } from "next/server";
import { AuthorizationError, requireAuthorizedUser } from "@/lib/server/authz";

export async function POST(req: NextRequest) {
  try {
    const user = await requireAuthorizedUser(req);

    if (!user.role) {
      return NextResponse.json({ error: "Invalid role" }, { status: 403 });
    }

    const body = await req.json();
    const { dealId, contractorId } = body;

    if (!dealId || !contractorId) {
      return new NextResponse("Missing deal or contractor data", {
        status: 400,
      });
    }

    console.log("PREVIEW REQUEST:", { dealId, contractorId });

    const pdfContent = `
      Tender Preview

      Deal ID: ${dealId}
      Contractor ID: ${contractorId}

      (PDF engine not yet connected)
    `;

    const buffer = Buffer.from(pdfContent, "utf-8");

    return new NextResponse(buffer, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": "inline; filename=preview.pdf",
      },
    });
  } catch (err) {
    if (err instanceof AuthorizationError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }

    console.error("PREVIEW API ERROR:", err);

    return new NextResponse("Server error", { status: 500 });
  }
}
