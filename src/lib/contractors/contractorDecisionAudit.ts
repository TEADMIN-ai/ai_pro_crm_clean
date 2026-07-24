import {
  cleanContractorIdentityText,
  looksLikePersonalContractorIdentity,
  looksLikePlaceholderContractorIdentity,
  resolveContractorBusinessIdentity,
} from "@/lib/contractors/contractorBusinessIdentity";
import {
  CONTRACTOR_REPOSITORY_DECISION_LOGIC_VERSION,
  buildContractorRepositoryDecision,
  validateCipcRegistrationNumber,
  validateCsdSupplierNumber,
} from "@/lib/contractors/contractorRepositoryDecision";
import type { ContractorDocument } from "@/types/document";

export const CONTRACTOR_DECISION_AUDIT_LOGIC_VERSION = "contractor-decision-audit-v1";
export const CONTRACTOR_DECISION_SNAPSHOT_SCHEMA_VERSION = "contractor-decision-snapshot-v1";

export type ContractorDecisionAuditSeverity = "CRITICAL" | "HIGH" | "MEDIUM" | "LOW" | "INFORMATIONAL";

export type SnapshotRecord = {
  id: string;
  collection: string;
  path?: string;
  data: Record<string, unknown>;
};

export type ContractorDocumentSnapshotRecord = SnapshotRecord & {
  contractorId: string | null;
  documentType: string | null;
};

export type ContractorDecisionAuditRelationship = {
  sourceType: string;
  sourceId: string;
  targetType: string;
  targetId: string;
  relationshipType: string;
  evidenceSource: string;
};

export type ContractorDecisionAuditSnapshot = {
  metadata: {
    generatedAt: string;
    environment: "production" | "local" | "test";
    projectId: string | null;
    collectorLogicVersion: string;
    snapshotSchemaVersion: string;
    elapsedMs?: number;
  };
  contractors: SnapshotRecord[];
  users: SnapshotRecord[];
  workspaces: SnapshotRecord[];
  deals: SnapshotRecord[];
  opportunities: SnapshotRecord[];
  recommendations: SnapshotRecord[];
  assignments: SnapshotRecord[];
  tenderPacks: SnapshotRecord[];
  submissionReviews: SnapshotRecord[];
  auditEvents: SnapshotRecord[];
  activityRecords: SnapshotRecord[];
  contractorDocuments: ContractorDocumentSnapshotRecord[];
  relationships: ContractorDecisionAuditRelationship[];
  collectionStatistics: Record<string, { records: number; path: string }>;
  queryStatistics: {
    collectionReads: number;
    documentReads: number;
    queryCount: number;
    subcollectionReads: number;
    nPlusOnePatterns: string[];
    elapsedMs?: number;
  };
};

export type ContractorDecisionAuditFinding = {
  code: string;
  severity: ContractorDecisionAuditSeverity;
  message: string;
  evidence: Record<string, unknown>;
};

export type ContractorDecisionAuditEventDeduplication = {
  rawEventCount: number;
  deduplicatedEventCount: number;
  duplicateCountRemoved: number;
  deduplicationKey: string;
  rawRecordsByCategory: Record<string, number>;
  sourceCollections: string[];
};

export type ContractorDecisionAuditRemediationOption = {
  option: string;
  status: "RECOMMENDED" | "NOT_RECOMMENDED" | "CONDITIONAL" | "REJECTED";
  benefits: string[];
  risks: string[];
  documentImpact: string;
  dealImpact: string;
  userAuthLinkageImpact: string;
  auditContinuity: string;
  duplicateRisk: string;
  rollbackComplexity: "LOW" | "MEDIUM" | "HIGH";
};

export type ContractorDecisionAuditContractor = {
  contractorId: string;
  workspaceId: string | null;
  safeDisplayLabel: string | null;
  identityStatus: string | null;
  identityResolved: boolean | null;
  identityMatchStatus: string | null;
  cipcStatus: string;
  csdStatus: string;
  externalVerificationStatus: string;
  documentCompleteness: number;
  currentReadinessDecision: string;
  currentReadinessScore: number | null;
  assignmentAllowed: boolean;
  historicalDecision: Record<string, unknown>;
  decisionTimestamp: unknown;
  logicVersion: unknown;
  stale: boolean;
  blockingReasons: string[];
  linkedUserRelationshipType: string;
  linkedDeals: string[];
  linkedOpportunities: string[];
  linkedRecommendations: string[];
  linkedAssignments: string[];
  linkedTenderPacks: string[];
  linkedSubmissionReviews: string[];
  linkedDocumentsCount: number;
  relationshipBreakdown: Record<string, number>;
  evidenceSummary: {
    storedIdentityFields: Record<string, unknown>;
    businessIdentityEvidence: Record<string, unknown>;
    ownsUploadedDocumentsDirectly: boolean;
    separateCanonicalTorqueEmpireRecordAppears: boolean;
    activeAssignmentEvidence: boolean;
    tenderPackGenerated: boolean;
    submissionCompleted: boolean;
    documentOwnershipConflict: boolean;
    orphanedRecordsExist: boolean;
    missingWorkspaceRepairBlocker: boolean;
    opportunityExecutionRecordsPresent: boolean;
    retainedInternalIdsRequiredForAllowlist: boolean;
  };
  auditActivityReferences: string[];
  findings: ContractorDecisionAuditFinding[];
  riskClassification: ContractorDecisionAuditSeverity;
  recommendedFutureAction: string;
  manualBusinessVerificationRequired: boolean;
  knownContext?: string[];
};

export type ContractorDecisionAuditReport = {
  metadata: {
    generatedAt: string;
    auditLogicVersion: string;
    snapshotSchemaVersion: string;
    sourceGeneratedAt: string;
  };
  summary: {
    totalContractorsReviewed: number;
    countsBySeverity: Record<ContractorDecisionAuditSeverity, number>;
    suspectContractors: number;
    duplicateCandidateGroups: number;
    affectedDeals: number;
    affectedRecommendations: number;
    affectedAssignments: number;
    affectedTenderPacks: number;
    affectedSubmissionReviews: number;
    staleDecisionCount: number;
    invalidCsdCount: number;
    invalidCipcCount: number;
    workspaceIssueCount: number;
    staffAdminContaminationCount: number;
    orphanedRelationshipCount: number;
    rawRecordsByCategory: Record<string, number>;
    eventDeduplication: ContractorDecisionAuditEventDeduplication;
  };
  contractors: ContractorDecisionAuditContractor[];
  duplicateCandidates: Array<{
    basis: string;
    key: string;
    contractorIds: string[];
    severity: ContractorDecisionAuditSeverity;
    recommendation: string;
  }>;
  orphanedRelationships: ContractorDecisionAuditRelationship[];
  recommendedRemediationGroups: Array<{ group: string; contractorIds: string[]; recommendation: string }>;
  remediationOptions: ContractorDecisionAuditRemediationOption[];
  proposedFirstRepairCandidates: Array<{ contractorId: string; reason: string; requiredControls: string[] }>;
  markdown: string;
};

