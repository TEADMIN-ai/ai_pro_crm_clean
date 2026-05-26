import { BaseAgent } from "@/lib/manus/agents/baseAgent";
import { ComplianceTool } from "@/lib/manus/tools/complianceTool";
import type { StandardAgentOutput } from "@/lib/manus/types/agentOutputs";
import type { AgentExecutionPayload, AgentExecutionResult } from "@/lib/manus/types/manus.types";

export class ComplianceAgent extends BaseAgent<Record<string, unknown>> {
  readonly role = "compliance_officer" as const;

  async execute(payload: AgentExecutionPayload): Promise<AgentExecutionResult<Record<string, unknown>, StandardAgentOutput>> {
    await this.validate(payload);

    const contractorId = typeof payload.input.contractorId === "string" ? payload.input.contractorId : payload.context.contractorId;
    if (!contractorId) {
      throw new Error("ComplianceAgent requires contractorId");
    }

    const requiredDocuments = Array.isArray(payload.input.requiredDocuments)
      ? payload.input.requiredDocuments.filter((value): value is string => typeof value === "string")
      : [];
    const complianceTool = new ComplianceTool();
    const result = await complianceTool.execute({ contractorId, requiredDocuments }, payload.context);
    const structuredData = result.data ?? {};
    const output: StandardAgentOutput = {
      status: Array.isArray(structuredData.missingDocuments) && structuredData.missingDocuments.length > 0 ? "warning" : "success",
      confidence: 0.88,
      nextActions: ["Calculate readiness classification"],
      warnings: result.warnings,
      structuredData,
      auditPayload: {
        documentCount: structuredData.documentCount ?? 0,
        missingDocuments: Array.isArray(structuredData.missingDocuments) ? structuredData.missingDocuments.length : 0,
      },
    };

    return {
      agentRole: this.role,
      ok: true,
      summary: `Compliance checked across ${result.data?.documentCount ?? 0} document(s)`,
      nextAction: output.nextActions[0],
      warnings: result.warnings,
      data: structuredData,
      output,
    };
  }
}
