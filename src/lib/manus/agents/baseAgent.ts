import type { AgentExecutionPayload, AgentExecutionResult, AgentRole } from "@/lib/manus/types/manus.types";
import { validateAgentPayload } from "@/lib/manus/utils/workflowValidator";

export abstract class BaseAgent<TData extends Record<string, unknown>> {
  abstract readonly role: AgentRole;

  async think(payload: AgentExecutionPayload): Promise<string[]> {
    validateAgentPayload(payload);
    return [`Analyze objective: ${payload.objective}`, "Return only workflow-safe structured output"];
  }

  abstract execute(payload: AgentExecutionPayload): Promise<AgentExecutionResult<TData>>;

  async validate(payload: AgentExecutionPayload): Promise<void> {
    validateAgentPayload(payload);
  }

  summarize(result: AgentExecutionResult<TData>): string {
    return result.summary;
  }

  nextAction(result: AgentExecutionResult<TData>): string | undefined {
    return result.nextAction;
  }
}