const SENSITIVE_KEYS = new Set([
  "email",
  "contactEmail",
  "phone",
  "phoneNumber",
  "contactPhone",
  "mobile",
  "idNumber",
  "identityNumber",
  "taxReferenceNumber",
  "taxNumber",
  "vatNumber",
  "bankAccountNumber",
  "accountNumber",
  "password",
  "token",
  "session",
  "cookie",
  "authorization",
  "encryptedTcsPin",
  "protectedSecretRef",
  "extractedText",
  "ocrText",
  "rawText",
  "fileUrl",
  "downloadURL",
  "storagePath",
  "url",
]);

const SAFE_RECORD_KEYS = new Set([
  "id",
  "contractorId",
  "workspaceId",
  "companyName",
  "businessName",
  "registeredBusinessName",
  "legalName",
  "tradingName",
  "name",
  "displayName",
  "contractorName",
  "taxpayerName",
  "registrationNumber",
  "companyRegistrationNumber",
  "cipcNumber",
  "csdNumber",
  "csdMNumber",
  "mNumber",
  "status",
  "stage",
  "workflowStatus",
  "assignmentStatus",
  "packStatus",
  "tenderLockStatus",
  "role",
  "userRole",
  "contractorRole",
  "relationshipType",
  "contractorReference",
  "recordClassification",
  "identityStatus",
  "identityResolved",
  "identityMatchStatus",
  "identityConfidence",
  "identityEvidence",
  "identityEvidenceFields",
  "businessIdentityEvidence",
  "readinessScore",
  "readinessStatus",
  "readinessDecisionStatus",
  "readinessUpdatedAt",
  "decisionEvaluatedAt",
  "decisionLogicVersion",
  "logicVersion",
  "complianceScore",
  "complianceStatus",
  "complianceApproved",
  "complianceDecisionStatus",
  "overallStatus",
  "documentCompletenessScore",
  "externalVerificationStatus",
  "sarsTcsSummary",
  "sarsStatus",
  "sarsVerificationStatus",
  "assignmentAllowed",
  "blockingReasons",
  "stale",
  "staleReasons",
  "createdAt",
  "updatedAt",
  "submittedAt",
  "generatedAt",
  "completedAt",
  "closedAt",
  "dealId",
  "opportunityId",
  "recommendationId",
  "assignmentId",
  "tenderPackId",
  "packRequestId",
  "submissionReviewId",
  "auditEventId",
  "activityId",
  "entityId",
  "entityType",
  "targetId",
  "targetType",
  "sourceId",
  "sourceType",
  "linkedContractorId",
  "assignedContractorId",
  "contractorUid",
  "uid",
  "userId",
  "authUid",
  "ownerId",
  "clientId",
  "organisationId",
  "organizationId",
  "contractorAssignment",
  "opportunityExecution",
  "businessEmailDomain",
  "verificationStatus",
  "registeredTaxpayerName",
]);

const DOCUMENT_METADATA_KEYS = new Set([
  "id",
  "contractorId",
  "documentType",
  "docType",
  "status",
  "validationStatus",
  "verificationStatus",
  "reviewStatus",
  "verified",
  "verifiedAt",
  "uploadedAt",
  "createdAt",
  "updatedAt",
  "issueDate",
  "expiryDate",
  "expiresAt",
  "identityMatchStatus",
  "taxpayerNameMatch",
  "contractorIdentityMatch",
  "extractionSource",
  "source",
]);

function str(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function num(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function norm(value: unknown): string {
  return str(value)?.toLowerCase().replace(/[^a-z0-9]+/g, "") ?? "";
}

function safeId(value: unknown): string | null {
  return str(value);
}

function label(record: Record<string, unknown>): string | null {
  return str(record.legalName) ?? str(record.tradingName) ?? str(record.registeredBusinessName) ?? str(record.businessName) ?? str(record.companyName) ?? str(record.name);
}

function normalizeSarsRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object") return null;
  const record = { ...(value as Record<string, unknown>) };
  if (!str(record.verificationStatus)) record.verificationStatus = str(record.status);
  return record;
}

function maskEmail(value: string): string {
  const [local, domain] = value.split("@");
  if (!domain) return "[REDACTED_EMAIL]";
  return `${local.slice(0, 1) || "x"}***@${domain.toLowerCase()}`;
}

function emailDomain(value: string): string | null {
  const domain = value.split("@")[1]?.trim().toLowerCase();
  return domain && /^[a-z0-9.-]+\.[a-z]{2,}$/.test(domain) ? domain : null;
}

function maskIdentifier(value: string): string {
  const compact = value.replace(/\s+/g, "");
  if (compact.length <= 4) return "[REDACTED]";
  return `***${compact.slice(-4)}`;
}

export function redactAuditValue(key: string, value: unknown): unknown {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (Array.isArray(value)) return value.map((item) => redactAuditValue(key, item)).filter((item) => item !== undefined);
  if (value && typeof value === "object") return redactAuditRecord(value as Record<string, unknown>);
  if (typeof value !== "string") return value;

  const lowered = key.toLowerCase();
  if (lowered.includes("email")) return maskEmail(value);
  if (lowered.includes("phone") || lowered.includes("mobile")) return "[REDACTED_PHONE]";
  if (lowered.includes("tax") || lowered.includes("identity") || lowered.includes("idnumber") || lowered.includes("bank") || lowered.includes("account")) return maskIdentifier(value);
  if (lowered.includes("url") || lowered.includes("path")) return "[REDACTED_PATH]";
  if (lowered.includes("token") || lowered.includes("cookie") || lowered.includes("password") || lowered.includes("authorization")) return undefined;
  return value;
}

export function redactAuditRecord(record: Record<string, unknown>): Record<string, unknown> {
  const output: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(record)) {
    if (!SAFE_RECORD_KEYS.has(key)) continue;
    if (SENSITIVE_KEYS.has(key)) continue;
    const redacted = redactAuditValue(key, value);
    if (redacted !== undefined) output[key] = redacted;
  }
  const domain = [record.email, record.contactEmail, record.ownerEmail]
    .map((value) => typeof value === "string" ? emailDomain(value) : null)
    .find((value): value is string => Boolean(value));
  if (domain) output.businessEmailDomain = domain;
  return output;
}

