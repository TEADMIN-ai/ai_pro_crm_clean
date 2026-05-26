import { NextRequest, NextResponse } from "next/server";
import { getFirebaseAdmin } from "@/lib/firebase/admin";
import { AuthorizationError, assertCanAccessContractor, requireAuthorizedUser } from "@/lib/server/authz";

export const runtime = "nodejs";

function jsonError(message: string, status = 500) {
  return NextResponse.json({ error: message }, { status });
}

export async function GET(request: NextRequest) {
  try {
    const user = await requireAuthorizedUser(request);
    const workflowId = request.nextUrl.searchParams.get("workflowId");

    if (!workflowId) {
      return jsonError("workflowId is required", 400);
    }

    const snapshot = await getFirebaseAdmin().collection("manusWorkflows").doc(workflowId).get();
    if (!snapshot.exists) {
      return jsonError("Workflow not found", 404);
    }

    const data = snapshot.data() ?? {};
    const contractorId = typeof data.contractorId === "string" ? data.contractorId : undefined;

    if (contractorId) {
      assertCanAccessContractor(user, contractorId);
    }

    return NextResponse.json({
      workflowId: snapshot.id,
      ...data,
    });
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return jsonError(error.message, error.status);
    }

    return jsonError(error instanceof Error ? error.message : "Failed to fetch workflow status");
  }
}
