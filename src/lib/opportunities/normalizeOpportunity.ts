import {
  DEFAULT_OPPORTUNITY_AI_ANALYSIS,
  DEFAULT_OPPORTUNITY_BOQ,
  DEFAULT_OPPORTUNITY_BRIEFING,
  DEFAULT_OPPORTUNITY_COMPLIANCE,
  DEFAULT_OPPORTUNITY_SUBMISSION_READINESS,
  OPPORTUNITY_LIFECYCLE_STATUSES,
  OPPORTUNITY_SCHEMA_VERSION,
  OPPORTUNITY_SOURCE_TYPES,
} from "@/lib/opportunities/constants";
import type {
  Opportunity,
  OpportunityActivityEvent,
  OpportunityAiAnalysis,
  OpportunityBoqRequirement,
  OpportunityBriefing,
  OpportunityBriefingMode,
  OpportunityComplianceSnapshot,
  OpportunityContractorAssignment,
  OpportunityLifecycleStatus,
  OpportunityMessage,
  OpportunityMetadata,
  OpportunityMunicipality,
  OpportunityPriority,
  OpportunityReadinessStatus,
  OpportunitySourceType,
  OpportunitySubmissionReadiness,
} from "@/types/opportunity";
import type { TenderData } from "@/types/tender.types";

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function optionalString(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string" && item.trim().length > 0)
    : [];
}

