import type {
  EtendersExecutionStage,
  EtendersExecutionWorkspace,
  EtendersImportReviewInput,
  EtendersSourceRecord,
} from "@/lib/etenders/types";

function hasBoq(record: EtendersSourceRecord): boolean {
  return record.documentLinks.some((document) => document.kind === "BOQ");
}

export function buildEtendersImportPayload(input: EtendersImportReviewInput, now = new Date().toISOString()) {
  const corrected = { ...input.sourceRecord, ...(input.correctedFields ?? {}) };
  const rejected = input.rejectedAsIrrelevant === true;
  const boqRequired = hasBoq(corrected);
  const missingDocuments = corrected.documentLinks.length === 0 ? ["Official tender document link"] : [];

  return {
    type: "opportunity",
    source: "etenders-sa",
    sourceUrl: corrected.sourceUrl,
    title: corrected.title,
    name: corrected.title,
    companyId: "unassigned",
    contractorId: null,
    contractorName: null,
    status: "draft",
    stage: "lead",
    tenderNumber: corrected.tenderNumber,
    rfqNumber: corrected.tenderNumber,
    clientName: corrected.organOfState ?? corrected.department,
    issuingAuthority: corrected.organOfState ?? corrected.department,
    municipalityName: corrected.municipality,
    department: corrected.department,
    province: corrected.province,
    category: corrected.category,
    description: corrected.description,
    closingDate: corrected.closingAt,
    deadline: corrected.closingAt,
    workspaceId: input.workspaceId ?? null,
    createdAt: Date.parse(now),
    updatedAt: now,
    workflowStatus: rejected ? "REJECTED_AS_IRRELEVANT" : "MATCHING_REQUIRED",
    etendersSource: {
      ...corrected,
      workflowState: rejected ? "REJECTED_AS_IRRELEVANT" : "IMPORTED",
      reviewedByUid: input.reviewedByUid,
      reviewedAt: now,
      selectedSectorIds: input.selectedSectorIds,
      classification: input.classification,
    },
    opportunityIntake: {
      createdFrom: "etenders-sa-review-import",
      reviewedBeforeImport: true,
      officialDocumentsPreserved: true,
      selectedSectorIds: input.selectedSectorIds,
    },
    tenderAnalysis: {
      issuingAuthority: corrected.organOfState ?? corrected.department,
      tenderNumber: corrected.tenderNumber,
      deadline: corrected.closingAt,
      scope: corrected.description ?? corrected.title,
      requiredCertificates: [...corrected.compulsoryRequirements, ...corrected.cidbRequirements],
      estimatedValue: corrected.estimatedValue,
      location: corrected.municipality ?? corrected.province,
      aiAnalyzedAt: now,
    },
    eTenderDocumentLinks: corrected.documentLinks,
    sourceChangeAlerts: [],
    missingRequirements: missingDocuments,
    docsMissing: missingDocuments.length,
    readinessScore: missingDocuments.length > 0 ? 30 : 55,
    tenderLockStatus: missingDocuments.length > 0 ? "BLOCKED" : "RISK",
    isTenderLocked: true,
    boqRequired: {
      required: boqRequired,
      status: boqRequired ? "missing" : "not_applicable",
      notes: boqRequired ? "Official source includes BOQ/pricing schedule document." : "No BOQ indicator found in official source documents.",
    },
  };
}

export function compareEtendersSourceChange(previous: EtendersSourceRecord, latest: EtendersSourceRecord) {
  const alerts: string[] = [];
  if (previous.closingAt !== latest.closingAt) alerts.push("closing_date_changed");
  if (previous.sourceStatus !== latest.sourceStatus) alerts.push(`source_status_${latest.sourceStatus.toLowerCase()}`);
  const previousDocs = new Set(previous.documentLinks.map((document) => document.sourceDocumentId));
  if (latest.documentLinks.some((document) => !previousDocs.has(document.sourceDocumentId))) alerts.push("new_documents_or_amendments");
  if (previous.sourceFingerprint !== latest.sourceFingerprint) alerts.push("source_fingerprint_changed");
  return alerts;
}

function stage(key: string, label: string, status: EtendersExecutionStage["status"], blockingItems: string[], nextAction: string, owner: string | null, now: string): EtendersExecutionStage {
  return {
    key,
    label,
    status,
    owner,
    blockingItems,
    nextAction,
    dueDate: null,
    auditHistory: [{ at: now, action: "Stage created from eTenders assignment workflow" }],
  };
}

export function createEtendersExecutionWorkspace(input: {
  opportunityId: string;
  dealId: string;
  contractorId: string;
  workspaceId: string;
  sourceTenderId: string;
  complianceMissing: string[];
  boqRequired: boolean;
  now?: string;
}): EtendersExecutionWorkspace {
  const now = input.now ?? new Date().toISOString();
  const complianceBlocked = input.complianceMissing.length > 0;
  const boqBlocked = input.boqRequired;
  const stages = [
    stage("source_verified", "Opportunity source verified", "complete", [], "Continue contractor execution", "staff", now),
    stage("contractor_assigned", "Contractor assigned", "complete", [], "Start compliance check", "staff", now),
    stage("compliance_check", "Compliance check", complianceBlocked ? "blocked" : "complete", input.complianceMissing, complianceBlocked ? "Resolve missing contractor compliance documents" : "Prepare tender documents", "compliance", now),
    stage("missing_contractor_documents", "Missing contractor documents", complianceBlocked ? "blocked" : "complete", input.complianceMissing, complianceBlocked ? "Request missing documents from contractor" : "Confirm required tender documents", "compliance", now),
    stage("required_tender_documents", "Required tender documents", "in_progress", [], "Select official documents for ingestion", "staff", now),
    stage("boq_status", "BOQ status", boqBlocked ? "blocked" : "complete", boqBlocked ? ["BOQ review required"] : [], boqBlocked ? "Run BOQ workflow" : "Continue pricing", "qs", now),
    stage("pricing_status", "Pricing status", boqBlocked ? "pending" : "in_progress", [], "Prepare pricing schedule", "qs", now),
    stage("forms_autofill", "Forms auto-fill status", "pending", [], "Generate forms from reviewed data", "staff", now),
    stage("internal_review", "Internal review", "pending", [], "Route tender pack for internal approval", "manager", now),
    stage("contractor_review", "Contractor review/approval", "pending", [], "Send pack to contractor for approval", "contractor", now),
    stage("signature_status", "Signature status", "pending", [], "Collect signatures", "contractor", now),
    stage("tender_pack_generation", "Tender-pack generation", "pending", [], "Generate tender pack", "staff", now),
    stage("submission_readiness", "Submission readiness", complianceBlocked || boqBlocked ? "blocked" : "pending", [...input.complianceMissing, ...(boqBlocked ? ["BOQ workflow required"] : [])], "Clear blockers before submission", "manager", now),
    stage("submission_evidence", "Submission evidence", "pending", [], "Attach submission receipt or proof", "staff", now),
    stage("outcome_tracking", "Outcome tracking", "pending", [], "Monitor award/cancellation/closure", "staff", now),
  ];

  return {
    opportunityId: input.opportunityId,
    dealId: input.dealId,
    contractorId: input.contractorId,
    workspaceId: input.workspaceId,
    sourceTenderId: input.sourceTenderId,
    route: `/dashboard/deals/${input.dealId}/execution`,
    stages,
    submissionReady: !complianceBlocked && !boqBlocked,
  };
}

