import { NextRequest, NextResponse } from "next/server";
import { AuthorizationError, requireAuthorizedUser } from "@/lib/server/authz";

export async function GET(request: NextRequest) {
  try {
    const user = await requireAuthorizedUser(request);

    if (!user.role) {
      return NextResponse.json({ error: "Invalid role" }, { status: 403 });
    }

    return NextResponse.json({ status: "preview route active" });
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await requireAuthorizedUser(req);

    if (!user.role) {
      return NextResponse.json({ error: "Invalid role" }, { status: 403 });
    }

    const body = await req.json();
    const { dealId, contractorId } = body;

    if (!dealId || !contractorId) {
      return new NextResponse("Missing deal or contractor data", { status: 400 });
    }

    console.log("PREVIEW API HIT:", { dealId, contractorId });

    const content = `
      Tender Preview

      Deal ID: ${dealId}
      Contractor ID: ${contractorId}
    `;

    const buffer = Buffer.from(content, "utf-8");

    return new NextResponse(buffer, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": "inline; filename=preview.pdf",
      },
    });
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    console.error("PREVIEW ERROR:", error);
    return new NextResponse("Server error", { status: 500 });
  }
}
