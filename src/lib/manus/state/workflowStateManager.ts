import type { WorkflowState, WorkflowStatus, WorkflowStep } from "@/lib/manus/types/manus.types";

export class WorkflowStateManager {
  create(steps: WorkflowStep[]): WorkflowState {
    return {
      status: "queued",
      steps,
      shared: {},
      errors: [],
      retryCount: 0,
      history: [
        {
          type: "workflow_created",
          timestamp: new Date().toISOString(),
        },
      ],
      startedAt: new Date().toISOString(),
    };
  }

  setWorkflowStatus(state: WorkflowState, status: WorkflowStatus, detail?: Record<string, unknown>) {
    state.status = status;
    if (status === "completed" || status === "failed" || status === "cancelled" || status === "partial_success") {
      state.completedAt = new Date().toISOString();
    }
    state.history.push({
      type: "workflow_status_changed",
      timestamp: new Date().toISOString(),
      detail: {
        status,
        ...detail,
      },
    });
  }

  markStep(state: WorkflowState, stepId: string, patch: Partial<WorkflowStep>) {
    const step = state.steps.find((item) => item.id === stepId);
    if (!step) {
      return;
    }

    Object.assign(step, patch);
    state.currentStepId = stepId;
    state.history.push({
      type: "step_updated",
      stepId,
      timestamp: new Date().toISOString(),
      detail: {
        status: patch.status,
        retries: patch.retries,
      },
    });
  }

  incrementRetry(state: WorkflowState, stepId?: string) {
    state.retryCount += 1;
    state.history.push({
      type: "retry_registered",
      stepId,
      timestamp: new Date().toISOString(),
      detail: {
        retryCount: state.retryCount,
      },
    });
  }

  appendError(state: WorkflowState, error: string, stepId?: string) {
    state.errors.push(error);
    state.history.push({
      type: "error_recorded",
      stepId,
      timestamp: new Date().toISOString(),
      detail: { error },
    });
  }
}
