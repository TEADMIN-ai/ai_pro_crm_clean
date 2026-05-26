import type { AgentExecutionPayload, WorkflowExecutionPayload } from "@/lib/manus/types/manus.types";

export function validateWorkflowPayload(payload: WorkflowExecutionPayload) {
  if (!payload.workflowType) {
    throw new Error("workflowType is required");
  }

  if (!payload.input || typeof payload.input !== "object") {
    throw new Error("input payload is required");
  }

  if (payload.contractorId !== undefined && payload.contractorId.trim().length === 0) {
    throw new Error("contractorId cannot be blank");
  }

  if (payload.dealId !== undefined && payload.dealId.trim().length === 0) {
    throw new Error("dealId cannot be blank");
  }
}

export function validateAgentPayload(payload: AgentExecutionPayload) {
  if (!payload.objective.trim()) {
    throw new Error("Agent objective is required");
  }

  if (!payload.context.workflowId.trim()) {
    throw new Error("workflowId is required");
  }
}
