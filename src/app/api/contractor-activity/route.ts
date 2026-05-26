import { NextRequest, NextResponse } from "next/server";
import { AuthorizationError, assertCanAccessContractor, requireAuthorizedUser } from "@/lib/server/authz";
import { getFirebaseAdmin } from "@/lib/firebase/admin";

type ActivityRecord = {
  contractorId?: unknown;
  action?: unknown;
  performedBy?: unknown;
  timestamp?: unknown;
};

function toIsoString(value: unknown): string | null {
  if (value instanceof Date) {
    return value.toISOString();
  }

  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Date.parse(value);
    return Number.isNaN(parsed) ? value : new Date(parsed).toISOString();
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    return new Date(value).toISOString();
  }

  if (value && typeof value === "object" && "toDate" in value && typeof value.toDate === "function") {
    return value.toDate().toISOString();
  }

  return null;
}

function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

export async function GET(request: NextRequest) {
  try {
    const user = await requireAuthorizedUser(request);
    const contractorId = request.nextUrl.searchParams.get("contractorId")?.trim() ?? "";

    if (!contractorId) {
      return jsonError("contractorId is required", 400);
    }

    assertCanAccessContractor(user, contractorId);

    const snapshot = await getFirebaseAdmin()
      .collection("contractorActivity")
      .where("contractorId", "==", contractorId)
      .orderBy("timestamp", "desc")
      .get();

    const activity = snapshot.docs.map((doc) => {
      const data = (doc.data() ?? {}) as ActivityRecord;

      return {
        id: doc.id,
        contractorId: typeof data.contractorId === "string" ? data.contractorId : "",
        action: typeof data.action === "string" ? data.action : "Activity",
        performedBy: typeof data.performedBy === "string" ? data.performedBy : "system",
        timestamp: toIsoString(data.timestamp),
      };
    });

    return NextResponse.json(activity);
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return jsonError(error.message, error.status);
    }

    console.error("Contractor activity fetch failed:", error);
    return jsonError("Failed to fetch contractor activity", 500);
  }
}
