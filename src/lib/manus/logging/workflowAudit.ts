import { getFirebaseAdmin } from "@/lib/firebase/admin";
import type { ManusContext, WorkflowExecutionResult, WorkflowStep } from "@/lib/manus/types/manus.types";

const AUDIT_COLLECTION = "manusWorkflowAudit";
const WORKFLOW_COLLECTION = "manusWorkflows";

export async function persistWorkflowSnapshot(
  context: ManusContext,
  result: Pick<WorkflowExecutionResult, "status" | "steps" | "shared" | "errors" | "startedAt" | "completedAt" | "retryCount">
) {
  if (context.dryRun) {
    return;
  }

  await getFirebaseAdmin()
    .collection(WORKFLOW_COLLECTION)
    .doc(context.workflowId)
    .set(
      {
        workflowId: context.workflowId,
        workflowType: context.workflowType,
        contractorId: context.contractorId ?? null,
        dealId: context.dealId ?? null,
        actorUid: context.actor.uid,
        actorRole: context.actor.role,
        status: result.status,
        steps: result.steps,
        shared: result.shared,
        errors: result.errors,
        executionDurationMs:
          typeof result.startedAt === "string" && typeof result.completedAt === "string"
            ? new Date(result.completedAt).getTime() - new Date(result.startedAt).getTime()
            : null,
        retryCount: typeof result.retryCount === "number" ? result.retryCount : 0,
        contractorAccess: context.contractorId ?? null,
        updatedAt: new Date().toISOString(),
        createdAt: context.metadata.createdAt ?? new Date().toISOString(),
      },
      { merge: true }
    );
}

export async function appendWorkflowAudit(
  context: ManusContext,
  event: {
    type: string;
    step?: WorkflowStep;
    detail?: Record<string, unknown>;
  }
) {
  if (context.dryRun) {
    return;
  }

  await getFirebaseAdmin().collection(AUDIT_COLLECTION).add({
    workflowId: context.workflowId,
    workflowType: context.workflowType,
    contractorId: context.contractorId ?? null,
    dealId: context.dealId ?? null,
    actorUid: context.actor.uid,
    actorRole: context.actor.role,
    type: event.type,
    step: event.step ?? null,
    detail: event.detail ?? {},
    contractorAccess: context.contractorId ?? null,
    createdAt: new Date().toISOString(),
  });
}