export function sanitizeDocumentMetadata(record: Record<string, unknown>): Record<string, unknown> {
  const output: Record<string, unknown> = {};
  for (const key of DOCUMENT_METADATA_KEYS) {
    if (key in record) {
      const value = redactAuditValue(key, record[key]);
      if (value !== undefined) output[key] = value;
    }
  }
  return output;
}

function severityRank(severity: ContractorDecisionAuditSeverity): number {
  if (severity === "CRITICAL") return 5;
  if (severity === "HIGH") return 4;
  if (severity === "MEDIUM") return 3;
  if (severity === "LOW") return 2;
  return 1;
}

function maxSeverity(findings: ContractorDecisionAuditFinding[]): ContractorDecisionAuditSeverity {
  return findings.reduce<ContractorDecisionAuditSeverity>((max, finding) => severityRank(finding.severity) > severityRank(max) ? finding.severity : max, "INFORMATIONAL");
}

function addFinding(findings: ContractorDecisionAuditFinding[], finding: ContractorDecisionAuditFinding): void {
  if (!findings.some((item) => item.code === finding.code)) findings.push(finding);
}

function related(snapshot: ContractorDecisionAuditSnapshot, targetId: string, sourceType: string, relationshipType?: string): string[] {
  return snapshot.relationships
    .filter((item) => item.targetType === "contractor" && item.targetId === targetId && item.sourceType === sourceType && (!relationshipType || item.relationshipType === relationshipType))
    .map((item) => item.sourceId)
    .sort();
}

function relationshipBreakdown(snapshot: ContractorDecisionAuditSnapshot, contractorId: string): Record<string, number> {
  const output: Record<string, number> = {};
  for (const relationship of snapshot.relationships.filter((item) => item.targetType === "contractor" && item.targetId === contractorId)) {
    const key = `${relationship.sourceType}:${relationship.relationshipType}`;
    output[key] = (output[key] ?? 0) + 1;
  }
  return output;
}

function activeWorkflow(record: SnapshotRecord): boolean {
  const status = norm(record.data.status ?? record.data.stage ?? record.data.workflowStatus ?? record.data.assignmentStatus ?? record.data.packStatus);
  return !status || !["archived", "cancelled", "canceled", "complete", "completed", "closed", "deleted", "rejected", "lost", "inactive"].some((value) => status.includes(value));
}

function eventTimestamp(record: SnapshotRecord): unknown {
  return record.data.timestamp ?? record.data.createdAt ?? record.data.updatedAt ?? record.data.completedAt ?? record.data.generatedAt ?? record.data.submittedAt ?? null;
}

function eventAction(record: SnapshotRecord): string {
  return norm(record.data.eventType ?? record.data.action ?? record.data.activityType ?? record.data.type ?? record.data.status ?? record.data.stage ?? record.id);
}

function eventRelationship(record: SnapshotRecord): string {
  return [
    record.data.contractorId,
    record.data.linkedContractorId,
    record.data.assignedContractorId,
    record.data.dealId,
    record.data.opportunityId,
    record.data.userId,
    record.data.uid,
    record.data.authUid,
    record.data.workspaceId,
  ].map((value) => str(value) ?? "").filter(Boolean).join("|");
}

function buildEventDeduplication(snapshot: ContractorDecisionAuditSnapshot): ContractorDecisionAuditEventDeduplication {
  const rawEventRecords = [...snapshot.auditEvents, ...snapshot.activityRecords];
  const rawRecordsByCategory: Record<string, number> = {};
  const deduped = new Set<string>();
  for (const record of rawEventRecords) {
    rawRecordsByCategory[record.collection] = (rawRecordsByCategory[record.collection] ?? 0) + 1;
    deduped.add([record.collection, str(record.id) ?? "", eventAction(record), eventRelationship(record), String(eventTimestamp(record) ?? "")].join("::"));
  }
  return {
    rawEventCount: rawEventRecords.length,
    deduplicatedEventCount: deduped.size,
    duplicateCountRemoved: rawEventRecords.length - deduped.size,
    deduplicationKey: "source collection + source record ID + normalized event/action + contractor/deal/user/workspace relationship + timestamp",
    rawRecordsByCategory,
    sourceCollections: Object.keys(rawRecordsByCategory).sort(),
  };
}

function buildRawRecordsByCategory(snapshot: ContractorDecisionAuditSnapshot): Record<string, number> {
  return {
    contractors: snapshot.contractors.length,
    users: snapshot.users.length,
    workspaces: snapshot.workspaces.length,
    deals: snapshot.deals.length,
    opportunities: snapshot.opportunities.length,
    recommendations: snapshot.recommendations.length,
    assignments: snapshot.assignments.length,
    tenderPacks: snapshot.tenderPacks.length,
    submissionReviews: snapshot.submissionReviews.length,
    auditEvents: snapshot.auditEvents.length,
    activityRecords: snapshot.activityRecords.length,
    contractorDocuments: snapshot.contractorDocuments.length,
    relationships: snapshot.relationships.length,
  };
}

function toDocuments(snapshot: ContractorDecisionAuditSnapshot, contractorId: string): ContractorDocument[] {
  return snapshot.contractorDocuments
    .filter((document) => document.contractorId === contractorId)
    .map((document) => ({
      id: document.id,
      contractorId,
      documentType: str(document.data.documentType) ?? str(document.data.docType) ?? document.documentType ?? undefined,
      docType: str(document.data.docType) ?? undefined,
      status: str(document.data.status) ?? undefined,
      validationStatus: document.data.validationStatus === "PASS" || document.data.validationStatus === "REVIEW" || document.data.validationStatus === "FAIL" ? document.data.validationStatus : undefined,
      verified: document.data.verified === true,
      verifiedAt: num(document.data.verifiedAt) ?? undefined,
      updatedAt: num(document.data.updatedAt) ?? undefined,
      uploadedAt: num(document.data.uploadedAt) ?? undefined,
      createdAt: num(document.data.createdAt) ?? undefined,
      expiresAt: num(document.data.expiresAt) ?? num(document.data.expiryDate) ?? undefined,
      fileUrl: "redacted://metadata-present",
    }));
}

