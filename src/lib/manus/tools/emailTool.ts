import type { ManusContext, ToolExecutionResult } from "@/lib/manus/types/manus.types";
import { BaseTool } from "@/lib/manus/tools/baseTool";
import { assertToolAccess } from "@/lib/manus/utils/permissionGuard";

type EmailDraftInput = {
  to?: string;
  subject: string;
  summary: string;
  approvalRequired?: boolean;
  channel?: "email" | "whatsapp";
};

export class EmailTool extends BaseTool<EmailDraftInput, Record<string, unknown>> {
  readonly name = "emailTool";

  validate(input: EmailDraftInput, _context: ManusContext) {
    if (!input.subject.trim()) {
      throw new Error("Email subject is required");
    }

    if (!input.summary.trim()) {
      throw new Error("Email summary is required");
    }
  }

  permissions(context: ManusContext) {
    assertToolAccess(context, this.name);
  }

  async execute(input: EmailDraftInput, context: ManusContext): Promise<ToolExecutionResult<Record<string, unknown>>> {
    this.validate(input, context);
    this.permissions(context);

    return {
      ok: true,
      toolName: this.name,
      data: {
        draft: {
          to: input.to ?? null,
          subject: input.subject,
          body: input.summary,
          approvalRequired: input.approvalRequired ?? true,
          channel: input.channel ?? "email",
          queued: false,
        },
      },
      warnings: ["Phase 1 draft-only mode: no live sending performed"],
      audit: { channel: input.channel ?? "email" },
    };
  }
}
