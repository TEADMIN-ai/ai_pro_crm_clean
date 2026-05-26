import { getFirebaseAdmin } from "@/lib/firebase/admin";
import type { AuthorizedUser } from "@/lib/server/authz";
import { emitGovernanceEvent } from "@/lib/governance/emitter";
import { GOVERNANCE_COLLECTIONS, encodeFirestoreId } from "@/lib/governance/storage";
import type { GovernanceAlert, GovernanceAlertSeverity } from "@/lib/governance/alerts";

export const GOVERNANCE_WORKFLOW_STATES = {
  NEW: "NEW",
  ACKNOWLEDGED: "ACKNOWLEDGED",
  INVESTIGATING: "INVESTIGATING",
  ESCALATED: "ESCALATED",
  RESOLVED: "RESOLVED",
} as const;

export type GovernanceWorkflowState =
  (typeof GOVERNANCE_WORKFLOW_STATES)[keyof typeof GOVERNANCE_WORKFLOW_STATES];

export type GovernanceWorkflowTransition = {
  fromState: GovernanceWorkflowState | null;
  toState: GovernanceWorkflowState;
  operatorId: string;
  operatorEmail: string | null;
  at: string;
  note: string | null;
  severitySnapshot: GovernanceAlertSeverity | null;
};

export type GovernanceWorkflowRecord = {
  alertId: string;
  workflowState: GovernanceWorkflowState;
  operatorId: string | null;
  operatorEmail: string | null;
  note: string | null;
  severitySnapshot: GovernanceAlertSeverity | null;
  createdAt: string;
  updatedAt: string;
  acknowledgedAt: string | null;
  investigatingAt: string | null;
  escalatedAt: string | null;
  resolvedAt: string | null;
  history: GovernanceWorkflowTransition[];
};

export type GovernanceAlertWithWorkflow = GovernanceAlert & {
  workflow: GovernanceWorkflowRecord;
};

const MAX_WORKFLOW_HISTORY = 12;

function nowIso(): string {
  return new Date().toISOString();
}

function createDefaultWorkflowRecord(alertId: string, severity: GovernanceAlertSeverity): GovernanceWorkflowRecord {
  const timestamp = nowIso();

  return {
    alertId,
    workflowState: GOVERNANCE_WORKFLOW_STATES.NEW,
    operatorId: null,
    operatorEmail: null,
    note: null,
    severitySnapshot: severity,
    createdAt: timestamp,
    updatedAt: timestamp,
    acknowledgedAt: null,
    investigatingAt: null,
    escalatedAt: null,
    resolvedAt: null,
    history: [],
  };
}

function normalizeWorkflowRecord(
  alertId: string,
  severity: GovernanceAlertSeverity,
  source: Record<string, unknown> | undefined
): GovernanceWorkflowRecord {
  const fallback = createDefaultWorkflowRecord(alertId, severity);

  const history = Array.isArray(source?.history)
    ? source.history
        .filter((entry): entry is GovernanceWorkflowTransition => Boolean(entry && typeof entry === "object"))
        .map((entry) => {
          const record = entry as Record<string, unknown>;
          return {
            fromState:
              typeof record.fromState === "string"
                ? (record.fromState as GovernanceWorkflowState)
                : null,
            toState:
              typeof record.toState === "string"
                ? (record.toState as GovernanceWorkflowState)
                : GOVERNANCE_WORKFLOW_STATES.NEW,
            operatorId: typeof record.operatorId === "string" ? record.operatorId : "",
            operatorEmail: typeof record.operatorEmail === "string" ? record.operatorEmail : null,
            at: typeof record.at === "string" ? record.at : fallback.updatedAt,
            note: typeof record.note === "string" ? record.note : null,
            severitySnapshot:
              typeof record.severitySnapshot === "string"
                ? (record.severitySnapshot as GovernanceAlertSeverity)
                : null,
          };
        })
        .slice(0, MAX_WORKFLOW_HISTORY)
    : [];

  return {
    alertId,
    workflowState:
      typeof source?.workflowState === "string"
        ? (source.workflowState as GovernanceWorkflowState)
        : fallback.workflowState,
    operatorId: typeof source?.operatorId === "string" ? source.operatorId : null,
    operatorEmail: typeof source?.operatorEmail === "string" ? source.operatorEmail : null,
    note: typeof source?.note === "string" ? source.note : null,
    severitySnapshot:
      typeof source?.severitySnapshot === "string"
        ? (source.severitySnapshot as GovernanceAlertSeverity)
        : severity,
    createdAt: typeof source?.createdAt === "string" ? source.createdAt : fallback.createdAt,
    updatedAt: typeof source?.updatedAt === "string" ? source.updatedAt : fallback.updatedAt,
    acknowledgedAt: typeof source?.acknowledgedAt === "string" ? source.acknowledgedAt : null,
    investigatingAt: typeof source?.investigatingAt === "string" ? source.investigatingAt : null,
    escalatedAt: typeof source?.escalatedAt === "string" ? source.escalatedAt : null,
    resolvedAt: typeof source?.resolvedAt === "string" ? source.resolvedAt : null,
    history,
  };
}