function historicalPositive(record: Record<string, unknown>): boolean {
  return record.readinessStatus === "READY" ||
    record.readinessDecisionStatus === "READY" ||
    record.overallStatus === "Approved / Compliant" ||
    record.complianceStatus === "complete" ||
    record.complianceApproved === true ||
    record.readinessScore === 100;
}

function businessKeys(record: SnapshotRecord): Array<{ basis: string; key: string }> {
  const sars = normalizeSarsRecord(record.data.sarsTcsSummary);
  const values = [
    { basis: "legalName", value: record.data.legalName },
    { basis: "tradingName", value: record.data.tradingName },
    { basis: "taxpayerName", value: record.data.taxpayerName ?? sars?.registeredTaxpayerName },
    { basis: "cipc", value: record.data.companyRegistrationNumber ?? record.data.registrationNumber },
    { basis: "csd", value: record.data.csdNumber ?? record.data.csdMNumber ?? record.data.mNumber },
    { basis: "workspaceBusinessName", value: `${record.data.workspaceId ?? ""}:${label(record.data) ?? ""}` },
  ];
  return values.map((item) => ({ basis: item.basis, key: norm(item.value) })).filter((item) => item.key.length >= 4);
}

export function validateContractorDecisionSnapshot(value: unknown): value is ContractorDecisionAuditSnapshot {
  if (!value || typeof value !== "object") return false;
  const snapshot = value as Partial<ContractorDecisionAuditSnapshot>;
  return Boolean(
    snapshot.metadata &&
    Array.isArray(snapshot.contractors) &&
    Array.isArray(snapshot.users) &&
    Array.isArray(snapshot.deals) &&
    Array.isArray(snapshot.contractorDocuments) &&
    Array.isArray(snapshot.relationships) &&
    snapshot.collectionStatistics &&
    snapshot.queryStatistics,
  );
}

