import type { ManusContext, WorkflowState } from "@/lib/manus/types/manus.types";

function sanitizeValue(value: unknown): unknown {
  if (typeof value === "string") {
    if (value.length > 4000) {
      return `${value.slice(0, 4000)}...[truncated]`;
    }
    return value;
  }

  if (Array.isArray(value)) {
    return value.slice(0, 50).map((item) => sanitizeValue(item));
  }

  if (value && typeof value === "object") {
    const source = value as Record<string, unknown>;
    const sanitized: Record<string, unknown> = {};

    for (const [key, entry] of Object.entries(source)) {
      sanitized[key] = /text|prompt|document|buffer|content/i.test(key) ? "[redacted]" : sanitizeValue(entry);
    }

    return sanitized;
  }

  return value;
}

export class ContextManager {
  assertOwnership(context: ManusContext, contractorId?: string) {
    if (!contractorId || context.actor.role !== "contractor") {
      return;
    }

    if (!context.actor.contractorId || context.actor.contractorId !== contractorId) {
      throw new Error("Cross-contractor context access rejected");
    }
  }

  sanitizeAgentOutput(output: Record<string, unknown>): Record<string, unknown> {
    return sanitizeValue(output) as Record<string, unknown>;
  }

  getStructuredData<T extends Record<string, unknown>>(state: WorkflowState, key: string): T {
    const value = state.shared[key];
    if (!value || typeof value !== "object") {
      throw new Error(`Missing required workflow context '${key}'`);
    }
    return value as T;
  }

  setStructuredData(state: WorkflowState, key: string, output: Record<string, unknown>) {
    state.shared[key] = this.sanitizeAgentOutput(output);
  }
}
