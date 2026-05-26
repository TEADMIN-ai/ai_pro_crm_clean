export type AgentOutputStatus = "success" | "warning" | "failed" | "partial";

export interface StandardAgentOutput {
  status: AgentOutputStatus;
  confidence: number;
  nextActions: string[];
  warnings: string[];
  structuredData: Record<string, unknown>;
  auditPayload: Record<string, unknown>;
}