export function auditContractorDecisionSnapshot(snapshot: ContractorDecisionAuditSnapshot): ContractorDecisionAuditReport {
  if (!validateContractorDecisionSnapshot(snapshot)) {
    throw new Error("Invalid contractor decision audit snapshot schema");
  }

  const rawRecordsByCategory = buildRawRecordsByCategory(snapshot);
  const eventDeduplication = buildEventDeduplication(snapshot);
  const contractorIdsForOrphans = new Set(snapshot.contractors.map((item) => safeId(item.data.contractorId) ?? item.id));
  const orphanedRelationshipCandidates = snapshot.relationships
    .filter((item) => item.targetType === "contractor" && !contractorIdsForOrphans.has(item.targetId))
    .sort((left, right) => `${left.sourceType}:${left.sourceId}`.localeCompare(`${right.sourceType}:${right.sourceId}`));

  const contractors = snapshot.contractors.map((contractor) => {
    const contractorId = safeId(contractor.data.contractorId) ?? contractor.id;
    const docs = toDocuments(snapshot, contractorId);
    const sarsRecord = normalizeSarsRecord(contractor.data.sarsTcsSummary);
    const decision = buildContractorRepositoryDecision({
      contractor: { ...contractor.data, contractorId, sarsTcsSummary: sarsRecord },
      documents: docs,
      evaluatedAt: snapshot.metadata.generatedAt,
    });
    const identity = resolveContractorBusinessIdentity(contractor.data);
    const identityValues = [
      contractor.data.legalName,
      contractor.data.tradingName,
      contractor.data.registeredBusinessName,
      contractor.data.businessName,
      contractor.data.companyName,
      contractor.data.name,
    ].map(cleanContractorIdentityText).filter((item): item is string => Boolean(item));
    const taxpayerName = str(contractor.data.taxpayerName) ?? str(sarsRecord?.registeredTaxpayerName);
    const cipcStatus = validateCipcRegistrationNumber(contractor.data.companyRegistrationNumber ?? contractor.data.registrationNumber);
    const csdStatus = validateCsdSupplierNumber(contractor.data.csdNumber ?? contractor.data.csdMNumber ?? contractor.data.mNumber);
    const linkedDeals = related(snapshot, contractorId, "deal");
    const linkedOpportunities = related(snapshot, contractorId, "opportunity");
    const linkedRecommendations = related(snapshot, contractorId, "recommendation");
    const linkedAssignments = related(snapshot, contractorId, "assignment");
    const linkedTenderPacks = related(snapshot, contractorId, "tenderPack");
    const linkedSubmissionReviews = related(snapshot, contractorId, "submissionReview");
    const auditActivityReferences = [
      ...related(snapshot, contractorId, "auditEvent"),
      ...related(snapshot, contractorId, "activityRecord"),
    ].sort();
    const activeDeals = snapshot.deals.filter((record) => linkedDeals.includes(record.id) && activeWorkflow(record));
    const activeAssignments = snapshot.assignments.filter((record) => linkedAssignments.includes(record.id) && activeWorkflow(record));
    const activeTenderPacks = snapshot.tenderPacks.filter((record) => linkedTenderPacks.includes(record.id) && activeWorkflow(record));
    const completedSubmissions = snapshot.submissionReviews.filter((record) => linkedSubmissionReviews.includes(record.id) && ["submitted", "complete", "completed"].some((value) => norm(record.data.status ?? record.data.stage ?? record.data.workflowStatus).includes(value)));
    const directDocuments = snapshot.contractorDocuments.filter((document) => document.contractorId === contractorId);
    const documentOwnershipConflict = snapshot.contractorDocuments.some((document) => document.contractorId === null && norm(document.data.contractorName) === norm(label(contractor.data)));
    const findings: ContractorDecisionAuditFinding[] = [];

    if (decision.identityStatus === "CONFLICT" || identity.status === "CONFLICT") addFinding(findings, { code: "IDENTITY_CONFLICT", severity: "HIGH", message: "Business identity evidence conflicts with canonical decision.", evidence: { identityStatus: decision.identityStatus } });
    if (decision.identityStatus === "UNRESOLVED" || identity.status === "UNRESOLVED") addFinding(findings, { code: "UNRESOLVED_IDENTITY", severity: "MEDIUM", message: "Business identity is unresolved.", evidence: { identityResolved: contractor.data.identityResolved ?? null } });
    for (const value of identityValues) {
      if (looksLikePersonalContractorIdentity(value)) addFinding(findings, { code: "PERSONAL_NAME_BUSINESS_IDENTITY", severity: "MEDIUM", message: "Personal name is used as contractor business identity.", evidence: { value } });
      if (looksLikePlaceholderContractorIdentity(value) || ["restored"].includes(norm(value))) addFinding(findings, { code: "PLACEHOLDER_BUSINESS_IDENTITY", severity: "MEDIUM", message: "Placeholder identity is used as contractor business identity.", evidence: { value } });
      if ([contractor.id, contractor.data.contractorId, contractor.data.uid, contractor.data.authUid, contractor.data.userId].map(norm).includes(norm(value))) addFinding(findings, { code: "TECHNICAL_ID_AS_BUSINESS_IDENTITY", severity: "HIGH", message: "Technical identifier is used as business identity.", evidence: { value } });
    }
    const businessLabelForMismatch = identity.label ?? label(contractor.data);
    if (taxpayerName && businessLabelForMismatch && norm(taxpayerName) !== norm(businessLabelForMismatch)) addFinding(findings, { code: "TAXPAYER_BUSINESS_MISMATCH", severity: "HIGH", message: "Taxpayer name differs materially from contractor business identity.", evidence: { taxpayerName, businessLabel: businessLabelForMismatch } });
    if (csdStatus !== "VALID") addFinding(findings, { code: "INVALID_OR_UNRESOLVED_CSD", severity: csdStatus === "INVALID" ? "HIGH" : "MEDIUM", message: "CSD supplier number is invalid or unresolved.", evidence: { csdStatus } });
    if (cipcStatus !== "VALID") addFinding(findings, { code: "INVALID_OR_UNRESOLVED_CIPC", severity: cipcStatus === "INVALID" ? "HIGH" : "MEDIUM", message: "CIPC registration number is invalid or unresolved.", evidence: { cipcStatus } });
    if (!str(contractor.data.workspaceId)) addFinding(findings, { code: "MISSING_WORKSPACE", severity: "HIGH", message: "Contractor has no workspace evidence.", evidence: {} });
    if (str(contractor.data.workspaceId) && linkedDeals.some((dealId) => {
      const deal = snapshot.deals.find((item) => item.id === dealId);
      return deal && str(deal.data.workspaceId) && str(deal.data.workspaceId) !== str(contractor.data.workspaceId);
    })) addFinding(findings, { code: "WORKSPACE_CONFLICT", severity: "HIGH", message: "Linked workflow has conflicting workspace evidence.", evidence: { workspaceId: contractor.data.workspaceId } });
    if (["admin", "staff", "manager"].includes(norm(contractor.data.role ?? contractor.data.userRole))) addFinding(findings, { code: "STAFF_ADMIN_CONTAMINATION", severity: "HIGH", message: "Staff/admin/manager role is present on contractor record.", evidence: { role: contractor.data.role ?? contractor.data.userRole } });
    if (contractor.data.identityResolved === true && !identity.identityResolved) addFinding(findings, { code: "IDENTITY_RESOLVED_WITHOUT_EVIDENCE", severity: "CRITICAL", message: "identityResolved is true without verified business identity evidence.", evidence: { evidenceFields: identity.evidenceFields } });
    if (contractor.data.identityResolved === undefined || !str(contractor.data.identityStatus)) addFinding(findings, { code: "MISSING_IDENTITY_STATUS", severity: "MEDIUM", message: "identityResolved or identityStatus is missing.", evidence: { identityResolved: contractor.data.identityResolved ?? null, identityStatus: contractor.data.identityStatus ?? null } });
    if (decision.stale) addFinding(findings, { code: "STALE_CANONICAL_DECISION", severity: historicalPositive(contractor.data) ? "HIGH" : "MEDIUM", message: "Current canonical decision is stale.", evidence: { staleReasons: decision.staleReasons } });
    if (historicalPositive(contractor.data) && decision.readinessDecisionStatus !== "READY") addFinding(findings, { code: "HISTORICAL_READY_NOW_BLOCKED", severity: "HIGH", message: "Stored READY/approved values conflict with current canonical decision.", evidence: { historical: decision.historicalDecision, current: decision.readinessDecisionStatus } });
    if (historicalPositive(contractor.data) && !contractor.data.decisionEvaluatedAt && !contractor.data.readinessUpdatedAt) addFinding(findings, { code: "MISSING_DECISION_TIMESTAMP", severity: "MEDIUM", message: "Historical positive decision has no decision timestamp.", evidence: {} });
    if (historicalPositive(contractor.data) && (contractor.data.decisionLogicVersion ?? contractor.data.logicVersion) !== CONTRACTOR_REPOSITORY_DECISION_LOGIC_VERSION) addFinding(findings, { code: "OUTDATED_DECISION_LOGIC", severity: "MEDIUM", message: "Historical positive decision has missing or outdated logic version.", evidence: { logicVersion: contractor.data.decisionLogicVersion ?? contractor.data.logicVersion ?? null } });
    if (decision.externalVerificationStatus !== "VERIFIED_COMPLIANT" && ["complete", "approved"].includes(norm(contractor.data.complianceStatus))) addFinding(findings, { code: "SARS_COMPLIANCE_INCONSISTENCY", severity: "HIGH", message: "Stored compliance state conflicts with SARS/external verification state.", evidence: { externalVerificationStatus: decision.externalVerificationStatus, complianceStatus: contractor.data.complianceStatus } });
    if (activeDeals.length) addFinding(findings, { code: "LINKED_ACTIVE_DEAL", severity: "HIGH", message: "Suspect contractor is linked to active deal records.", evidence: { dealIds: activeDeals.map((item) => item.id) } });
    if (activeAssignments.length) addFinding(findings, { code: "LINKED_ACTIVE_ASSIGNMENT", severity: "CRITICAL", message: "Suspect contractor is linked to active assignment records.", evidence: { assignmentIds: activeAssignments.map((item) => item.id) } });
    if (activeTenderPacks.length) addFinding(findings, { code: "LINKED_ACTIVE_TENDER_PACK", severity: "CRITICAL", message: "Suspect contractor is linked to active tender pack records.", evidence: { tenderPackIds: activeTenderPacks.map((item) => item.id) } });
    if (linkedSubmissionReviews.length) addFinding(findings, { code: "LINKED_SUBMISSION_REVIEW", severity: "HIGH", message: "Suspect contractor is linked to submission review records.", evidence: { submissionReviewIds: linkedSubmissionReviews } });
    if (documentOwnershipConflict) addFinding(findings, { code: "DOCUMENT_OWNERSHIP_CONFLICT", severity: "HIGH", message: "Document metadata appears linked by name but has no contractor ID.", evidence: { contractorLabel: label(contractor.data) } });

    const knownContext = norm(label(contractor.data)) === "mrk"
      ? [
          "Mr K was intentionally used as a test contractor identity.",
          "Genuine Torque Empire business documents may have been uploaded under this test identity.",
          "Historical workflow evidence must be preserved before any repair.",
        ]
      : undefined;

    const riskClassification = maxSeverity(findings);
    return {
      contractorId,
      workspaceId: str(contractor.data.workspaceId),
      safeDisplayLabel: label(contractor.data),
      identityStatus: decision.identityStatus,
      identityResolved: contractor.data.identityResolved === true ? true : contractor.data.identityResolved === false ? false : null,
      identityMatchStatus: decision.identityMatchStatus,
      cipcStatus,
      csdStatus,
      externalVerificationStatus: decision.externalVerificationStatus,
      documentCompleteness: decision.documentCompletenessScore,
      currentReadinessDecision: decision.readinessDecisionStatus,
      currentReadinessScore: decision.readinessScore,
      assignmentAllowed: decision.assignmentAllowed,
      historicalDecision: decision.historicalDecision,
      decisionTimestamp: contractor.data.decisionEvaluatedAt ?? contractor.data.readinessUpdatedAt ?? null,
      logicVersion: contractor.data.decisionLogicVersion ?? contractor.data.logicVersion ?? null,
      stale: decision.stale,
      blockingReasons: decision.blockingReasons,
      linkedUserRelationshipType: related(snapshot, contractorId, "user").length ? "linked_user" : "none",
      linkedDeals,
      linkedOpportunities,
      linkedRecommendations,
      linkedAssignments,
      linkedTenderPacks,
      linkedSubmissionReviews,
      linkedDocumentsCount: docs.length,
      relationshipBreakdown: relationshipBreakdown(snapshot, contractorId),
      evidenceSummary: {
        storedIdentityFields: redactAuditRecord({
          companyName: contractor.data.companyName,
          businessName: contractor.data.businessName,
          registeredBusinessName: contractor.data.registeredBusinessName,
          legalName: contractor.data.legalName,
          tradingName: contractor.data.tradingName,
          name: contractor.data.name,
          displayName: contractor.data.displayName,
          contractorName: contractor.data.contractorName,
          identityStatus: contractor.data.identityStatus,
          identityResolved: contractor.data.identityResolved,
          identityMatchStatus: contractor.data.identityMatchStatus,
          recordClassification: contractor.data.recordClassification,
        }),
        businessIdentityEvidence: redactAuditRecord({
          taxpayerName,
          registeredTaxpayerName: sarsRecord?.registeredTaxpayerName,
          sarsTcsSummary: sarsRecord,
          externalVerificationStatus: decision.externalVerificationStatus,
          companyRegistrationNumber: contractor.data.companyRegistrationNumber ?? contractor.data.registrationNumber,
          csdNumber: contractor.data.csdNumber ?? contractor.data.csdMNumber ?? contractor.data.mNumber,
        }),
        ownsUploadedDocumentsDirectly: directDocuments.length > 0 && directDocuments.every((document) => document.contractorId === contractorId),
        separateCanonicalTorqueEmpireRecordAppears: snapshot.contractors.some((item) => (safeId(item.data.contractorId) ?? item.id) !== contractorId && norm(label(item.data) ?? item.data.taxpayerName ?? normalizeSarsRecord(item.data.sarsTcsSummary)?.registeredTaxpayerName).includes("torqueempire")),
        activeAssignmentEvidence: activeAssignments.length > 0,
        tenderPackGenerated: linkedTenderPacks.length > 0,
        submissionCompleted: completedSubmissions.length > 0,
        documentOwnershipConflict,
        orphanedRecordsExist: orphanedRelationshipCandidates.length > 0,
        missingWorkspaceRepairBlocker: !str(contractor.data.workspaceId),
        opportunityExecutionRecordsPresent: linkedOpportunities.length > 0,
        retainedInternalIdsRequiredForAllowlist: linkedDeals.length > 0 || linkedAssignments.length > 0 || linkedTenderPacks.length > 0 || linkedSubmissionReviews.length > 0 || directDocuments.length > 0 || auditActivityReferences.length > 0,
      },
      auditActivityReferences,
      findings,
      riskClassification,
      recommendedFutureAction: riskClassification === "INFORMATIONAL" ? "No action required." : "Manual business verification and allowlisted repair design required. Do not mutate records from this report.",
      manualBusinessVerificationRequired: riskClassification !== "INFORMATIONAL",
      ...(knownContext ? { knownContext } : {}),
    } satisfies ContractorDecisionAuditContractor;
  }).sort((left, right) => severityRank(right.riskClassification) - severityRank(left.riskClassification) || left.contractorId.localeCompare(right.contractorId));

  const duplicateGroups = new Map<string, { basis: string; ids: string[] }>();
  for (const contractor of snapshot.contractors) {
    for (const key of businessKeys(contractor)) {
      const mapKey = `${key.basis}:${key.key}`;
      const group = duplicateGroups.get(mapKey) ?? { basis: key.basis, ids: [] };
      group.ids.push(safeId(contractor.data.contractorId) ?? contractor.id);
      duplicateGroups.set(mapKey, group);
    }
  }
  const duplicateCandidates = [...duplicateGroups.entries()]
    .filter(([, group]) => new Set(group.ids).size > 1)
    .map(([key, group]) => ({
      basis: group.basis,
      key,
      contractorIds: Array.from(new Set(group.ids)).sort(),
      severity: group.basis === "cipc" || group.basis === "csd" ? "HIGH" as const : "MEDIUM" as const,
      recommendation: "Do not merge automatically. Compare source documents, assignments, user linkage, workspace, and audit history.",
    }))
    .sort((left, right) => left.key.localeCompare(right.key));

  const orphanedRelationships = orphanedRelationshipCandidates;

  const countsBySeverity = {
    CRITICAL: contractors.filter((item) => item.riskClassification === "CRITICAL").length,
    HIGH: contractors.filter((item) => item.riskClassification === "HIGH").length,
    MEDIUM: contractors.filter((item) => item.riskClassification === "MEDIUM").length,
    LOW: contractors.filter((item) => item.riskClassification === "LOW").length,
    INFORMATIONAL: contractors.filter((item) => item.riskClassification === "INFORMATIONAL").length,
  };

  const recommendedRemediationGroups = [
    { group: "identity-conflict", contractorIds: contractors.filter((item) => item.findings.some((finding) => finding.code.includes("IDENTITY") || finding.code.includes("TAXPAYER"))).map((item) => item.contractorId), recommendation: "Verify legal business identity and design allowlisted identity correction." },
    { group: "workflow-linked", contractorIds: contractors.filter((item) => item.linkedAssignments.length || item.linkedTenderPacks.length || item.linkedDeals.length).map((item) => item.contractorId), recommendation: "Review workflow dependencies before relinking or archiving any record." },
    { group: "stale-decision", contractorIds: contractors.filter((item) => item.stale).map((item) => item.contractorId), recommendation: "Recompute only after approved repair plan and source evidence backup." },
  ].map((group) => ({ ...group, contractorIds: Array.from(new Set(group.contractorIds)).sort() })).filter((group) => group.contractorIds.length > 0);

  const proposedFirstRepairCandidates = contractors
    .filter((item) => item.knownContext?.some((context) => context.includes("Mr K")))
    .map((item) => ({
      contractorId: item.contractorId,
      reason: "Known test identity with genuine Torque Empire document/workflow context and blocked canonical decision.",
      requiredControls: ["Firestore export backup", "Auth linkage export", "Document metadata export", "Allowlisted target contractor ID", "Dry-run diff", "Rollback plan", "Independent verification"],
    }));

  const summary = {
    totalContractorsReviewed: contractors.length,
    countsBySeverity,
    suspectContractors: contractors.filter((item) => item.riskClassification !== "INFORMATIONAL").length,
    duplicateCandidateGroups: duplicateCandidates.length,
    affectedDeals: new Set(contractors.flatMap((item) => item.linkedDeals)).size,
    affectedRecommendations: new Set(contractors.flatMap((item) => item.linkedRecommendations)).size,
    affectedAssignments: new Set(contractors.flatMap((item) => item.linkedAssignments)).size,
    affectedTenderPacks: new Set(contractors.flatMap((item) => item.linkedTenderPacks)).size,
    affectedSubmissionReviews: new Set(contractors.flatMap((item) => item.linkedSubmissionReviews)).size,
    staleDecisionCount: contractors.filter((item) => item.stale).length,
    invalidCsdCount: contractors.filter((item) => item.csdStatus === "INVALID").length,
    invalidCipcCount: contractors.filter((item) => item.cipcStatus === "INVALID").length,
    workspaceIssueCount: contractors.filter((item) => item.findings.some((finding) => finding.code.includes("WORKSPACE"))).length,
    staffAdminContaminationCount: contractors.filter((item) => item.findings.some((finding) => finding.code === "STAFF_ADMIN_CONTAMINATION")).length,
    orphanedRelationshipCount: orphanedRelationships.length,
    rawRecordsByCategory,
    eventDeduplication,
  };

  const remediationOptions = buildRemediationOptions(contractors);
  const generatedAt = snapshot.metadata.generatedAt;
  const markdown = buildMarkdownReport({ generatedAt, summary, contractors, duplicateCandidates, orphanedRelationships, proposedFirstRepairCandidates, remediationOptions });
  return {
    metadata: {
      generatedAt,
      auditLogicVersion: CONTRACTOR_DECISION_AUDIT_LOGIC_VERSION,
      snapshotSchemaVersion: snapshot.metadata.snapshotSchemaVersion,
      sourceGeneratedAt: snapshot.metadata.generatedAt,
    },
    summary,
    contractors,
    duplicateCandidates,
    orphanedRelationships,
    recommendedRemediationGroups,
    remediationOptions,
    proposedFirstRepairCandidates,
    markdown,
  };
}

