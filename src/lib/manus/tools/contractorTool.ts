import type { ManusContext, ToolExecutionResult } from "@/lib/manus/types/manus.types";
import { BaseTool } from "@/lib/manus/tools/baseTool";
import { assertContractorIsolation, assertToolAccess } from "@/lib/manus/utils/permissionGuard";
import { getContractorById, listContractorDocuments } from "@/server/services/contractorService";

type ContractorToolInput = {
  contractorId: string;
};

export class ContractorTool extends BaseTool<ContractorToolInput, Record<string, unknown>> {
  readonly name = "contractorTool";

  validate(input: ContractorToolInput, _context: ManusContext) {
    if (!input.contractorId.trim()) {
      throw new Error("contractorId is required");
    }
  }

  permissions(context: ManusContext) {
    assertToolAccess(context, this.name);
  }

  async execute(input: ContractorToolInput, context: ManusContext): Promise<ToolExecutionResult<Record<string, unknown>>> {
    this.validate(input, context);
    this.permissions(context);
    assertContractorIsolation(context, input.contractorId);

    if (context.dryRun) {
      return {
        ok: true,
        toolName: this.name,
        data: {
          contractor: { id: input.contractorId },
          documents: [],
        },
        warnings: ["Dry run enabled: contractor read skipped"],
        audit: { contractorId: input.contractorId, dryRun: true },
      };
    }

    const [contractor, documents] = await Promise.all([
      getContractorById(input.contractorId),
      listContractorDocuments(input.contractorId),
    ]);

    return {
      ok: true,
      toolName: this.name,
      data: {
        contractor,
        documents,
      },
      warnings: contractor ? [] : ["Contractor record not found"],
      audit: { contractorId: input.contractorId },
    };
  }
}
