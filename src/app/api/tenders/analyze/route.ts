import { NextRequest, NextResponse } from "next/server";
import { analyzeTenderText } from "@/lib/tenderAnalysisService";
import { AuthorizationError, requireAuthorizedUser } from "@/lib/server/authz";

export async function POST(req: NextRequest) {
  try {
    const user = await requireAuthorizedUser(req);

    if (!user.role) {
      return NextResponse.json({ error: "Invalid role" }, { status: 403 });
    }

    const body = (await req.json()) as { text?: unknown };

    if (typeof body.text !== "string" || !body.text.trim()) {
      return NextResponse.json(
        { error: "Tender text is required" },
        { status: 400 }
      );
    }

    const result = analyzeTenderText(body.text);

    return NextResponse.json(result);
  } catch (error: any) {
    if (error instanceof AuthorizationError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    console.error(" TENDER ANALYSIS ERROR:", error);

    return NextResponse.json(
      { error: "Failed to analyze tender", details: error.message },
      { status: 500 }
    );
  }
}