function buildRemediationOptions(contractors: ContractorDecisionAuditContractor[]): ContractorDecisionAuditRemediationOption[] {
  const hasWorkflowEvidence = contractors.some((item) => item.linkedDeals.length || item.linkedAssignments.length || item.linkedTenderPacks.length || item.linkedSubmissionReviews.length);
  const hasDocumentEvidence = contractors.some((item) => item.linkedDocumentsCount > 0);
  const hasIdentityConflict = contractors.some((item) => item.findings.some((finding) => finding.code === "IDENTITY_CONFLICT" || finding.code === "TAXPAYER_BUSINESS_MISMATCH"));
  return [
    {
      option: "A. Promote and rename the existing Mr K contractor record into the canonical Torque Empire contractor entity.",
      status: hasIdentityConflict ? "CONDITIONAL" : "RECOMMENDED",
      benefits: ["Preserves direct document ownership and workflow continuity.", "Avoids broad relinking if the existing record is accepted as the canonical target."],
      risks: ["Carries test identity history into the canonical entity.", "Requires careful auth/user linkage review before any positive business decision is restored."],
      documentImpact: hasDocumentEvidence ? "Directly linked documents can remain attached, subject to metadata correction and evidence review." : "No direct document impact found in snapshot.",
      dealImpact: hasWorkflowEvidence ? "Existing deal references remain stable but must be revalidated as historical or active before assignment is allowed." : "No linked deal impact found in snapshot.",
      userAuthLinkageImpact: "Must verify user/auth linkage separately; do not infer authority from contractor ID alone.",
      auditContinuity: "Strong continuity because the original record and audit history remain together.",
      duplicateRisk: "Medium if a separate canonical Torque Empire record already exists outside this snapshot.",
      rollbackComplexity: "MEDIUM",
    },
    {
      option: "B. Create or use a separate canonical Torque Empire contractor record and relink documents, deals, and audit history from Mr K.",
      status: "NOT_RECOMMENDED",
      benefits: ["Separates test identity from canonical business identity.", "Allows a clean canonical profile if one is confirmed."],
      risks: ["High relink scope across documents, deals, users, and audit trails.", "Creates duplicate or orphan risk if any relationship is missed."],
      documentImpact: "Requires allowlisted document metadata relinking or approved evidence copy strategy.",
      dealImpact: "Requires allowlisted deal relationship updates and post-repair verification.",
      userAuthLinkageImpact: "Auth/user relationship must be exported, backed up, and explicitly mapped.",
      auditContinuity: "Weaker unless original source references are preserved on every repaired record.",
      duplicateRisk: "High without a confirmed target canonical record and dry-run diff.",
      rollbackComplexity: "HIGH",
    },
    {
      option: "C. Preserve Mr K as a clearly marked test/archive record and copy only approved evidence into a canonical Torque Empire contractor record.",
      status: "CONDITIONAL",
      benefits: ["Maintains historical test context.", "Reduces risk of treating the test identity as a live business profile."],
      risks: ["Copied evidence may lose direct provenance if not explicitly cross-referenced.", "Requires manual sign-off on which documents are valid evidence."],
      documentImpact: "Copy only approved metadata/evidence after backup; never delete original documents from this audit basis.",
      dealImpact: "Historical deal evidence should remain preserved unless a repair plan explicitly relinks selected records.",
      userAuthLinkageImpact: "Avoid copying auth authority; establish canonical user linkage through approved identity controls.",
      auditContinuity: "Good if archive markers and cross-references are added in an approved future repair.",
      duplicateRisk: "Medium until canonical target identity is independently verified.",
      rollbackComplexity: "MEDIUM",
    },
    {
      option: "D. Freeze assignment, preserve Mr K evidence, verify/create canonical Torque Empire target, then perform an allowlisted dry-run repair plan.",
      status: "RECOMMENDED",
      benefits: ["Fails closed while preserving evidence.", "Defers mutation until identity, workspace, auth, documents, and workflow references are backed up and allowlisted."],
      risks: ["Requires an additional controlled repair phase.", "Does not immediately normalize the record."],
      documentImpact: "Preserve current ownership evidence; only relink or copy after approved allowlist and backup.",
      dealImpact: "Keep linked deals blocked from assignment until repair is verified.",
      userAuthLinkageImpact: "Requires explicit auth/user export and target mapping before any write.",
      auditContinuity: "Strongest because no historical evidence is discarded and future changes can reference this audit.",
      duplicateRisk: "Lowest once canonical target is verified before mutation.",
      rollbackComplexity: "LOW",
    },
  ];
}

