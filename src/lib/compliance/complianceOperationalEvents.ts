import type { Firestore } from "firebase-admin/firestore";
import type { ContractorComplianceIntelligence } from "@/lib/compliance/contractorComplianceIntelligence";
import type { ContractorComplianceSummary } from "@/lib/compliance/contractorCompliance";
import { recordAuditLog } from "@/server/services/auditLogService";

function normalizeArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string" && item.trim().length > 0) : [];
}

function hasMeaningfulIntelligenceChange(
  before: Record<string, unknown> | undefined,
  intelligence: ContractorComplianceIntelligence,
  summary: ContractorComplianceSummary,
): boolean {
  return (
    Number(before?.complianceConfidence ?? -1) !== intelligence.complianceConfidence ||
    Number(before?.readinessConfidence ?? -1) !== intelligence.readinessConfidence ||
    Number(before?.operationalSubmissionConfidence ?? -1) !== intelligence.operationalSubmissionConfidence ||
    String(before?.riskGrade ?? "") !== intelligence.riskGrade ||
    String(before?.tenderLockStatus ?? "") !== summary.tenderLockStatus ||
    JSON.stringify(normalizeArray(before?.blockedReasons)) !== JSON.stringify(intelligence.blockedReasons) ||
    JSON.stringify(normalizeArray(before?.reviewRecommendations)) !== JSON.stringify(intelligence.reviewRecommendations)
  );
}

export async function persistComplianceOperationalEvents(params: {
  db: Firestore;
  contractorId: string;
  before?: Record<string, unknown>;
  intelligence: ContractorComplianceIntelligence;
  summary: ContractorComplianceSummary;
}) {
  const { db, contractorId, before, intelligence, summary } = params;
  if (!hasMeaningfulIntelligenceChange(before, intelligence, summary)) {
    return;
  }

  const metadata = {
    contractorId,
    readinessStatus: summary.tenderLockStatus,
    readinessScore: summary.readinessScore,
    complianceConfidence: intelligence.complianceConfidence,
    readinessConfidence: intelligence.readinessConfidence,
    operationalSubmissionConfidence: intelligence.operationalSubmissionConfidence,
    riskGrade: intelligence.riskGrade,
    blockedReasons: intelligence.blockedReasons,
    reviewRecommendations: intelligence.reviewRecommendations,
    documentBreakdown: intelligence.documentBreakdown.map((item) => ({
      documentType: item.documentType,
      status: item.status,
      weightedScore: item.weightedScore,
      complianceScore: item.complianceScore,
      confidenceScore: item.confidenceScore,
      taxDocumentCategory: item.taxDocumentCategory ?? null,
      taxDocumentPurpose: item.taxDocumentPurpose ?? null,
      taxClassificationConfidence: item.taxClassificationConfidence ?? null,
      taxComplianceCapable: item.taxComplianceCapable ?? null,
      taxSupportingOnly: item.taxSupportingOnly ?? null,
      readinessImpactReason: item.readinessImpactReason ?? null,
      reason: item.reason,
    })),
    telemetry: intelligence.telemetry,
  };

  console.log("[AUDIT_EVENT]", {
    contractorId,
    entityType: "compliance",
    action: "compliance_change",
    metadata,
  });

  try {
    await recordAuditLog({
      userId: "system",
      action: "compliance_change",
      entityType: "compliance",
      entityId: contractorId,
      metadata,
    });
  } catch (error) {
    console.error("Compliance audit log write failed:", error);
  }

  console.log("[TELEMETRY_EVENT]", {
    contractorId,
    eventType: "contractor_compliance_intelligence_recomputed",
    telemetry: intelligence.telemetry,
    riskGrade: intelligence.riskGrade,
  });

  try {
    await db.collection("complianceTelemetry").add({
      contractorId,
      eventType: "contractor_compliance_intelligence_recomputed",
      readinessStatus: summary.tenderLockStatus,
      readinessScore: summary.readinessScore,
      riskGrade: intelligence.riskGrade,
      complianceConfidence: intelligence.complianceConfidence,
      readinessConfidence: intelligence.readinessConfidence,
      operationalSubmissionConfidence: intelligence.operationalSubmissionConfidence,
      blockedReasons: intelligence.blockedReasons,
      reviewRecommendations: intelligence.reviewRecommendations,
      telemetry: intelligence.telemetry,
      createdAt: new Date(),
    });
  } catch (error) {
    console.error("Compliance telemetry write failed:", error);
  }
}

export async function recordDeploymentIntelligenceEvent(params: {
  db: Firestore;
  contractorId: string;
  eventType: string;
  details: Record<string, unknown>;
}) {
  console.log("[DEPLOYMENT_EVENT]", {
    contractorId: params.contractorId,
    eventType: params.eventType,
    details: params.details,
  });

  try {
    await params.db.collection("deploymentIntelligence").add({
      contractorId: params.contractorId,
      eventType: params.eventType,
      details: params.details,
      createdAt: new Date(),
    });
  } catch (error) {
    console.error("Deployment intelligence write failed:", error);
  }
}
