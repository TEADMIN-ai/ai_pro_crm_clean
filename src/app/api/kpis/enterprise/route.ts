export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { AuthorizationError, requireAuthorizedUser } from "@/lib/server/authz";
import { getEnterpriseKpiSnapshot } from "@/lib/kpis/enterpriseSnapshot";

function emptyPayload(error?: string, status = 500) {
  return NextResponse.json(
    {
      schemaVersion: "2026-07",
      generatedAt: new Date().toISOString(),
      dashboardSummary: {
        totalOpportunities: 0,
        readyForSubmission: 0,
        submitted: 0,
        blocked: 0,
        risk: 0,
        avgReadiness: 0,
        pipelineValue: 0,
        recent: [],
      },
      opportunities: { total: 0, rfq: 0, tender: 0, rfp: 0, rfi: 0, quotation: 0, unknown: 0, municipalities: 0, closingSoon: 0, overdue: 0, compulsoryBriefings: 0, boqRequired: 0, assigned: 0, unassigned: 0 },
      contractors: { total: 0, ready: 0, compliant: 0, assigned: 0, unassigned: 0, avgReadiness: 0 },
      clients: { total: 0, active: 0, inactive: 0, monthlyRevenue: 0 },
      drivers: { total: 0, activeAssignments: 0, collectionsToday: 0, collectionsThisWeek: 0 },
      collections: { total: 0, scheduled: 0, inProgress: 0, completed: 0, overdue: 0, dueThisWeek: 0 },
      compliance: { total: 0, valid: 0, expiringSoon: 0, expired: 0 },
      submissions: { total: 0, readyToSubmit: 0, submitted: 0, blocked: 0, avgReadiness: 0, conversionRate: 0 },
      revenue: { totalValue: 0, awardedValue: 0, submittedValue: 0, pipelineValue: 0, averageValue: 0 },
      documents: { total: 0, topLevel: 0, opportunityDocuments: 0, contractorDocuments: 0, uploadedToday: 0 },
      readiness: { averageScore: 0, ready: 0, atRisk: 0, notReady: 0 },
      ...(error ? { error } : {}),
    },
    { status },
  );
}

export async function GET(request: NextRequest) {
  try {
    const user = await requireAuthorizedUser(request);
    if (!user.workspaceId) return emptyPayload("Workspace context is required", 403);
    return NextResponse.json(await getEnterpriseKpiSnapshot({ workspaceId: user.workspaceId, actorRole: user.role }));
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return emptyPayload(error.message, error.status);
    }

    console.error("[enterprise-kpis] Failed to load snapshot", error);
    return emptyPayload("Enterprise KPIs unavailable", 500);
  }
}
