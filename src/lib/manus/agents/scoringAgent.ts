import { BaseAgent } from "@/lib/manus/agents/baseAgent";
import type { StandardAgentOutput } from "@/lib/manus/types/agentOutputs";
import type { AgentExecutionPayload, AgentExecutionResult } from "@/lib/manus/types/manus.types";

type ReadinessBand = "READY" | "RISK" | "BLOCKED";

function classifyReadiness(score: number, missingCount: number, expiredCount: number): ReadinessBand {
  if (expiredCount > 0 || score < 60 || missingCount > 2) {
    return "BLOCKED";
  }

  if (score < 80 || missingCount > 0) {
    return "RISK";
  }

  return "READY";
}

export class ScoringAgent extends BaseAgent<Record<string, unknown>> {
  readonly role = "scoring_engine" as const;

  async execute(payload: AgentExecutionPayload): Promise<AgentExecutionResult<Record<string, unknown>, StandardAgentOutput>> {
    await this.validate(payload);

    const readinessScore =
      typeof payload.input.readinessScore === "number" ? Math.max(0, Math.min(100, Math.round(payload.input.readinessScore))) : 0;
    const missingDocuments = Array.isArray(payload.input.missingDocuments)
      ? payload.input.missingDocuments.filter((value): value is string => typeof value === "string")
      : [];
    const expiredDocuments = Array.isArray(payload.input.expiredDocuments)
      ? payload.input.expiredDocuments.filter((value): value is string => typeof value === "string")
      : [];
    const readinessStatus = classifyReadiness(readinessScore, missingDocuments.length, expiredDocuments.length);
    const risk = readinessStatus === "READY" ? "LOW" : readinessStatus === "RISK" ? "MEDIUM" : "HIGH";
    const structuredData = {
      readinessScore,
      readinessStatus,
      risk,
      operationalRecommendations:
        readinessStatus === "READY"
          ? ["Proceed with human review and submission planning"]
          : readinessStatus === "RISK"
            ? ["Resolve flagged compliance gaps before submission"]
            : ["Do not proceed until mandatory requirements are resolved"],
    };
    const output: StandardAgentOutput = {
      status: readinessStatus === "READY" ? "success" : "warning",
      confidence: 0.91,
      nextActions: ["Update dashboard and prepare notification draft"],
      warnings: [],
      structuredData,
      auditPayload: {
        readinessScore,
        readinessStatus,
        risk,
      },
    };

    return {
      agentRole: this.role,
      ok: true,
      summary: `Readiness classified as ${readinessStatus}`,
      nextAction: output.nextActions[0],
      warnings: output.warnings,
      data: structuredData,
      output,
    };
  }
}
