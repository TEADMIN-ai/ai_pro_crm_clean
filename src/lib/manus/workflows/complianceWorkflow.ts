import { ComplianceAgent } from "@/lib/manus/agents/complianceAgent";
import { FirestoreTool } from "@/lib/manus/tools/firestoreTool";
import type { WorkflowDefinition } from "@/lib/manus/types/manus.types";

export function createComplianceWorkflow(requiredDocuments: string[]): WorkflowDefinition {
  const complianceAgent = new ComplianceAgent();
  const firestoreTool = new FirestoreTool();

  return {
    type: "compliance",
    name: "Compliance Workflow",
    steps: [
      {
        id: "compliance-validation",
        title: "Validate Compliance",
        actor: "compliance_officer",
        execute: async (context, state) => {
          const result = await complianceAgent.execute({
            agentRole: "compliance_officer",
            objective: "Evaluate contractor compliance readiness",
            input: { contractorId: context.contractorId, requiredDocuments },
            context,
          });
          state.shared.compliance = result.data;
          return result.data;
        },
      },
      {
        id: "save-results",
        title: "Save Compliance Results",
        actor: "system",
        execute: async (context, state) => {
          await firestoreTool.execute(
            {
              mode: "write",
              collection: "manusWorkflows",
              docId: context.workflowId,
              contractorId: context.contractorId,
              data: {
                compliance: state.shared.compliance ?? {},
              },
            },
            context
          );
          return { saved: true };
        },
      },
    ],
  };
}
