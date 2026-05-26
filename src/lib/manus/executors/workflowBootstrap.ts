import { getManusFeatureFlags } from "@/lib/manus/config/featureFlags";
import type { ManusContext, WorkflowExecutionPayload, WorkflowType } from "@/lib/manus/types/manus.types";
import type { AuthorizedUser } from "@/lib/server/authz";
import { canAccessContractor } from "@/lib/server/authz";

export interface WorkflowBootstrapResult {
  ok: boolean;
  status: number;
  code: string;
  message: string;
  context?: ManusContext;
}

function buildWorkflowContext(args: {
  actor: AuthorizedUser;
  workflowType: WorkflowType;
  contractorId?: string;
  dealId?: string;
  documentType?: string;
  dryRun?: boolean;
}): ManusContext {
  const workflowId = `manus-${crypto.randomUUID()}`;

  return {
    requestId: crypto.randomUUID(),
    workflowId,
    workflowType: args.workflowType,
    actor: args.actor,
    contractorId: args.contractorId,
    dealId: args.dealId,
    dryRun: args.dryRun ?? true,
    metadata: {
      createdAt: new Date().toISOString(),
      documentType: args.documentType ?? null,
      bootstrapValidated: true,
      featureFlags: getManusFeatureFlags(),
    },
  };
}

export function bootstrapWorkflow(args: {
  actor: AuthorizedUser;
  workflowType: WorkflowType;
  contractorId?: string;
  dealId?: string;
  documentType?: string;
  payload?: WorkflowExecutionPayload["input"] | Record<string, unknown>;
  dryRun?: boolean;
}): WorkflowBootstrapResult {
  try {
    const flags = getManusFeatureFlags();

    if (!flags.ENABLE_MANUS_WORKFLOWS) {
      return {
        ok: false,
        status: 503,
        code: "manus_disabled",
        message: "Manus workflows are disabled",
      };
    }

    if (args.workflowType === "tender" && !flags.ENABLE_MANUS_TENDER_FLOW) {
      return {
        ok: false,
        status: 503,
        code: "manus_tender_disabled",
        message: "Manus tender workflow is disabled",
      };
    }

    if (!args.actor?.uid || !args.actor.role) {
      return {
        ok: false,
        status: 401,
        code: "invalid_actor",
        message: "Missing authorized actor context",
      };
    }

    if (args.contractorId && !canAccessContractor(args.actor, args.contractorId)) {
      return {
        ok: false,
        status: 403,
        code: "contractor_access_denied",
        message: "Actor cannot access this contractor",
      };
    }

    if (!args.payload || typeof args.payload !== "object") {
      return {
        ok: false,
        status: 400,
        code: "invalid_payload",
        message: "Workflow payload is required",
      };
    }

    return {
      ok: true,
      status: 200,
      code: "ok",
      message: "Workflow bootstrap validated",
      context: buildWorkflowContext({
        actor: args.actor,
        workflowType: args.workflowType,
        contractorId: args.contractorId,
        dealId: args.dealId,
        documentType: args.documentType,
        dryRun: args.dryRun,
      }),
    };
  } catch (error) {
    return {
      ok: false,
      status: 500,
      code: "bootstrap_failed",
      message: error instanceof Error ? error.message : "Workflow bootstrap failed",
    };
  }
}
