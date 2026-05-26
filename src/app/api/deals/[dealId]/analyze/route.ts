import { NextRequest, NextResponse } from "next/server";
import { getFirebaseAdmin } from "@/lib/firebase/admin";
import { AuthorizationError, assertCanAccessContractor, requireAuthorizedUser } from "@/lib/server/authz";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ dealId: string }> }
) {
  try {
    const db = getFirebaseAdmin();
    const user = await requireAuthorizedUser(req);

    if (!user.role) {
      return NextResponse.json({ error: "Invalid role" }, { status: 403 });
    }

    const body = (await req.json()) as {
      requirements?: unknown;
      missing?: unknown;
      score?: unknown;
      risk?: unknown;
    };
    const { dealId } = await params;

    const dealRef = db.collection("deals").doc(dealId);
    const dealSnapshot = await dealRef.get();

    if (!dealSnapshot.exists) {
      return NextResponse.json({ error: "Deal not found" }, { status: 404 });
    }

    const contractorId = typeof dealSnapshot.data()?.contractorId === "string"
      ? dealSnapshot.data()?.contractorId
      : "";

    if (!contractorId) {
      return NextResponse.json({ error: "Missing contractorId on deal" }, { status: 400 });
    }

    assertCanAccessContractor(user, contractorId);

    await dealRef.update({
      analysis: {
        requirements:
          body.requirements && typeof body.requirements === "object" ? body.requirements : {},
        missing: Array.isArray(body.missing) ? body.missing : [],
        score: typeof body.score === "number" ? body.score : 0,
        risk: typeof body.risk === "string" ? body.risk : "UNKNOWN",
      },
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    if (error instanceof AuthorizationError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    console.error(" DEAL ANALYSIS UPDATE ERROR:", error);

    return NextResponse.json(
      { error: "Failed to update analysis", details: error.message },
      { status: 500 }
    );
  }
}
