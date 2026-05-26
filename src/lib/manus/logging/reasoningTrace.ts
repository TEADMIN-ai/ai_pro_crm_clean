import { getFirebaseAdmin } from "@/lib/firebase/admin";
import type { AgentRole, ManusContext } from "@/lib/manus/types/manus.types";

function sanitizeTraceValue(value: unknown): unknown {
  if (typeof value === "string" && value.length > 600) {
    return `${value.slice(0, 600)}...[truncated]`;
  }

  if (Array.isArray(value)) {
    return value.slice(0, 20).map((item) => sanitizeTraceValue(item));
  }

  if (value && typeof value === "object") {
    const source = value as Record<string, unknown>;
    const sanitized: Record<string, unknown> = {};

    for (const [key, entry] of Object.entries(source)) {
      sanitized[key] = /text|document|buffer|prompt|content/i.test(key) ? "[redacted]" : sanitizeTraceValue(entry);
    }

    return sanitized;
  }

  return value;
}

export async function recordReasoningTrace(
  context: ManusContext,
  trace: {
    agentRole?: AgentRole | "system";
    decision: string;
    warnings?: string[];
    payload?: Record<string, unknown>;
  }
) {
  if (context.dryRun) {
    return;
  }

  await getFirebaseAdmin().collection("manusReasoningTrace").add({
    workflowId: context.workflowId,
    workflowType: context.workflowType,
    contractorId: context.contractorId ?? null,
    dealId: context.dealId ?? null,
    agentRole: trace.agentRole ?? "system",
    decision: trace.decision,
    warnings: trace.warnings ?? [],
    payload: sanitizeTraceValue(trace.payload ?? {}),
    createdAt: new Date().toISOString(),
  });
}
