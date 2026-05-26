import { randomUUID } from "crypto";
import { ComplianceAgent } from "@/lib/manus/agents/complianceAgent";
import { DashboardAgent } from "@/lib/manus/agents/dashboardAgent";
import { NotificationAgent } from "@/lib/manus/agents/notificationAgent";
import { ScoringAgent } from "@/lib/manus/agents/scoringAgent";
import { TenderAgent } from "@/lib/manus/agents/tenderAgent";
import { getManusFeatureFlags } from "@/lib/manus/config/featureFlags";
import { ContextManager } from "@/lib/manus/context/contextManager";
import { recordReasoningTrace } from "@/lib/manus/logging/reasoningTrace";
import { ContractorMemoryStore } from "@/lib/manus/memory/contractorMemory";
import { ContractorTool } from "@/lib/manus/tools/contractorTool";
import { FirestoreTool } from "@/lib/manus/tools/firestoreTool";
import type { ManusContext, WorkflowDefinition } from "@/lib/manus/types/manus.types";

export function createTenderWorkflow(documentBuffer: Buffer): WorkflowDefinition {
  const flags = getManusFeatureFlags();
  const tenderAgent = new TenderAgent();
  const contractorTool = new ContractorTool();
  const complianceAgent = new ComplianceAgent();
  const scoringAgent = new ScoringAgent();
  const dashboardAgent = new DashboardAgent();
  const notificationAgent = new NotificationAgent();
  const firestoreTool = new FirestoreTool();
  const memoryStore = new ContractorMemoryStore();
  const contextManager = new ContextManager();

  return {
    type: "tender",
    name: "Tender Workflow",
    steps: [
      {
        id: "tender-upload",
        title: "Tender Upload",
        actor: "system",
        execute: async () => ({ uploadAccepted: true, informationalOnly: true }),
      },
      {
        id: "manus-workflow-start",
        title: "Manus Workflow Start",
        actor: "system",
        execute: async (context, state) => {
          if (!context.contractorId) {
            throw new Error("contractorId is required for tender workflow");
          }

          contextManager.assertOwnership(context, context.contractorId);
          const contractor = await contractorTool.execute({ contractorId: context.contractorId }, context);
          contextManager.setStructuredData(state, "contractor", contractor.data ?? {});
          return {
            contractorLoaded: true,
            informationalOnly: true,
          };
        },
      },
      {
        id: "tender-agent",
        title: "Tender Agent",
        actor: "tender_analyst",
        execute: async (context, state) => {
          const result = await tenderAgent.execute({
            agentRole: "tender_analyst",
            objective: "Analyze uploaded tender document",
            input: { documentBuffer, documentType: context.metadata.documentType },
            context,
          });
          contextManager.setStructuredData(state, "tenderAnalysis", result.output.structuredData);
          await recordReasoningTrace(context, {
            agentRole: "tender_analyst",
            decision: result.summary,
            warnings: result.output.warnings,
            payload: result.output.auditPayload,
          });
          return result.output.structuredData;
        },
      },
      {
        id: "compliance-agent",
        title: "Compliance Agent",
        actor: "compliance_officer",
        continueOnError: true,
        execute: async (context, state) => {
          const tenderAnalysis = contextManager.getStructuredData<Record<string, unknown>>(state, "tenderAnalysis");
          const mandatoryDocuments = Array.isArray(tenderAnalysis.mandatoryDocuments)
            ? tenderAnalysis.mandatoryDocuments
            : Array.isArray(tenderAnalysis.requirements)
              ? tenderAnalysis.requirements
              : [];
          const result = await complianceAgent.execute({
            agentRole: "compliance_officer",
            objective: "Compare contractor documents to tender requirements",
            input: {
              contractorId: context.contractorId,
              requiredDocuments: mandatoryDocuments,
            },
            context,
          });
          contextManager.setStructuredData(state, "compliance", result.output.structuredData);
          await recordReasoningTrace(context, {
            agentRole: "compliance_officer",
            decision: result.summary,
            warnings: result.output.warnings,
            payload: result.output.auditPayload,
          });
          return result.output.structuredData;
        },
      },
      {
        id: "scoring-agent",
        title: "Scoring Agent",
        actor: "scoring_engine",
        execute: async (context, state) => {
          const compliance = contextManager.getStructuredData<Record<string, unknown>>(state, "compliance");
          const result = await scoringAgent.execute({
            agentRole: "scoring_engine",
            objective: "Calculate readiness and risk classification",
            input: {
              readinessScore: compliance.readinessScore,
              missingDocuments: compliance.missingDocuments,
              expiredDocuments: compliance.expiredDocuments,
            },
            context,
          });
          contextManager.setStructuredData(state, "scoring", result.output.structuredData);
          await recordReasoningTrace(context, {
            agentRole: "scoring_engine",
            decision: result.summary,
            warnings: result.output.warnings,
            payload: result.output.auditPayload,
          });
          return result.output.structuredData;
        },
      },
      {
        id: "dashboard-agent",
        title: "Dashboard Agent",
        actor: "dashboard_operator",
        continueOnError: true,
        execute: async (context, state) => {
          const scoring = contextManager.getStructuredData<Record<string, unknown>>(state, "scoring");
          const compliance = contextManager.getStructuredData<Record<string, unknown>>(state, "compliance");
          const alerts: string[] = [];
          if (Array.isArray(compliance.expiredDocuments) && compliance.expiredDocuments.length > 0) {
            alerts.push(`Expired documents: ${compliance.expiredDocuments.join(", ")}`);
          }
          if (Array.isArray(compliance.missingDocuments) && compliance.missingDocuments.length > 0) {
            alerts.push(`Missing documents: ${compliance.missingDocuments.join(", ")}`);
          }
          if (String(scoring.readinessStatus ?? "") !== "READY") {
            alerts.push(`Readiness classification: ${String(scoring.readinessStatus ?? "RISK")}`);
          }
          const result = await dashboardAgent.execute({
            agentRole: "dashboard_operator",
            objective: "Generate operational alerts without mutating existing dashboard APIs",
            input: {
              workflowStatus: String(scoring.readinessStatus ?? "RISK"),
              alertMessage: alerts[0] ?? "Tender workflow completed",
              auditMessage: `Manus tender workflow updated to ${String(scoring.readinessStatus ?? "RISK")}`,
              alerts,
            },
            context,
          });
          contextManager.setStructuredData(state, "dashboard", result.output.structuredData);
          await recordReasoningTrace(context, {
            agentRole: "dashboard_operator",
            decision: result.summary,
            warnings: result.output.warnings,
            payload: result.output.auditPayload,
          });
          return result.output.structuredData;
        },
      },
      {
        id: "notification-agent",
        title: "Notification Agent",
        actor: "notification_coordinator",
        continueOnError: true,
        execute: async (context, state) => {
          const contractorData = contextManager.getStructuredData<Record<string, unknown>>(state, "contractor");
          const scoring = contextManager.getStructuredData<Record<string, unknown>>(state, "scoring");
          const compliance = contextManager.getStructuredData<Record<string, unknown>>(state, "compliance");
          const contractor =
            contractorData.contractor && typeof contractorData.contractor === "object"
              ? (contractorData.contractor as Record<string, unknown>)
              : {};

          const result = await notificationAgent.execute({
            agentRole: "notification_coordinator",
            objective: "Draft contractor and internal communications only",
            input: {
              email: contractor.email,
              readinessStatus: scoring.readinessStatus,
              missingDocuments: compliance.missingDocuments,
            },
            context,
          });
          contextManager.setStructuredData(state, "notification", result.output.structuredData);
          await recordReasoningTrace(context, {
            agentRole: "notification_coordinator",
            decision: result.summary,
            warnings: result.output.warnings,
            payload: result.output.auditPayload,
          });
          return result.output.structuredData;
        },
      },
      {
        id: "audit-save",
        title: "Audit Save",
        actor: "system",
        execute: async (context, state) => {
          const snapshot = {
            workflowId: context.workflowId,
            contractorId: context.contractorId ?? null,
            dealId: context.dealId ?? null,
            tenderAnalysis: state.shared.tenderAnalysis ?? {},
            compliance: state.shared.compliance ?? {},
            scoring: state.shared.scoring ?? {},
            dashboard: state.shared.dashboard ?? {},
            notification: state.shared.notification ?? {},
            informationalOnly: true,
            notificationsDraftOnly: true,
            autoActionsEnabled: false,
            updatedAt: new Date().toISOString(),
          };

          await firestoreTool.execute(
            {
              mode: "write",
              collection: "manusWorkflows",
              docId: context.workflowId,
              contractorId: context.contractorId,
              data: snapshot,
            },
            context
          );

          if (context.contractorId && !context.dryRun && flags.ENABLE_MANUS_MEMORY) {
            const memory = await memoryStore.get(context.contractorId);
            const scoring = (state.shared.scoring ?? {}) as Record<string, unknown>;
            const compliance = (state.shared.compliance ?? {}) as Record<string, unknown>;
            const tenderAnalysis = (state.shared.tenderAnalysis ?? {}) as Record<string, unknown>;

            await memoryStore.update(context.contractorId, {
              lastWorkflowId: context.workflowId,
              submissionHistory: [
                ...memory.submissionHistory,
                {
                  dealId: context.dealId,
                  workflowId: context.workflowId,
                  status: state.status,
                  submittedAt: new Date().toISOString(),
                },
              ].slice(-20),
              complianceHistory: [
                ...memory.complianceHistory,
                {
                  workflowId: context.workflowId,
                  score: typeof compliance.readinessScore === "number" ? compliance.readinessScore : 0,
                  missingDocuments: Array.isArray(compliance.missingDocuments) ? (compliance.missingDocuments as string[]) : [],
                  expiredDocuments: Array.isArray(compliance.expiredDocuments) ? (compliance.expiredDocuments as string[]) : [],
                  capturedAt: new Date().toISOString(),
                },
              ].slice(-20),
              readinessTrends: [
                ...memory.readinessTrends,
                {
                  workflowId: context.workflowId,
                  score: typeof scoring.readinessScore === "number" ? scoring.readinessScore : 0,
                  status: (typeof scoring.readinessStatus === "string" ? scoring.readinessStatus : "BLOCKED") as
                    | "READY"
                    | "RISK"
                    | "BLOCKED",
                  capturedAt: new Date().toISOString(),
                },
              ].slice(-20),
              documentExpiryPatterns: [
                ...memory.documentExpiryPatterns,
                ...(Array.isArray(compliance.expiredDocuments)
                  ? (compliance.expiredDocuments as string[]).map((documentType) => ({
                      documentType,
                      status: "expired" as const,
                    }))
                  : []),
              ].slice(-20),
              repeatedComplianceFailures: [
                ...(memory.repeatedComplianceFailures ?? []),
                ...(Array.isArray(compliance.missingDocuments) && compliance.missingDocuments.length > 0
                  ? [
                      {
                        workflowId: context.workflowId,
                        missingDocuments: compliance.missingDocuments as string[],
                        capturedAt: new Date().toISOString(),
                      },
                    ]
                  : []),
              ].slice(-20),
              industryPreferences: Array.from(
                new Set([
                  ...memory.industryPreferences,
                  typeof tenderAnalysis.industry === "string" ? tenderAnalysis.industry : "",
                ].filter(Boolean))
              ),
              riskPatterns: Array.from(
                new Set([
                  ...memory.riskPatterns,
                  typeof scoring.risk === "string" ? scoring.risk : "",
                ].filter(Boolean))
              ),
              submissionSuccessTrends: [
                ...(memory.submissionSuccessTrends ?? []),
                {
                  workflowId: context.workflowId,
                  status: (typeof scoring.readinessStatus === "string" ? scoring.readinessStatus : "BLOCKED") as
                    | "READY"
                    | "RISK"
                    | "BLOCKED",
                  capturedAt: new Date().toISOString(),
                },
              ].slice(-20),
            });
          }

          return snapshot;
        },
      },
      {
        id: "workflow-complete",
        title: "Workflow Complete",
        actor: "system",
        execute: async () => ({ completed: true, informationalOnly: true }),
      },
    ],
  };
}

export function createTenderContext(args: {
  actor: ManusContext["actor"];
  contractorId?: string;
  dealId?: string;
  documentType?: string;
  dryRun?: boolean;
}): ManusContext {
  const workflowId = `manus-${randomUUID()}`;

  return {
    requestId: randomUUID(),
    workflowId,
    workflowType: "tender",
    actor: args.actor,
    contractorId: args.contractorId,
    dealId: args.dealId,
    dryRun: args.dryRun,
    metadata: {
      createdAt: new Date().toISOString(),
      documentType: args.documentType ?? null,
    },
  };
}
