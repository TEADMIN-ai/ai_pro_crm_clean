import { DashboardAgent } from "@/lib/manus/agents/dashboardAgent";
import { ContractorTool } from "@/lib/manus/tools/contractorTool";
import type { WorkflowDefinition } from "@/lib/manus/types/manus.types";

export function createOnboardingWorkflow(): WorkflowDefinition {
  const contractorTool = new ContractorTool();
  const dashboardAgent = new DashboardAgent();

  return {
    type: "onboarding",
    name: "Onboarding Workflow",
    steps: [
      {
        id: "load-contractor",
        title: "Load Contractor Profile",
        actor: "system",
        execute: async (context, state) => {
          if (!context.contractorId) {
            throw new Error("contractorId is required");
          }

          const result = await contractorTool.execute({ contractorId: context.contractorId }, context);
          state.shared.contractor = result.data;
          return result.data ?? {};
        },
      },
      {
        id: "dashboard-alert",
        title: "Create Onboarding Alert",
        actor: "dashboard_operator",
        continueOnError: true,
        execute: async (context, state) => {
          const result = await dashboardAgent.execute({
            agentRole: "dashboard_operator",
            objective: "Create onboarding workflow audit trail",
            input: {
              workflowStatus: "pending",
              auditMessage: "Manus onboarding workflow initialized",
            },
            context,
          });
          state.shared.dashboard = result.data;
          return result.data;
        },
      },
    ],
  };
}
