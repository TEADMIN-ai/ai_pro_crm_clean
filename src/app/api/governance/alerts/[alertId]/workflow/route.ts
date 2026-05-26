import { NextRequest, NextResponse } from "next/server";
import type { GovernanceAlert, GovernanceAlertSeverity } from "@/lib/governance/alerts";
import {
  AuthorizationError,
  assertPrivilegedRole,
  requireAuthorizedUser,
} from "@/lib/server/authz";
import {
  acknowledgeGovernanceAlert,
  escalateGovernanceAlert,
  GOVERNANCE_WORKFLOW_STATES,
  markGovernanceInvestigating,
  resolveGovernanceAlert,
} from "@/lib/governance/workflows";

type RouteContext = {
  params: Promise<{ alertId: string }>;
};

type WorkflowAction = "acknowledge" | "investigating" | "escalate" | "resolve";
type GovernanceAlertType =
  | "repeated_stale_state_compensation"
  | "high_divergence_route_activity"
  | "canonical_correction_spike"
  | "governance_drift_concentration"
  | "noop_recompute_waste";

function isGovernanceAlertSeverity(value: unknown): value is GovernanceAlertSeverity {
  return value === "LOW" || value === "MODERATE" || value === "HIGH" || value === "CRITICAL";
}

function isGovernanceAlertType(value: unknown): value is GovernanceAlertType {
  return (
    value === "repeated_stale_state_compensation" ||
    value === "high_divergence_route_activity" ||
    value === "canonical_correction_spike" ||
    value === "governance_drift_concentration" ||
    value === "noop_recompute_waste"
  );
}

function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const user = await requireAuthorizedUser(request);
    assertPrivilegedRole(user);

    const { alertId } = await context.params;
    if (!alertId) {
      return jsonError("Alert ID is required", 400);
    }

    const payload = (await request.json().catch(() => null)) as
      | {
          action?: WorkflowAction;
          note?: string;
          alert?: {
            id?: string;
            alertType?: string;
            severity?: string;
            title?: string;
            summary?: string;
            sourceName?: string | null;
            routePath?: string | null;
            contractorId?: string | null;
            dealId?: string | null;
            routeClassification?: string | null;
            observedAt?: string;
            metrics?: Record<string, number | undefined>;
          };
        }
      | null;

    if (!payload?.action || !payload.alert || payload.alert.id !== alertId) {
      return jsonError("Invalid workflow payload", 400);
    }

    if (!isGovernanceAlertSeverity(payload.alert.severity)) {
      return jsonError("Invalid governance alert severity", 400);
    }

    if (!isGovernanceAlertType(payload.alert.alertType)) {
      return jsonError("Invalid governance alert type", 400);
    }

    const alert: GovernanceAlert = {
      id: payload.alert.id,
      alertType: payload.alert.alertType,
      severity: payload.alert.severity,
      title: typeof payload.alert.title === "string" ? payload.alert.title : payload.alert.alertType,
      summary: typeof payload.alert.summary === "string" ? payload.alert.summary : "",
      sourceName: typeof payload.alert.sourceName === "string" ? payload.alert.sourceName : null,
      routePath: typeof payload.alert.routePath === "string" ? payload.alert.routePath : null,
      contractorId: typeof payload.alert.contractorId === "string" ? payload.alert.contractorId : null,
      dealId: typeof payload.alert.dealId === "string" ? payload.alert.dealId : null,
      routeClassification:
        typeof payload.alert.routeClassification === "string" ? payload.alert.routeClassification : null,
      observedAt:
        typeof payload.alert.observedAt === "string"
          ? payload.alert.observedAt
          : new Date().toISOString(),
      metrics: payload.alert.metrics ?? {},
    };

    let workflow;
    switch (payload.action) {
      case "acknowledge":
        workflow = await acknowledgeGovernanceAlert({
          alert,
          user,
          note: payload.note ?? null,
        });
        break;
      case "investigating":
        workflow = await markGovernanceInvestigating({
          alert,
          user,
          note: payload.note ?? null,
        });
        break;
      case "escalate":
        workflow = await escalateGovernanceAlert({
          alert,
          user,
          note: payload.note ?? null,
        });
        break;
      case "resolve":
        workflow = await resolveGovernanceAlert({
          alert,
          user,
          note: payload.note ?? null,
        });
        break;
      default:
        return jsonError("Unsupported workflow action", 400);
    }

    return NextResponse.json(
      {
        success: true,
        workflow: {
          alertId: workflow.alertId,
          workflowState: workflow.workflowState,
          operatorId: workflow.operatorId,
          operatorEmail: workflow.operatorEmail,
          note: workflow.note,
          severitySnapshot: workflow.severitySnapshot,
          updatedAt: workflow.updatedAt,
          acknowledgedAt: workflow.acknowledgedAt,
          investigatingAt: workflow.investigatingAt,
          escalatedAt: workflow.escalatedAt,
          resolvedAt: workflow.resolvedAt,
        },
        availableStates: Object.values(GOVERNANCE_WORKFLOW_STATES),
      },
      { status: 200 }
    );
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return jsonError(error.message, error.status);
    }

    console.error("Governance workflow update failed", error);
    return jsonError("Failed to update governance workflow", 500);
  }
}
