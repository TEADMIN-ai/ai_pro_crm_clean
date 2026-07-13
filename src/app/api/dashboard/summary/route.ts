export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const revalidate = 30;

import { NextRequest, NextResponse } from "next/server";
import { AuthorizationError, requireAuthorizedUser } from "@/lib/server/authz";
import { getEnterpriseKpiSnapshot } from "@/lib/kpis/enterpriseSnapshot";

type DashboardRecentItem = {
  id: string;
  text: string;
  status?: string;
  updatedAt?: string | null;
};

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
    const snapshot = await getEnterpriseKpiSnapshot();

    return NextResponse.json({
      totalDeals: snapshot.dashboardSummary.totalOpportunities,
      readyDeals: snapshot.dashboardSummary.readyForSubmission,
      submitted: snapshot.dashboardSummary.submitted,
      blockedDeals: snapshot.dashboardSummary.blocked,
      riskDeals: snapshot.dashboardSummary.risk,
      avgReadiness: snapshot.dashboardSummary.avgReadiness,
      recent: snapshot.dashboardSummary.recent.map((item): DashboardRecentItem => ({
        id: item.id,
        text: item.text,
        status: item.status,
        updatedAt: item.updatedAt,
      })),
      debug: {
        mode: "LIVE",
        source: "enterpriseKpis",
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
