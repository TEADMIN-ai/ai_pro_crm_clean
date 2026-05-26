import { BaseAgent } from "@/lib/manus/agents/baseAgent";
import { DashboardTool } from "@/lib/manus/tools/dashboardTool";
import type { StandardAgentOutput } from "@/lib/manus/types/agentOutputs";
import type { AgentExecutionPayload, AgentExecutionResult } from "@/lib/manus/types/manus.types";

export class DashboardAgent extends BaseAgent<Record<string, unknown>> {
  readonly role = "dashboard_operator" as const;

  async execute(payload: AgentExecutionPayload): Promise<AgentExecutionResult<Record<string, unknown>, StandardAgentOutput>> {
    await this.validate(payload);

    const dashboardTool = new DashboardTool();
    const workflowStatus = typeof payload.input.workflowStatus === "string" ? payload.input.workflowStatus : "running";
    const alerts = Array.isArray(payload.input.alerts)
      ? payload.input.alerts.filter((value): value is string => typeof value === "string")
      : [];
    const result = await dashboardTool.execute(
      {
        workflowStatus,
        alertMessage:
          typeof payload.input.alertMessage === "string"
            ? payload.input.alertMessage
            : alerts.length > 0
              ? alerts.join(" | ")
              : undefined,
        auditMessage: typeof payload.input.auditMessage === "string" ? payload.input.auditMessage : undefined,
      },
      payload.context
    );

    const structuredData = {
      ...(result.data ?? {}),
      alerts,
    };
    const output: StandardAgentOutput = {
      status: alerts.length > 0 ? "warning" : "success",
      confidence: 0.86,
      nextActions: ["Draft contractor notification"],
      warnings: result.warnings,
      structuredData,
      auditPayload: {
        workflowStatus,
        alertCount: alerts.length,
      },
    };

    return {
      agentRole: this.role,
      ok: true,
      summary: "Dashboard-compatible activity prepared",
      nextAction: output.nextActions[0],
      warnings: output.warnings,
      data: structuredData,
      output,
    };
  }
}
