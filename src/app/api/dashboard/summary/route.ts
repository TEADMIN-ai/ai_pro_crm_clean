export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const revalidate = 30;

import { NextRequest, NextResponse } from "next/server";
import { AuthorizationError, requireAuthorizedUser } from "@/lib/server/authz";
import { getFirebaseAdmin } from "@/lib/firebase/admin";
import { listDealsForUser } from "@/server/services/dealService";
import type { Deal } from "@/types/deal";

type DashboardRecentItem = {
  id: string;
  text: string;
  status?: string;
  updatedAt?: string | null;
};

function formatRecentText(status: string): string {
  if (status === "READY") {
    return "Deal is ready for submission";
  }

  if (status === "RISK") {
    return "Deal needs attention before submission";
  }

  if (status === "BLOCKED") {
    return "Deal is blocked pending requirements";
  }

  return "Deal activity recorded";
}

function normalizeUpdatedAt(value: unknown): string | null {
  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    return new Date(value).toISOString();
  }

  return null;
}

function normalizeDealSummary(deal: Deal) {
  const readinessScore =
    typeof deal.readinessScore === "number" && Number.isFinite(deal.readinessScore)
      ? Math.max(0, Math.min(100, deal.readinessScore))
      : 0;
  const status =
    deal.tenderLockStatus === "READY" || deal.tenderLockStatus === "RISK" || deal.tenderLockStatus === "BLOCKED"
      ? deal.tenderLockStatus
      : "BLOCKED";
  const submitted =
    deal.status === "submitted" ||
    deal.stage === "submitted";

  return {
    id: deal.id,
    readinessScore,
    status,
    submitted,
    updatedAt: normalizeUpdatedAt(deal.updatedAt),
  };
}

function emptySummary(error?: string, status = 500) {
  return NextResponse.json(
    {
      totalDeals: 0,
      readyDeals: 0,
      submitted: 0,
      blockedDeals: 0,
      riskDeals: 0,
      avgReadiness: 0,
      recent: [],
      ...(error ? { error } : {}),
    },
    { status },
  );
}

export async function GET(request: NextRequest) {
  try {
    const user = await requireAuthorizedUser(request);
    const db = getFirebaseAdmin();
    let usedFallback = false;

    if (user.role !== "contractor") {
      try {
        await db.collection("deals").orderBy("updatedAt", "desc").limit(1).get();
      } catch (error) {
        usedFallback = true;
        console.warn("[dashboard/summary] updatedAt ordering unavailable", error);
      }
    }

    const deals = (await listDealsForUser(user)).map(normalizeDealSummary);
    const sortedDeals = [...deals].sort((left, right) => {
      if (!left.updatedAt && !right.updatedAt) return 0;
      if (!left.updatedAt) return 1;
      if (!right.updatedAt) return -1;

      return new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime();
    });

    const totalDeals = sortedDeals.length;
    const readyDeals = sortedDeals.filter((deal) => deal.status === "READY").length;
    const submitted = sortedDeals.filter((deal) => deal.submitted).length;
    const blockedDeals = sortedDeals.filter((deal) => deal.status === "BLOCKED").length;
    const riskDeals = sortedDeals.filter((deal) => deal.status === "RISK").length;
    const avgReadiness =
      totalDeals > 0
        ? Math.max(
            0,
            Math.min(
              100,
              Math.round(sortedDeals.reduce((sum, deal) => sum + deal.readinessScore, 0) / totalDeals),
            ),
          )
        : 0;
    const recent: DashboardRecentItem[] = sortedDeals.slice(0, 5).map((deal) => ({
      id: deal.id,
      text: formatRecentText(deal.status),
      status: deal.status,
      updatedAt: deal.updatedAt,
    }));

    return NextResponse.json({
      totalDeals,
      readyDeals,
      submitted,
      blockedDeals,
      riskDeals,
      avgReadiness,
      recent,
      debug: {
        fallbackUsed: usedFallback,
        mode: "LIVE",
        role: user.role,
      },
    });
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return emptySummary(error.message, error.status);
    }

    console.error("[dashboard/summary] Failed to load live dashboard data", error);
    return emptySummary("Dashboard summary unavailable", 500);
  }
}