function buildMarkdownReport(input: {
  generatedAt: string;
  summary: ContractorDecisionAuditReport["summary"];
  contractors: ContractorDecisionAuditContractor[];
  duplicateCandidates: ContractorDecisionAuditReport["duplicateCandidates"];
  orphanedRelationships: ContractorDecisionAuditRelationship[];
  proposedFirstRepairCandidates: ContractorDecisionAuditReport["proposedFirstRepairCandidates"];
  remediationOptions: ContractorDecisionAuditRemediationOption[];
}): string {
  const lines = [
    "# Contractor Decision Audit",
    "",
    `Generated: ${input.generatedAt}`,
    `Logic version: ${CONTRACTOR_DECISION_AUDIT_LOGIC_VERSION}`,
    "",
    "## Summary",
    `- Contractors reviewed: ${input.summary.totalContractorsReviewed}`,
    `- Suspect contractors: ${input.summary.suspectContractors}`,
    `- Severity counts: ${Object.entries(input.summary.countsBySeverity).map(([key, value]) => `${key}=${value}`).join(", ")}`,
    `- Duplicate candidate groups: ${input.summary.duplicateCandidateGroups}`,
    `- Orphaned relationships: ${input.summary.orphanedRelationshipCount}`,
    `- Event records: raw=${input.summary.eventDeduplication.rawEventCount}, deduplicated=${input.summary.eventDeduplication.deduplicatedEventCount}, duplicatesRemoved=${input.summary.eventDeduplication.duplicateCountRemoved}`,
    `- Event deduplication key: ${input.summary.eventDeduplication.deduplicationKey}`,
    "",
    "## Suspect Contractors",
    ...input.contractors
      .filter((contractor) => contractor.riskClassification !== "INFORMATIONAL")
      .map((contractor) => `- ${contractor.riskClassification} ${contractor.safeDisplayLabel ?? "Unknown contractor"}: ${contractor.findings.map((finding) => finding.code).join(", ")}`),
    "",
    "## Evidence Summary",
    ...input.contractors.map((contractor) => [
      `- ${contractor.safeDisplayLabel ?? "Unknown contractor"}: readiness=${contractor.currentReadinessDecision}, assignmentAllowed=${contractor.assignmentAllowed}, directDocuments=${contractor.evidenceSummary.ownsUploadedDocumentsDirectly}, tenderPackGenerated=${contractor.evidenceSummary.tenderPackGenerated}, submissionCompleted=${contractor.evidenceSummary.submissionCompleted}`,
      `  - Relationships: ${Object.entries(contractor.relationshipBreakdown).map(([key, value]) => `${key}=${value}`).join(", ") || "none"}`,
    ].join("\n")),
    "",
    "## Duplicate Candidates",
    ...input.duplicateCandidates.map((group) => `- ${group.severity} ${group.basis}: ${group.contractorIds.length} linked records (${group.recommendation})`),
    "",
    "## Remediation Options",
    ...input.remediationOptions.map((option) => `- ${option.status} ${option.option}`),
    "",
    "## Proposed First Repair Candidates",
    ...input.proposedFirstRepairCandidates.map((candidate) => `- ${candidate.reason}`),
    "",
    "## Required Future Repair Controls",
    "- Read-only audit sign-off",
    "- Firestore/Auth/document metadata backup",
    "- Allowlisted source and target record IDs",
    "- Dry-run diff with rollback plan",
    "- Independent post-repair verification",
    "",
  ];
  return lines.join("\n");
}




