import { NextRequest, NextResponse } from "next/server";
import { normalizeDocsMissingCount } from "@/lib/compliance/contractorCompliance";
import { resolveTenderLockStatus } from "@/lib/deals/normalizeDeal";
import { AuthorizationError, assertCanAccessContractor, assertOperationalRole, isPrivilegedRole, requireAuthorizedUser } from "@/lib/server/authz";
import { GuardianMonitor } from "@/lib/guardian/GuardianMonitor";
import { listDealsForUser } from "@/server/services/dealService";
import { getFirebaseAdmin } from "@/lib/firebase/admin";

function getString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function getNumber(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function buildDealPayload(body: Record<string, unknown>, contractorId: string) {
  const contractorName = getString(body.contractorName) || contractorId;
  const readinessScore = getNumber(body.readinessScore);
  const docsMissing = normalizeDocsMissingCount(body.docsMissing);

  return {
    title: getString(body.title) || "Untitled deal",
    contractorId,
    contractorName,
    companyId: contractorId,
    value: getNumber(body.value),
    status: body.status === "submitted" || body.status === "awarded" ? body.status : "draft",
    stage: typeof body.stage === "string" ? body.stage : "lead",
    readinessScore,
    docsMissing,
    tenderLockStatus: resolveTenderLockStatus(readinessScore, docsMissing, body.tenderLockStatus),
    isTenderLocked: body.isTenderLocked === true || docsMissing > 0 || readinessScore < 60,
    createdAt: body.createdAt ?? Date.now(),
    updatedAt: body.updatedAt ?? new Date(),
    readinessUpdatedAt:
      typeof body.readinessUpdatedAt === "string" && body.readinessUpdatedAt.trim().length > 0
        ? body.readinessUpdatedAt
        : new Date().toISOString(),
  };
}

export async function GET(request: NextRequest) {
  try {
    const user = await requireAuthorizedUser(request);
    if (user.role === "guest") {
      return NextResponse.json({ error: "unauthorized" }, { status: 403 });
    }

    const deals = await listDealsForUser(user);

    return NextResponse.json({ deals }, { status: 200 });
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    GuardianMonitor.error("api.deals.GET", "Failed to fetch deals", {
      error: error instanceof Error ? { name: error.name, message: error.message } : { value: String(error) },
    });
    console.error("Failed to fetch deals:", error);
    return NextResponse.json({ error: "Failed to fetch deals" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuthorizedUser(request);
    assertOperationalRole(user);

    const body = (await request.json()) as Record<string, unknown>;
    const requestedContractorId = getString(body.contractorId);
    const contractorId = user.role === "contractor" ? user.contractorId ?? "" : requestedContractorId;

    if (!contractorId) {
      return NextResponse.json({ error: "title and contractorId are required" }, { status: 400 });
    }

    assertCanAccessContractor(user, contractorId);

    const db = getFirebaseAdmin();
    const deal = buildDealPayload(body, contractorId);
    const docRef = await db.collection("deals").add(deal);

    return NextResponse.json({ deal: { id: docRef.id, ...deal } }, { status: 201 });
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    GuardianMonitor.error("api.deals.POST", "Failed to create deal", {
      error: error instanceof Error ? { name: error.name, message: error.message } : { value: String(error) },
    });
    console.error("Failed to create deal:", error);
    return NextResponse.json({ error: "Failed to create deal" }, { status: 500 });
  }
}
