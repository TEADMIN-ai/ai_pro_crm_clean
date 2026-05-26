import { BaseAgent } from "@/lib/manus/agents/baseAgent";
import { getManusFeatureFlags } from "@/lib/manus/config/featureFlags";
import { EmailTool } from "@/lib/manus/tools/emailTool";
import type { StandardAgentOutput } from "@/lib/manus/types/agentOutputs";
import type { AgentExecutionPayload, AgentExecutionResult } from "@/lib/manus/types/manus.types";

export class NotificationAgent extends BaseAgent<Record<string, unknown>> {
  readonly role = "notification_coordinator" as const;

  async execute(payload: AgentExecutionPayload): Promise<AgentExecutionResult<Record<string, unknown>, StandardAgentOutput>> {
    await this.validate(payload);

    const flags = getManusFeatureFlags();
    if (!flags.ENABLE_MANUS_NOTIFICATIONS) {
      const structuredData = {
        draft: null,
        whatsappDraft: null,
        adminAlertDraft: null,
      };
      const output: StandardAgentOutput = {
        status: "warning",
        confidence: 1,
        nextActions: ["Notifications remain draft-only until feature enablement"],
        warnings: ["Notification drafting is disabled by feature flag"],
        structuredData,
        auditPayload: { notificationsEnabled: false },
      };
      return {
        agentRole: this.role,
        ok: true,
        summary: "Notification drafting skipped by feature flag",
        nextAction: output.nextActions[0],
        warnings: output.warnings,
        data: structuredData,
        output,
      };
    }

    const emailTool = new EmailTool();
    const readinessStatus = typeof payload.input.readinessStatus === "string" ? payload.input.readinessStatus : "RISK";
    const missingDocuments = Array.isArray(payload.input.missingDocuments)
      ? payload.input.missingDocuments.filter((value): value is string => typeof value === "string")
      : [];

    const result = await emailTool.execute(
      {
        to: typeof payload.input.email === "string" ? payload.input.email : undefined,
        subject: `Tender readiness update: ${readinessStatus}`,
        summary:
          missingDocuments.length > 0
            ? `Current status: ${readinessStatus}. Missing documents: ${missingDocuments.join(", ")}.`
            : `Current status: ${readinessStatus}. No document gaps detected by Manus.`,
        approvalRequired: true,
      },
      payload.context
    );

    const structuredData = {
      ...(result.data ?? {}),
      whatsappDraft: {
        channel: "whatsapp",
        message:
          missingDocuments.length > 0
            ? `Tender status ${readinessStatus}. Missing: ${missingDocuments.join(", ")}. Manual approval required before sending.`
            : `Tender status ${readinessStatus}. Manual approval required before sending.`,
        sendEnabled: false,
      },
      adminAlertDraft: {
        channel: "internal",
        message: `Manual approval required for contractor communication on workflow ${payload.context.workflowId}.`,
      },
    };
    const output: StandardAgentOutput = {
      status: "success",
      confidence: 0.84,
      nextActions: ["Persist workflow result"],
      warnings: result.warnings,
      structuredData,
      auditPayload: {
        readinessStatus,
        missingDocumentCount: missingDocuments.length,
        sendEnabled: false,
      },
    };

    return {
      agentRole: this.role,
      ok: true,
      summary: "Notification draft prepared",
      nextAction: output.nextActions[0],
      warnings: output.warnings,
      data: structuredData,
      output,
    };
  }
}