async function updateGovernanceWorkflow(params: {
  alert: GovernanceAlert;
  user: AuthorizedUser;
  nextState: GovernanceWorkflowState;
  note?: string | null;
}) {
  const db = getFirebaseAdmin();
  const workflowRef = db
    .collection(GOVERNANCE_COLLECTIONS.WORKFLOW_STATE)
    .doc(encodeFirestoreId(params.alert.id));
  const alertRef = db
    .collection(GOVERNANCE_COLLECTIONS.ALERTS)
    .doc(encodeFirestoreId(params.alert.id));

  const snapshot = await workflowRef.get();
  const current = normalizeWorkflowRecord(
    params.alert.id,
    params.alert.severity,
    snapshot.exists ? (snapshot.data() as Record<string, unknown>) : undefined
  );

  const timestamp = nowIso();
  const transition: GovernanceWorkflowTransition = {
    fromState: current.workflowState,
    toState: params.nextState,
    operatorId: params.user.uid,
    operatorEmail: params.user.email?.trim() || null,
    at: timestamp,
    note: params.note?.trim() || null,
    severitySnapshot: params.alert.severity,
  };

  const nextRecord: GovernanceWorkflowRecord = {
    ...current,
    workflowState: params.nextState,
    operatorId: params.user.uid,
    operatorEmail: params.user.email?.trim() || null,
    note: params.note?.trim() || null,
    severitySnapshot: params.alert.severity,
    updatedAt: timestamp,
    acknowledgedAt:
      params.nextState === GOVERNANCE_WORKFLOW_STATES.ACKNOWLEDGED
        ? timestamp
        : current.acknowledgedAt,
    investigatingAt:
      params.nextState === GOVERNANCE_WORKFLOW_STATES.INVESTIGATING
        ? timestamp
        : current.investigatingAt,
    escalatedAt:
      params.nextState === GOVERNANCE_WORKFLOW_STATES.ESCALATED
        ? timestamp
        : current.escalatedAt,
    resolvedAt:
      params.nextState === GOVERNANCE_WORKFLOW_STATES.RESOLVED
        ? timestamp
        : current.resolvedAt,
    history: [transition, ...current.history].slice(0, MAX_WORKFLOW_HISTORY),
  };

  await workflowRef.set(nextRecord, { merge: true });
  await alertRef.set(
    {
      workflowState: nextRecord.workflowState,
      workflowUpdatedAt: nextRecord.updatedAt,
      workflowOperatorId: nextRecord.operatorId,
      workflowOperatorEmail: nextRecord.operatorEmail,
      workflowNote: nextRecord.note,
      workflowSeveritySnapshot: nextRecord.severitySnapshot,
    },
    { merge: true }
  );

  emitGovernanceEvent({
    eventId: crypto.randomUUID(),
    eventVersion: "v1",
    occurredAt: timestamp,
    category: "governance_alert",
    eventType: "governance_alert_workflow_updated",
    correlation: {
      correlationId: `governance-workflow:${params.alert.id}`,
      requestId: `governance-workflow:${params.alert.id}:${timestamp}`,
    },
    actor: {
      actorId: params.user.uid,
      actorEmail: params.user.email?.trim() || null,
      actorRole: params.user.role,
    },
    source: {
      sourceType: "service",
      sourceName: "governance_workflows",
      routePath: params.alert.routePath ?? null,
      method: "PATCH",
      sourceClassification: null,
    },
    entity: {
      entityType: params.alert.dealId ? "deal" : params.alert.contractorId ? "contractor" : "telemetry",
      entityId: params.alert.dealId ?? params.alert.contractorId ?? params.alert.id,
      contractorId: params.alert.contractorId ?? null,
      dealId: params.alert.dealId ?? null,
    },
    mutation: {
      mutatedFields: ["workflowState", "workflowUpdatedAt", "workflowOperatorId", "workflowOperatorEmail", "workflowNote"],
    },
    governance: {
      failOpen: true,
    },
    analytics: {
      counterName: "governance_workflow_transition",
      counterValue: 1,
      eventCategory: "governance_alert",
      summaryType: "activity",
      aggregationKey: `${params.alert.id}:${params.nextState}`,
      aggregatedAt: timestamp,
    },
  });

  return nextRecord;
}

export async function acknowledgeGovernanceAlert(params: {
  alert: GovernanceAlert;
  user: AuthorizedUser;
  note?: string | null;
}) {
  return updateGovernanceWorkflow({
    ...params,
    nextState: GOVERNANCE_WORKFLOW_STATES.ACKNOWLEDGED,
  });
}

export async function markGovernanceInvestigating(params: {
  alert: GovernanceAlert;
  user: AuthorizedUser;
  note?: string | null;
}) {
  return updateGovernanceWorkflow({
    ...params,
    nextState: GOVERNANCE_WORKFLOW_STATES.INVESTIGATING,
  });
}

export async function escalateGovernanceAlert(params: {
  alert: GovernanceAlert;
  user: AuthorizedUser;
  note?: string | null;
}) {
  return updateGovernanceWorkflow({
    ...params,
    nextState: GOVERNANCE_WORKFLOW_STATES.ESCALATED,
  });
}

export async function resolveGovernanceAlert(params: {
  alert: GovernanceAlert;
  user: AuthorizedUser;
  note?: string | null;
}) {
  return updateGovernanceWorkflow({
    ...params,
    nextState: GOVERNANCE_WORKFLOW_STATES.RESOLVED,
  });
}

export async function getGovernanceWorkflowState(alertId: string, severity: GovernanceAlertSeverity) {
  const snapshot = await getFirebaseAdmin()
    .collection(GOVERNANCE_COLLECTIONS.WORKFLOW_STATE)
    .doc(encodeFirestoreId(alertId))
    .get();

  return normalizeWorkflowRecord(
    alertId,
    severity,
    snapshot.exists ? (snapshot.data() as Record<string, unknown>) : undefined
  );
}

export async function hydrateGovernanceAlertsWithWorkflow(
  alerts: GovernanceAlert[]
): Promise<GovernanceAlertWithWorkflow[]> {
  return Promise.all(
    alerts.map(async (alert) => ({
      ...alert,
      workflow: await getGovernanceWorkflowState(alert.id, alert.severity),
    }))
  );
}
