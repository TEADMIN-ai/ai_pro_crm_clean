export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { assertPrivilegedRole, AuthorizationError, requireAuthorizedUser } from "@/lib/server/authz";
import { runVehicleFinanceTrainingValidation } from "@/lib/vehicle-finance/training";

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuthorizedUser(request);
    assertPrivilegedRole(user);

    const body = (await request.json().catch(() => null)) as { documentId?: string } | null;
    const documentId = typeof body?.documentId === "string" && body.documentId.trim().length > 0 ? body.documentId.trim() : undefined;
    const summary = await runVehicleFinanceTrainingValidation(documentId);

    return NextResponse.json(summary);
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    console.error("[vehicle-finance-training] validation run failed", error);
    return NextResponse.json({ error: "Vehicle finance training validation failed" }, { status: 500 });
  }
}

