import { getManusFeatureFlags } from "@/lib/manus/config/featureFlags";
import { manusConfig } from "@/lib/manus/config/manus.config";
import { ContextManager } from "@/lib/manus/context/contextManager";
import { manusLogger } from "@/lib/manus/logging/manusLogger";
import { recordReasoningTrace } from "@/lib/manus/logging/reasoningTrace";
import { appendWorkflowAudit, persistWorkflowSnapshot } from "@/lib/manus/logging/workflowAudit";
import { RecoveryExecutor } from "@/lib/manus/executors/recoveryExecutor";
import { RetryExecutor } from "@/lib/manus/executors/retryExecutor";
import { WorkflowStateManager } from "@/lib/manus/state/workflowStateManager";
import type {
  ManusContext,
  WorkflowDefinition,
  WorkflowExecutionResult,
  WorkflowState,
  WorkflowStep,
} from "@/lib/manus/types/manus.types";
import { serializeError } from "@/lib/manus/utils/safeExecution";
import { runWithTimeoutGuard } from "@/lib/manus/utils/timeoutGuard";

export class WorkflowExecutor {
  async execute(definition: WorkflowDefinition, context: ManusContext): Promise<WorkflowExecutionResult> {
    const flags = getManusFeatureFlags();
    if (!flags.ENABLE_MANUS_WORKFLOWS) {
      throw new Error("Manus workflows are disabled");
    }

    const stateManager = new WorkflowStateManager();
    const retryExecutor = new RetryExecutor();
    const recoveryExecutor = new RecoveryExecutor();
    const contextManager = new ContextManager();
    const state: WorkflowState = stateManager.create(
      definition.steps.map<WorkflowStep>((step) => ({
        id: step.id,
        title: step.title,
        actor: step.actor,
        status: "pending",
      }))
    );

    stateManager.setWorkflowStatus(state, "running");
    await persistWorkflowSnapshot(context, state);
    await appendWorkflowAudit(context, { type: "workflow_started", detail: { name: definition.name } });

    const completedRollbacks: Array<() => Promise<void>> = [];

    for (const stepDefinition of definition.steps) {
      const step = state.steps.find((item) => item.id === stepDefinition.id);
      if (!step) {
        continue;
      }

      const startedAt = Date.now();
      stateManager.markStep(state, step.id, {
        status: "running",
        startedAt: new Date(startedAt).toISOString(),
      });
      manusLogger.step(step, context);
      await appendWorkflowAudit(context, { type: "step_started", step });

      try {
        const execution = await retryExecutor.execute({
          maxRetries: manusConfig.workflows.maxRetries,
          stepId: step.id,
          onRetry: async (attempt, failureClass) => {
            stateManager.incrementRetry(state, step.id);
            stateManager.markStep(state, step.id, { retries: attempt });
            await appendWorkflowAudit(context, {
              type: "step_retry",
              step,
              detail: {
                attempt,
                failureClass,
              },
            });
          },
          run: () =>
            runWithTimeoutGuard(async (signal) => {
              const stepContext = { ...context, abortSignal: signal };
              return await stepDefinition.execute(stepContext, state);
            }, manusConfig.workflows.stepTimeoutMs),
        });

        const output = execution.value;
        stateManager.markStep(state, step.id, {
          status: "completed",
          completedAt: new Date().toISOString(),
          durationMs: Date.now() - startedAt,
          retries: execution.retriesUsed,
        });
        if (output) {
          const sanitizedOutput = contextManager.sanitizeAgentOutput(output);
          stateManager.markStep(state, step.id, {
            output: sanitizedOutput,
          });
          contextManager.setStructuredData(state, step.id, sanitizedOutput);
        }
        await recordReasoningTrace(context, {
          agentRole: step.actor,
          decision: `Step '${step.id}' completed`,
          warnings: step.warnings,
          payload: {
            retriesUsed: execution.retriesUsed,
            durationMs: Date.now() - startedAt,
          },
        });
        if (stepDefinition.rollback) {
          completedRollbacks.unshift(() => stepDefinition.rollback!(context, state));
        }
      } catch (error) {
        const serialized = serializeError(error);
        stateManager.markStep(state, step.id, {
          status: "failed",
          completedAt: new Date().toISOString(),
          durationMs: Date.now() - startedAt,
          error: serialized,
        });
        stateManager.appendError(state, serialized, step.id);
        manusLogger.error("workflow_step_failed", context, error, { stepId: step.id });

        const recovery = await recoveryExecutor.handleStepFailure({
          context,
          state,
          stepId: step.id,
          continueOnError: stepDefinition.continueOnError,
          error: serialized,
          rollbacks: completedRollbacks,
        });
        await recordReasoningTrace(context, {
          agentRole: step.actor,
          decision: recovery.summary,
          warnings: [serialized],
          payload: { stepId: step.id },
        });

        if (!recovery.continued) {
          stateManager.setWorkflowStatus(state, "failed", { stepId: step.id });
          break;
        }
      }

      await persistWorkflowSnapshot(context, {
        status: state.status,
        steps: state.steps,
        shared: state.shared,
        errors: state.errors,
        retryCount: state.retryCount,
        startedAt: state.startedAt,
        completedAt: state.completedAt,
      });
      await appendWorkflowAudit(context, { type: "step_finished", step });
    }

    if (state.status !== "failed") {
      stateManager.setWorkflowStatus(state, state.errors.length > 0 ? "partial_success" : "completed");
    }

    await persistWorkflowSnapshot(context, {
      status: state.status,
      steps: state.steps,
      shared: state.shared,
      errors: state.errors,
      retryCount: state.retryCount,
      startedAt: state.startedAt,
      completedAt: state.completedAt,
    });
    await appendWorkflowAudit(context, { type: "workflow_finished", detail: { status: state.status } });

    return {
      workflowId: context.workflowId,
      workflowType: context.workflowType,
      status: state.status,
      steps: state.steps,
      shared: state.shared,
      errors: state.errors,
      retryCount: state.retryCount,
      startedAt: state.startedAt,
      completedAt: state.completedAt,
    };
  }
}
