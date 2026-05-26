import { appendWorkflowAudit } from "@/lib/manus/logging/workflowAudit";
import type { ManusContext, WorkflowState } from "@/lib/manus/types/manus.types";

export class RecoveryExecutor {
  async handleStepFailure(options: {
    context: ManusContext;
    state: WorkflowState;
    stepId: string;
    continueOnError?: boolean;
    error: string;
    rollbacks: Array<() => Promise<void>>;
  }) {
    await appendWorkflowAudit(options.context, {
      type: "recovery_evaluated",
      detail: {
        stepId: options.stepId,
        continueOnError: Boolean(options.continueOnError),
        error: options.error,
      },
    });

    if (options.continueOnError) {
      return {
        continued: true,
        summary: `Step '${options.stepId}' failed but workflow continued`,
      };
    }

    for (const rollback of options.rollbacks) {
      await rollback();
    }

    return {
      continued: false,
      summary: `Workflow halted after '${options.stepId}' failure`,
    };
  }
}
