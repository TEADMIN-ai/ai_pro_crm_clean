import { manusConfig } from "@/lib/manus/config/manus.config";
import type { ManusContext, WorkflowStep } from "@/lib/manus/types/manus.types";

type LogLevel = "info" | "warn" | "error";

function sanitizeMeta(meta: Record<string, unknown>): Record<string, unknown> {
  const clone: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(meta)) {
    if (/text|content|document|buffer|prompt/i.test(key)) {
      clone[key] = "[redacted]";
      continue;
    }

    clone[key] = value;
  }

  return clone;
}

function emit(level: LogLevel, message: string, meta: Record<string, unknown>) {
  if (!manusConfig.logging.enabled) {
    return;
  }

  const payload = {
    scope: "manus",
    level,
    message,
    ...sanitizeMeta(meta),
    timestamp: new Date().toISOString(),
  };

  if (level === "error") {
    console.error(payload);
    return;
  }

  if (level === "warn") {
    console.warn(payload);
    return;
  }

  console.log(payload);
}

export const manusLogger = {
  info(message: string, context: ManusContext, meta: Record<string, unknown> = {}) {
    emit("info", message, {
      workflowId: context.workflowId,
      workflowType: context.workflowType,
      actorUid: context.actor.uid,
      actorRole: context.actor.role,
      contractorId: context.contractorId,
      dealId: context.dealId,
      requestId: context.requestId,
      ...meta,
    });
  },
  warn(message: string, context: ManusContext, meta: Record<string, unknown> = {}) {
    emit("warn", message, {
      workflowId: context.workflowId,
      workflowType: context.workflowType,
      actorUid: context.actor.uid,
      actorRole: context.actor.role,
      contractorId: context.contractorId,
      dealId: context.dealId,
      requestId: context.requestId,
      ...meta,
    });
  },
  error(message: string, context: ManusContext, error: unknown, meta: Record<string, unknown> = {}) {
    emit("error", message, {
      workflowId: context.workflowId,
      workflowType: context.workflowType,
      actorUid: context.actor.uid,
      actorRole: context.actor.role,
      contractorId: context.contractorId,
      dealId: context.dealId,
      requestId: context.requestId,
      error: error instanceof Error ? error.message : String(error),
      ...meta,
    });
  },
  step(step: WorkflowStep, context: ManusContext) {
    emit("info", "workflow_step", {
      workflowId: context.workflowId,
      stepId: step.id,
      stepTitle: step.title,
      status: step.status,
      actor: step.actor,
      durationMs: step.durationMs,
      contractorId: context.contractorId,
    });
  },
};
