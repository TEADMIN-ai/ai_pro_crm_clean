import { computeAggregateComplianceScore, resolveComplianceExpiryAlert } from "@/lib/compliance/complianceScoring";
import type { ManusContext, ToolExecutionResult } from "@/lib/manus/types/manus.types";
import { BaseTool } from "@/lib/manus/tools/baseTool";
import { assertContractorIsolation, assertToolAccess } from "@/lib/manus/utils/permissionGuard";
import { listContractorDocuments } from "@/server/services/contractorService";

type ComplianceToolInput = {
  contractorId: string;
  requiredDocuments: string[];
};

export class ComplianceTool extends BaseTool<ComplianceToolInput, Record<string, unknown>> {
  readonly name = "complianceTool";

  validate(input: ComplianceToolInput, _context: ManusContext) {
    if (!input.contractorId.trim()) {
      throw new Error("contractorId is required");
    }
  }

  permissions(context: ManusContext) {
    assertToolAccess(context, this.name);
  }

  async execute(input: ComplianceToolInput, context: ManusContext): Promise<ToolExecutionResult<Record<string, unknown>>> {
    this.validate(input, context);
    this.permissions(context);
    assertContractorIsolation(context, input.contractorId);

    if (context.dryRun) {
      return {
        ok: true,
        toolName: this.name,
        data: {
          readinessScore: 0,
          missingDocuments: input.requiredDocuments,
          expiredDocuments: [],
          expiringDocuments: [],
          documentCount: 0,
        },
        warnings: ["Dry run enabled: compliance read skipped"],
        audit: { contractorId: input.contractorId, requiredDocuments: input.requiredDocuments.length, dryRun: true },
      };
    }

    const documents = await listContractorDocuments(input.contractorId);
    const normalizedDocs = new Set(
      documents.map((document) => (document.documentType ?? document.docType ?? "").toLowerCase()).filter(Boolean)
    );

    const missingDocuments = input.requiredDocuments.filter((doc) => !normalizedDocs.has(doc.toLowerCase()));
    const expiredDocuments = documents
      .filter((document) => resolveComplianceExpiryAlert(document.expiresAt).state === "expired")
      .map((document) => document.documentType ?? document.docType ?? "unknown");
    const expiringDocuments = documents
      .filter((document) => resolveComplianceExpiryAlert(document.expiresAt).state === "expiringSoon")
      .map((document) => document.documentType ?? document.docType ?? "unknown");
    const readinessScore = computeAggregateComplianceScore(documents);

    return {
      ok: true,
      toolName: this.name,
      data: {
        readinessScore,
        missingDocuments,
        expiredDocuments,
        expiringDocuments,
        documentCount: documents.length,
      },
      warnings: [],
      audit: { contractorId: input.contractorId, requiredDocuments: input.requiredDocuments.length },
    };
  }
}