function numberOrNull(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function booleanOrFalse(value: unknown): boolean {
  return value === true;
}

function normalizeSourceType(value: unknown): OpportunitySourceType {
  return OPPORTUNITY_SOURCE_TYPES.includes(value as OpportunitySourceType)
    ? (value as OpportunitySourceType)
    : "Tender";
}

function normalizeStatus(value: unknown): OpportunityLifecycleStatus {
  return OPPORTUNITY_LIFECYCLE_STATUSES.includes(value as OpportunityLifecycleStatus)
    ? (value as OpportunityLifecycleStatus)
    : "identified";
}

function normalizePriority(value: unknown): OpportunityPriority {
  return value === "low" || value === "medium" || value === "high" || value === "critical"
    ? value
    : "medium";
}

function normalizeBriefingMode(value: unknown): OpportunityBriefingMode {
  return value === "physical" || value === "online" || value === "hybrid" || value === "unknown"
    ? value
    : "unknown";
}

function normalizeReadinessStatus(value: unknown, score: number): OpportunityReadinessStatus {
  if (value === "READY" || value === "AT_RISK" || value === "NOT_READY") {
    return value;
  }

  if (score >= 80) {
    return "READY";
  }

  if (score >= 60) {
    return "AT_RISK";
  }

  return "NOT_READY";
}

function normalizeMetadata(source: Record<string, unknown>): OpportunityMetadata {
  const metadata = asRecord(source.metadata);
  const value = asRecord(metadata.value);
  const estimatedValue = asRecord(metadata.estimatedValue);
  const valueAmount = numberOrNull(value.amount);
  const estimatedAmount = numberOrNull(estimatedValue.amount);

  return {
    sourceType: normalizeSourceType(metadata.sourceType ?? source.sourceType ?? source.type),
    sourceReference: optionalString(metadata.sourceReference ?? source.sourceReference),
    issuerReference: optionalString(metadata.issuerReference ?? source.issuerReference ?? source.tenderNumber),
    title: optionalString(metadata.title ?? source.title) ?? "Untitled opportunity",
    description: optionalString(metadata.description ?? source.description),
    category: optionalString(metadata.category ?? source.category),
    tags: stringArray(metadata.tags ?? source.tags),
    priority: normalizePriority(metadata.priority ?? source.priority),
    workspaceId: optionalString(metadata.workspaceId ?? source.workspaceId),
    ownerUid: optionalString(metadata.ownerUid ?? source.ownerUid ?? source.assignedTo),
    value: valueAmount === null ? null : { amount: valueAmount, currency: optionalString(value.currency) ?? "ZAR" },
    estimatedValue:
      estimatedAmount === null
        ? null
        : { amount: estimatedAmount, currency: optionalString(estimatedValue.currency) ?? "ZAR" },
    createdAt: optionalString(metadata.createdAt ?? source.createdAt),
    updatedAt: optionalString(metadata.updatedAt ?? source.updatedAt),
  };
}

function normalizeMunicipality(source: Record<string, unknown>): OpportunityMunicipality {
  const municipality = asRecord(source.municipality);

  return {
    id: optionalString(municipality.id),
    name:
      optionalString(municipality.name ?? source.municipalityName ?? source.issuingAuthority) ??
      "Unknown municipality",
    province: optionalString(municipality.province),
    district: optionalString(municipality.district),
    contactEmail: optionalString(municipality.contactEmail),
    contactPhone: optionalString(municipality.contactPhone),
    website: optionalString(municipality.website),
  };
}

function normalizeBriefing(source: Record<string, unknown>): OpportunityBriefing {
  const briefing = asRecord(source.compulsoryBriefing ?? source.briefing);
  const requiredStatus =
    briefing.requiredStatus === "yes" || briefing.requiredStatus === "no" || briefing.requiredStatus === "unknown"
      ? briefing.requiredStatus
      : booleanOrFalse(briefing.compulsory ?? source.compulsoryBriefing)
        ? "yes"
        : "unknown";

  return {
    ...DEFAULT_OPPORTUNITY_BRIEFING,
    compulsory: booleanOrFalse(briefing.compulsory) || requiredStatus === "yes",
    requiredStatus,
    briefingAt: optionalString(briefing.briefingAt ?? source.briefingAt),
    mode: normalizeBriefingMode(briefing.mode),
    locationOrPlatform: optionalString(briefing.locationOrPlatform),
    notes: optionalString(briefing.notes),
  };
}

function normalizeBoq(source: Record<string, unknown>): OpportunityBoqRequirement {
  const boq = asRecord(source.boqRequired ?? source.boq);
  const required = booleanOrFalse(boq.required ?? source.boqRequired);

  return {
    ...DEFAULT_OPPORTUNITY_BOQ,
    required,
    status:
      boq.status === "missing" || boq.status === "uploaded" || boq.status === "reviewed" || boq.status === "not_applicable"
        ? boq.status
        : required
          ? "missing"
          : "not_applicable",
    documentId: optionalString(boq.documentId),
    notes: optionalString(boq.notes),
  };
}

function normalizeAssignments(value: unknown): OpportunityContractorAssignment[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.map((item, index) => {
    const assignment = asRecord(item);
    return {
      id: optionalString(assignment.id) ?? `assignment-${index + 1}`,
      contractorId: optionalString(assignment.contractorId) ?? "unknown",
      contractorName: optionalString(assignment.contractorName),
      role:
        assignment.role === "lead" ||
        assignment.role === "reviewer" ||
        assignment.role === "qs" ||
        assignment.role === "compliance" ||
        assignment.role === "support"
          ? assignment.role
          : "support",
      assignedByUid: optionalString(assignment.assignedByUid),
      assignedAt: optionalString(assignment.assignedAt) ?? new Date(0).toISOString(),
      status:
        assignment.status === "assigned" ||
        assignment.status === "accepted" ||
        assignment.status === "declined" ||
        assignment.status === "removed"
          ? assignment.status
          : "assigned",
      removedAt: optionalString(assignment.removedAt),
      notes: optionalString(assignment.notes),
    };
  });
}

function normalizeCompliance(source: Record<string, unknown>): OpportunityComplianceSnapshot {
  const compliance = asRecord(source.compliance);
  const score = numberOrNull(compliance.score ?? source.readinessScore);

  return {
    ...DEFAULT_OPPORTUNITY_COMPLIANCE,
    status:
      compliance.status === "PASS" || compliance.status === "WARNING" || compliance.status === "FAIL"
        ? compliance.status
        : "UNKNOWN",
    matched: booleanOrFalse(compliance.matched ?? source.complianceMatch),
    score,
    missingRequirements: stringArray(compliance.missingRequirements ?? source.missingRequirements),
    blockers: stringArray(compliance.blockers),
    riskLevel:
      compliance.riskLevel === "LOW" ||
      compliance.riskLevel === "MEDIUM" ||
      compliance.riskLevel === "HIGH" ||
      compliance.riskLevel === "CRITICAL"
        ? compliance.riskLevel
        : null,
    evaluatedAt: optionalString(compliance.evaluatedAt ?? source.readinessUpdatedAt),
    evaluatedBy: optionalString(compliance.evaluatedBy),
  };
}

function normalizeAiAnalysis(value: unknown): OpportunityAiAnalysis {
  const analysis = asRecord(value);

  return {
    ...DEFAULT_OPPORTUNITY_AI_ANALYSIS,
    status:
      analysis.status === "pending" || analysis.status === "completed" || analysis.status === "failed"
        ? analysis.status
        : "not_requested",
    summary: optionalString(analysis.summary),
    scopeOfWork: optionalString(analysis.scopeOfWork ?? analysis.scope),
    eligibilityRequirements: stringArray(analysis.eligibilityRequirements),
    requiredDocuments: stringArray(analysis.requiredDocuments ?? analysis.requiredCertificates),
    risks: stringArray(analysis.risks ?? analysis.mainRiskNotes),
    recommendations: stringArray(analysis.recommendations),
    confidence: numberOrNull(analysis.confidence),
    model: optionalString(analysis.model),
    analyzedAt: optionalString(analysis.analyzedAt ?? analysis.aiAnalyzedAt),
    sourceDocumentIds: stringArray(analysis.sourceDocumentIds),
  };
}

function normalizeReadiness(source: Record<string, unknown>): OpportunitySubmissionReadiness {
  const readiness = asRecord(source.submissionReadiness ?? source.readiness);
  const score = numberOrNull(readiness.score ?? readiness.readinessScore ?? source.readinessScore) ?? 0;

  return {
    ...DEFAULT_OPPORTUNITY_SUBMISSION_READINESS,
    status: normalizeReadinessStatus(readiness.status, score),
    score,
    requiredActions: stringArray(readiness.requiredActions),
    missingDocuments: stringArray(readiness.missingDocuments ?? source.missingRequirements),
    reviewedByUid: optionalString(readiness.reviewedByUid),
    reviewedAt: optionalString(readiness.reviewedAt),
  };
}

function normalizeMessages(value: unknown): OpportunityMessage[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.map((item, index) => {
    const message = asRecord(item);
    return {
      id: optionalString(message.id) ?? `message-${index + 1}`,
      authorUid: optionalString(message.authorUid),
      authorName: optionalString(message.authorName),
      body: optionalString(message.body) ?? "",
      visibility:
        message.visibility === "internal" || message.visibility === "contractor" || message.visibility === "all"
          ? message.visibility
          : "internal",
      createdAt: optionalString(message.createdAt) ?? new Date(0).toISOString(),
      editedAt: optionalString(message.editedAt),
      metadata: asRecord(message.metadata),
    };
  });
}

function normalizeActivity(value: unknown): OpportunityActivityEvent[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.map((item, index) => {
    const activity = asRecord(item);
    return {
      id: optionalString(activity.id) ?? `activity-${index + 1}`,
      type: optionalString(activity.type) ?? "updated",
      message: optionalString(activity.message) ?? "Opportunity updated",
      createdAt: optionalString(activity.createdAt) ?? new Date(0).toISOString(),
      actor: activity.actor ? asRecord(activity.actor) : null,
      metadata: asRecord(activity.metadata),
    };
  });
}

export function normalizeOpportunity(id: string, source: Record<string, unknown>): Opportunity {
  return {
    schemaVersion: OPPORTUNITY_SCHEMA_VERSION,
    id,
    legacyDealId: optionalString(source.legacyDealId),
    tenderId: optionalString(source.tenderId),
    status: normalizeStatus(source.status),
    metadata: normalizeMetadata(source),
    municipality: normalizeMunicipality(source),
    closingDate: optionalString(source.closingDate),
    compulsoryBriefing: normalizeBriefing(source),
    boqRequired: normalizeBoq(source),
    contractorAssignments: normalizeAssignments(source.contractorAssignments),
    compliance: normalizeCompliance(source),
    aiAnalysis: normalizeAiAnalysis(source.aiAnalysis ?? source.analysis ?? source.tenderAnalysis),
    submissionReadiness: normalizeReadiness(source),
    messages: normalizeMessages(source.messages),
    activityTimeline: normalizeActivity(source.activityTimeline),
  };
}

export function opportunityFromTenderData(tender: TenderData): Opportunity {
  return normalizeOpportunity(tender.tenderId, {
    tenderId: tender.tenderId,
    legacyDealId: tender.legacyDealId,
    status: tender.status === "submitted" ? "submitted" : tender.status === "awarded" ? "awarded" : "identified",
    metadata: {
      sourceType: "Tender",
      sourceReference: tender.tenderId,
      issuerReference: tender.tenderNumber,
      title: tender.title,
      description: tender.description,
      tags: tender.tags,
      priority: "medium",
      estimatedValue: tender.estimatedValue,
      value: tender.value,
      createdAt: tender.timeline.createdAt,
      updatedAt: tender.timeline.updatedAt,
    },
    municipality: {
      name: tender.buyer?.name ?? tender.analysis?.issuingAuthority ?? "Unknown municipality",
    },
    closingDate: tender.timeline.submissionDeadlineAt,
    compulsoryBriefing: {
      compulsory: Boolean(tender.timeline.briefingAt),
      requiredStatus: tender.timeline.briefingAt ? "yes" : "unknown",
      briefingAt: tender.timeline.briefingAt,
      mode: "unknown",
    },
    boqRequired: {
      required: tender.requirements.some((requirement) => /boq|bill of quantities/i.test(requirement.title)),
      status: tender.requirements.some((requirement) => /boq|bill of quantities/i.test(requirement.title))
        ? "missing"
        : "not_applicable",
    },
    compliance: tender.compliance,
    readiness: tender.readiness,
    analysis: tender.analysis,
    activityTimeline: tender.auditTrail,
  });
}
