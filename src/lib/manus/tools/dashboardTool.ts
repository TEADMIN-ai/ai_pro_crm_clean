import { logActivity } from "@/lib/activity/logActivity";
import type { ManusContext, ToolExecutionResult } from "@/lib/manus/types/manus.types";
import { BaseTool } from "@/lib/manus/tools/baseTool";
import { assertToolAccess } from "@/lib/manus/utils/permissionGuard";

type DashboardToolInput = {
  workflowStatus: string;
  alertMessage?: string;
  auditMessage?: string;
};

export class DashboardTool extends BaseTool<DashboardToolInput, Record<string, unknown>> {
  readonly name = "dashboardTool";

  validate(input: DashboardToolInput, _context: ManusContext) {
    if (!input.workflowStatus.trim()) {
      throw new Error("workflowStatus is required");
    }
  }

  permissions(context: ManusContext) {
    assertToolAccess(context, this.name);
  }

  async execute(input: DashboardToolInput, context: ManusContext): Promise<ToolExecutionResult<Record<string, unknown>>> {
    this.validate(input, context);
    this.permissions(context);

    if (!context.dryRun && context.contractorId) {
      await logActivity({
        contractorId: context.contractorId,
        action: input.auditMessage ?? `Manus workflow ${input.workflowStatus}`,
        performedBy: context.actor.email ?? context.actor.uid,
      });
    }

    return {
      ok: true,
      toolName: this.name,
      data: {
        workflowStatus: input.workflowStatus,
        alertMessage: input.alertMessage ?? null,
      },
      warnings: context.contractorId ? [] : ["No contractorId supplied: activity feed update skipped"],
      audit: { workflowStatus: input.workflowStatus },
    };
  }
}
