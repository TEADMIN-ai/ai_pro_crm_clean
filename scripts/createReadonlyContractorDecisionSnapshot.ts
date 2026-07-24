import fs from "node:fs";
import path from "node:path";
import { loadEnvConfig } from "@next/env";
import {
  CONTRACTOR_DECISION_AUDIT_LOGIC_VERSION,
  CONTRACTOR_DECISION_SNAPSHOT_SCHEMA_VERSION,
  redactAuditRecord,
  sanitizeDocumentMetadata,
  type ContractorDecisionAuditRelationship,
  type ContractorDecisionAuditSnapshot,
  type ContractorDocumentSnapshotRecord,
  type SnapshotRecord,
} from "../src/lib/contractors/contractorDecisionAudit";

type CliOptions = {
  production: boolean;
  confirmProductionReadonly: boolean;
  planOnly: boolean;
  output: string | null;
  contractorId: string | null;
};

type SnapshotBucket = keyof Pick<ContractorDecisionAuditSnapshot, "users" | "workspaces" | "deals" | "opportunities" | "recommendations" | "assignments" | "tenderPacks" | "submissionReviews" | "auditEvents" | "activityRecords">;
type QueryStrategy = "direct-document-read" | "indexed-contractor-query" | "linked-deal-query" | "linked-opportunity-query" | "linked-workspace-query" | "subcollection-read" | "bounded-scan-required" | "skipped";
type SourceConfig = { collection: string; bucket: SnapshotBucket; sourceType: string; verifiedBy: string; contractorFields?: string[]; userFields?: string[]; workspaceFields?: string[]; dealFields?: string[]; opportunityFields?: string[]; includeInScopedAudit: boolean };
export type CollectionPlan = { collection: string; strategy: QueryStrategy; relationshipField: string | null; predictedQueryCount: number; indexMayBeRequired: boolean; included: boolean; reason: string; couldMissEvidence: boolean; explicitScanApprovalRequired: boolean; verifiedBy: string };
type MutableSnapshot = ContractorDecisionAuditSnapshot & { [key: string]: unknown };

export const READONLY_CONTRACTOR_DECISION_SNAPSHOT_VERSION = "readonly-contractor-decision-snapshot-v2";
export const VERIFIED_COLLECTION_PATHS = {
  contractors: "contractors",
  users: "users",
  deals: "deals",
  opportunities: "opportunityExecutionWorkspaces",
  submissionReviews: "submissionReviews",
  tenderPacks: "tenderPacks",
  tenderPackRequests: "tenderPackRequests",
  legacyPackRequests: "packRequests",
  submissions: "submissions",
  contractorDocuments: "contractorDocuments",
  topLevelDocuments: "documents",
  documentAnalysis: "documentAnalysis",
  documentAnalyses: "documentAnalyses",
  auditLogs: "auditLogs",
  auditEvents: "auditEvents",
  governanceEvents: "governanceEvents",
  decisionLogs: "decisionLogs",
  contractorActivity: "contractorActivity",
  contractorNotes: "contractorNotes",
  workspaceMembers: "workspaceMembers",
  contractorDocumentSubcollection: "contractors/{contractorId}/documents",
  dealActivitySubcollection: "deals/{dealId}/activity",
  dealDocumentSubcollection: "deals/{dealId}/documents",
} as const;

const SOURCE_CONFIGS: SourceConfig[] = [
  { collection: "users", bucket: "users", sourceType: "user", verifiedBy: "scripts/maintenance/productionDataCleanup.ts; src/server/services/userService.ts", contractorFields: ["contractorId"], userFields: ["uid", "authUid", "userId"], workspaceFields: ["workspaceId"], includeInScopedAudit: true },
  { collection: "workspaceMembers", bucket: "workspaces", sourceType: "workspaceMember", verifiedBy: "src/lib/maintenance/contractorWorkspaceRecovery.ts", contractorFields: ["contractorId"], workspaceFields: ["workspaceId"], includeInScopedAudit: true },
  { collection: "deals", bucket: "deals", sourceType: "deal", verifiedBy: "scripts/maintenance/productionDataCleanup.ts; src/server/services/dealService.ts; src/app/api/opportunity-register/route.ts", contractorFields: ["contractorId", "linkedContractorId", "assignedContractorId", "companyId"], userFields: ["userId", "ownerId"], workspaceFields: ["workspaceId"], includeInScopedAudit: true },
  { collection: "opportunityExecutionWorkspaces", bucket: "opportunities", sourceType: "opportunity", verifiedBy: "src/server/services/opportunityExecutionService.ts", contractorFields: ["contractorId"], dealFields: ["dealId"], opportunityFields: ["opportunityId"], workspaceFields: ["workspaceId"], includeInScopedAudit: true },
  { collection: "tenderPacks", bucket: "tenderPacks", sourceType: "tenderPack", verifiedBy: "scripts/maintenance/productionDataCleanup.ts; src/server/services/tenderPackService.ts", contractorFields: ["contractorId"], dealFields: ["dealId"], userFields: ["userId"], includeInScopedAudit: true },
  { collection: "tenderPackRequests", bucket: "tenderPacks", sourceType: "tenderPack", verifiedBy: "scripts/maintenance/productionDataCleanup.ts; src/server/services/tenderPackRequestService.ts", contractorFields: ["contractorId"], dealFields: ["dealId"], userFields: ["requestedBy", "userId"], includeInScopedAudit: true },
  { collection: "packRequests", bucket: "tenderPacks", sourceType: "tenderPack", verifiedBy: "scripts/reportContractorCleanupCandidates.ts", contractorFields: ["contractorId"], dealFields: ["dealId"], includeInScopedAudit: true },
  { collection: "submissions", bucket: "submissionReviews", sourceType: "submissionReview", verifiedBy: "scripts/reportContractorCleanupCandidates.ts", contractorFields: ["contractorId"], dealFields: ["dealId"], opportunityFields: ["opportunityId"], workspaceFields: ["workspaceId"], includeInScopedAudit: true },
  { collection: "submissionReviews", bucket: "submissionReviews", sourceType: "submissionReview", verifiedBy: "src/server/services/opportunityExecutionService.ts; src/app/api/submission-review/route.ts", contractorFields: ["contractorId"], dealFields: ["dealId"], opportunityFields: ["opportunityId"], workspaceFields: ["workspaceId"], includeInScopedAudit: true },
  { collection: "auditLogs", bucket: "auditEvents", sourceType: "auditEvent", verifiedBy: "scripts/maintenance/productionDataCleanup.ts; src/server/services/intelligenceCenterService.ts", contractorFields: ["contractorId", "entityId", "targetId"], dealFields: ["dealId"], userFields: ["userId", "actorId"], includeInScopedAudit: true },
  { collection: "auditEvents", bucket: "auditEvents", sourceType: "auditEvent", verifiedBy: "scripts/reportContractorCleanupCandidates.ts", contractorFields: ["contractorId", "entityId", "targetId", "subjectId", "resourceId"], dealFields: ["dealId"], userFields: ["userId", "actorId"], includeInScopedAudit: true },
  { collection: "governanceEvents", bucket: "auditEvents", sourceType: "auditEvent", verifiedBy: "scripts/reportContractorCleanupCandidates.ts", contractorFields: ["contractorId", "entityId", "targetId", "subjectId", "resourceId"], dealFields: ["dealId"], userFields: ["userId", "actorId"], includeInScopedAudit: true },
  { collection: "decisionLogs", bucket: "auditEvents", sourceType: "auditEvent", verifiedBy: "src/server/services/intelligenceCenterService.ts; scripts/maintenance/productionDataCleanup.ts", contractorFields: ["contractorId"], userFields: ["userId"], includeInScopedAudit: true },
  { collection: "contractorActivity", bucket: "activityRecords", sourceType: "activityRecord", verifiedBy: "src/lib/activity/logActivity.ts; scripts/maintenance/productionDataCleanup.ts", contractorFields: ["contractorId"], userFields: ["userId"], dealFields: ["dealId"], includeInScopedAudit: true },
  { collection: "contractorNotes", bucket: "activityRecords", sourceType: "activityRecord", verifiedBy: "src/server/services/contractorCommandCenterService.ts", contractorFields: ["contractorId"], userFields: ["authorId"], includeInScopedAudit: true },
];
const DOCUMENT_SOURCE_CONFIGS: SourceConfig[] = [
  { collection: "contractorDocuments", bucket: "activityRecords", sourceType: "contractorDocument", verifiedBy: "scripts/reportContractorCleanupCandidates.ts", contractorFields: ["contractorId"], dealFields: ["dealId"], includeInScopedAudit: true },
  { collection: "documents", bucket: "activityRecords", sourceType: "contractorDocument", verifiedBy: "scripts/maintenance/productionDataCleanup.ts; src/app/api/tender/generate/route.ts", contractorFields: ["contractorId"], dealFields: ["dealId"], userFields: ["uploadedBy"], includeInScopedAudit: true },
  { collection: "documentAnalysis", bucket: "activityRecords", sourceType: "contractorDocument", verifiedBy: "scripts/reportContractorCleanupCandidates.ts", contractorFields: ["contractorId"], dealFields: ["dealId"], includeInScopedAudit: true },
  { collection: "documentAnalyses", bucket: "activityRecords", sourceType: "contractorDocument", verifiedBy: "scripts/reportContractorCleanupCandidates.ts", contractorFields: ["contractorId"], dealFields: ["dealId"], includeInScopedAudit: true },
];
const CONTRACTOR_ID_FIELDS = ["contractorId", "linkedContractorId", "assignedContractorId", "contractorUid", "uid", "authUid", "userId", "ownerId", "clientId", "organisationId", "organizationId", "entityId", "targetId", "subjectId", "resourceId"];

function str(value: unknown): string | null { return typeof value === "string" && value.trim().length > 0 ? value.trim() : null; }
function rawRecord(value: unknown): Record<string, unknown> { return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {}; }
function unique(values: Array<string | null | undefined>): string[] { return Array.from(new Set(values.filter((item): item is string => Boolean(item)))).sort(); }
function writeJsonFile(output: string, payload: unknown): void { fs.mkdirSync(path.dirname(output), { recursive: true }); fs.writeFileSync(output, `${JSON.stringify(payload, null, 2)}\n`, "utf8"); }

export function parseReadonlySnapshotArgs(argv = process.argv.slice(2)): CliOptions {
  const options: CliOptions = { production: false, confirmProductionReadonly: false, planOnly: false, output: null, contractorId: null };
  for (const arg of argv) {
    if (arg === "--production") options.production = true;
    else if (arg === "--confirm-production-readonly") options.confirmProductionReadonly = true;
    else if (arg === "--plan-only") options.planOnly = true;
    else if (arg.startsWith("--output=")) options.output = arg.slice("--output=".length);
    else if (arg.startsWith("--contractor-id=")) options.contractorId = arg.slice("--contractor-id=".length).trim() || null;
    else if (["--all", "--broad", "--scan-all"].includes(arg) || arg.startsWith("--limit=") || arg.startsWith("--allowlist=") || arg.startsWith("--allow-bounded-scan=")) throw new Error(`Unsupported unsafe snapshot option: ${arg}. Explicit --contractor-id is mandatory and broad scans are disabled.`);
    else throw new Error(`Unknown snapshot option: ${arg}`);
  }
  if (!options.contractorId) throw new Error("Missing required --contractor-id=<id>; contractor-scoped execution is mandatory.");
  return options;
}
export function createReadonlySnapshotPlan(options: CliOptions) {
  if (!options.contractorId?.trim()) throw new Error("Missing required --contractor-id=<id>; contractor-scoped execution is mandatory.");
  const contractorScope = 1;
  const collectionPlans = buildCollectionPlans(options);
  const unresolvedRelationshipPaths = collectionPlans.filter((item) => item.strategy === "skipped" && item.couldMissEvidence).map((item) => item.collection);
  const directReads = collectionPlans.filter((item) => item.strategy === "direct-document-read").reduce((sum, item) => sum + item.predictedQueryCount, 0);
  const subcollectionReads = collectionPlans.filter((item) => item.strategy === "subcollection-read").reduce((sum, item) => sum + item.predictedQueryCount, 0);
  const targetedQueries = collectionPlans.filter((item) => ["indexed-contractor-query", "linked-deal-query", "linked-opportunity-query", "linked-workspace-query"].includes(item.strategy)).reduce((sum, item) => sum + item.predictedQueryCount, 0);
  return {
    script: "scripts/createReadonlyContractorDecisionSnapshot.ts",
    mode: "scoped",
    productionRequiredFlags: ["--production", "--confirm-production-readonly", "--output=<path>"],
    planOnlyPerformsProductionRead: false,
    localOutputsOnly: true,
    verifiedCollectionPaths: VERIFIED_COLLECTION_PATHS,
    collectionPlans,
    topLevelCollectionReads: collectionPlans.filter((item) => item.included && item.strategy !== "subcollection-read" && item.strategy !== "direct-document-read").map((item) => item.collection),
    subcollectionReadPaths: [VERIFIED_COLLECTION_PATHS.contractorDocumentSubcollection, VERIFIED_COLLECTION_PATHS.dealActivitySubcollection, VERIFIED_COLLECTION_PATHS.dealDocumentSubcollection],
    predictedQueryPattern: {
      contractorScope,
      limitApplied: null,
      limitIgnoredInScopedMode: false,
      topLevelCollectionQueries: targetedQueries,
      nPlusOneSubcollectionQueries: ["One contractors/{id}/documents read per selected contractor.", "One deals/{id}/activity and one deals/{id}/documents read per linked deal."],
      notes: "Contractor-scoped mode only: direct contractor reads, exact relationship queries, linked deal/opportunity follow-up queries, and linked deal subcollections.",
    },
    targetedQueries,
    directReads,
    subcollectionReads,
    boundedScansRequired: [],
    unresolvedRelationshipPaths,
    productionExecutionAllowed: unresolvedRelationshipPaths.length === 0,
    explicitScanApprovals: [],
    redaction: "Central allowlisted redaction in src/lib/contractors/contractorDecisionAudit.ts; raw document contents and contact data are omitted.",
  };
}

function buildCollectionPlans(options: CliOptions): CollectionPlan[] {
  return [
    plan("contractors", "direct-document-read", "documentId", 1, true, "Contractor-scoped execution reads exactly the supplied contractor document ID.", false, false, "src/server/services/contractorService.ts"),
    ...SOURCE_CONFIGS.flatMap((source) => scopedPlansForSource(source)),
    ...DOCUMENT_SOURCE_CONFIGS.flatMap((source) => scopedPlansForSource(source)),
    plan(VERIFIED_COLLECTION_PATHS.contractorDocumentSubcollection, "subcollection-read", "contractorId", 1, true, "Read only the supplied contractors/{id}/documents subcollection.", false, false, "src/server/services/contractorService.ts"),
    plan(VERIFIED_COLLECTION_PATHS.dealActivitySubcollection, "subcollection-read", "dealId", 1, true, "Read only activity subcollections for deal IDs discovered by scoped queries.", false, false, "src/server/services/dealService.ts"),
    plan(VERIFIED_COLLECTION_PATHS.dealDocumentSubcollection, "subcollection-read", "dealId", 1, true, "Read only document subcollections for deal IDs discovered by scoped queries.", false, false, "src/server/services/dealService.ts"),
    plan("recommendations", "skipped", null, 0, false, "No verified direct relationship path; unresolved without a broad scan.", true, false, "src/lib/contractors/contractorIdentityAudit.ts test fixture only"),
    plan("assignments", "skipped", null, 0, false, "No verified direct relationship path; unresolved without a broad scan.", true, false, "src/lib/kpis/enterpriseSnapshot.ts; src/app/api/opportunity-register/route.ts"),
  ];
}

function scopedPlansForSource(source: SourceConfig): CollectionPlan[] {
  const out: CollectionPlan[] = [];
  if (source.contractorFields?.length) out.push(plan(source.collection, "indexed-contractor-query", source.contractorFields.join(","), source.contractorFields.length, true, "Query verified contractor relationship fields for selected contractor IDs.", false, false, source.verifiedBy));
  if (source.dealFields?.length) out.push(plan(source.collection, "linked-deal-query", source.dealFields.join(","), source.dealFields.length, true, "Query verified deal relationship fields after linked deal IDs are discovered.", false, false, source.verifiedBy));
  if (source.opportunityFields?.length) out.push(plan(source.collection, "linked-opportunity-query", source.opportunityFields.join(","), source.opportunityFields.length, true, "Query verified opportunity relationship fields after linked opportunity IDs are discovered.", false, false, source.verifiedBy));
  if (source.workspaceFields?.length) out.push(plan(source.collection, "linked-workspace-query", source.workspaceFields.join(","), source.workspaceFields.length, true, "Query workspace relationship fields only for workspace evidence discovered from selected contractors/workflows.", true, false, source.verifiedBy));
  if (!out.length && source.includeInScopedAudit) out.push(plan(source.collection, "bounded-scan-required", null, 1, false, "No verified direct relationship field is available for scoped mode.", true, true, source.verifiedBy));
  return out;
}

function plan(collection: string, strategy: QueryStrategy, relationshipField: string | null, predictedQueryCount: number, included: boolean, reason: string, couldMissEvidence: boolean, explicitScanApprovalRequired: boolean, verifiedBy: string): CollectionPlan {
  return { collection, strategy, relationshipField, predictedQueryCount, indexMayBeRequired: ["indexed-contractor-query", "linked-deal-query", "linked-opportunity-query", "linked-workspace-query"].includes(strategy), included, reason, couldMissEvidence, explicitScanApprovalRequired, verifiedBy };
}

export function assertReadonlySnapshotExecutionAllowed(options: CliOptions): void {
  if (!options.contractorId?.trim()) throw new Error("Missing required --contractor-id=<id>; contractor-scoped execution is mandatory.");
  if (!options.contractorId?.trim()) throw new Error("Missing required --contractor-id=<id>; contractor-scoped execution is mandatory.");
  if (options.planOnly) return;
  if (!options.production || !options.confirmProductionReadonly || !options.output) throw new Error("Refusing execution. Required: --production --confirm-production-readonly --output=<path>. Use --plan-only for a no-read plan.");
  const executionPlan = createReadonlySnapshotPlan(options);
  if (!executionPlan.productionExecutionAllowed) throw new Error(`Refusing contractor-scoped execution. Unresolved relationship paths remain: ${executionPlan.unresolvedRelationshipPaths.join(", ")}`);
}

export function assertCollectorSourceReadOnly(source = fs.readFileSync(__filename, "utf8")): void {
  const writeMethods = ["s" + "et", "upd" + "ate", "del" + "ete", "cre" + "ate", "a" + "dd"];
  const writeRegex = new RegExp(`\\.(${writeMethods.join("|")})\\s*\\(`);
  const forbiddenImports = ["firebase-admin/" + "auth", "firebase-admin/" + "storage", "getFirebase" + "StorageBucket"];
  const forbiddenWriteHelpers = ["run" + "Transaction", "bulk" + "Writer", "write" + "Batch", "." + "batch("];
  if (writeRegex.test(source) || forbiddenWriteHelpers.some((token) => source.includes(token))) throw new Error("Collector source contains a remote write-capable Firestore operation.");
  for (const token of forbiddenImports) if (source.includes(token)) throw new Error(`Collector source imports or references forbidden production mutation surface: ${token}`);
}

function toSnapshotRecord(collection: string, id: string, data: Record<string, unknown>, prefix = collection): SnapshotRecord { return { id, collection, path: `${prefix}/${id}`, data: redactAuditRecord({ id, ...data }) }; }
function toDocumentRecord(collection: string, id: string, data: Record<string, unknown>, prefix = collection, fallbackContractorId: string | null = null): ContractorDocumentSnapshotRecord {
  const sanitized = sanitizeDocumentMetadata({ id, ...data });
  const contractorId = str(data.contractorId) ?? fallbackContractorId;
  return { id, collection, path: `${prefix}/${id}`, contractorId, documentType: str(data.documentType) ?? str(data.docType) ?? id, data: sanitized };
}
function pushRelationship(out: ContractorDecisionAuditRelationship[], relationship: ContractorDecisionAuditRelationship): void {
  if (!relationship.targetId || relationship.sourceId === relationship.targetId) return;
  const key = `${relationship.sourceType}:${relationship.sourceId}:${relationship.targetType}:${relationship.targetId}:${relationship.relationshipType}`;
  if (!out.some((item) => `${item.sourceType}:${item.sourceId}:${item.targetType}:${item.targetId}:${item.relationshipType}` === key)) out.push(relationship);
}
function collectRelationships(record: SnapshotRecord | ContractorDocumentSnapshotRecord, sourceType: string): ContractorDecisionAuditRelationship[] {
  const out: ContractorDecisionAuditRelationship[] = [];
  for (const field of CONTRACTOR_ID_FIELDS) {
    const value = str(record.data[field]);
    if (value) pushRelationship(out, { sourceType, sourceId: record.id, targetType: "contractor", targetId: value, relationshipType: field, evidenceSource: record.path ?? record.collection });
  }
  for (const nestedKey of ["contractorAssignment", "opportunityExecution"]) {
    const nested = rawRecord(record.data[nestedKey]);
    const contractorId = str(nested.contractorId);
    if (contractorId) pushRelationship(out, { sourceType: nestedKey === "contractorAssignment" ? "assignment" : sourceType, sourceId: record.id, targetType: "contractor", targetId: contractorId, relationshipType: nestedKey, evidenceSource: `${record.path ?? record.collection}.${nestedKey}` });
  }
  return out;
}
function addRecords(target: SnapshotRecord[], records: SnapshotRecord[]): void { for (const record of records) if (!target.some((item) => item.collection === record.collection && item.id === record.id && item.path === record.path)) target.push(record); }
function addDocumentRecords(target: ContractorDocumentSnapshotRecord[], records: ContractorDocumentSnapshotRecord[]): void { for (const record of records) if (!target.some((item) => item.collection === record.collection && item.id === record.id && item.path === record.path)) target.push(record); }
function idsFromContractors(contractors: SnapshotRecord[]): string[] { return unique(contractors.flatMap((record) => [record.id, str(record.data.contractorId)])); }
function userIdsFromContractors(contractors: SnapshotRecord[]): string[] { return unique(contractors.flatMap((record) => [str(record.data.uid), str(record.data.authUid), str(record.data.userId)])); }
function workspaceIdsFrom(records: SnapshotRecord[]): string[] { return unique(records.map((record) => str(record.data.workspaceId))); }
function dealIdsFrom(records: SnapshotRecord[]): string[] { return unique(records.flatMap((record) => [record.id, str(record.data.dealId), str(record.data.opportunityId)])); }

async function queryCollection(db: FirebaseFirestore.Firestore, collection: string, field: string, value: string): Promise<SnapshotRecord[]> {
  const docs = await db.collection(collection).where(field, "==", value).get();
  return docs.docs.map((doc) => toSnapshotRecord(collection, doc.id, doc.data() ?? {}));
}
async function queryDocumentCollection(db: FirebaseFirestore.Firestore, collection: string, field: string, value: string): Promise<ContractorDocumentSnapshotRecord[]> {
  const docs = await db.collection(collection).where(field, "==", value).get();
  return docs.docs.map((doc) => toDocumentRecord(collection, doc.id, doc.data() ?? {}));
}

async function collectScoped(db: FirebaseFirestore.Firestore, snapshot: MutableSnapshot, options: CliOptions, queryStatistics: ContractorDecisionAuditSnapshot["queryStatistics"]): Promise<void> {
  const requestedIds = [options.contractorId];
  for (const id of requestedIds) {
    queryStatistics.documentReads += 1;
    queryStatistics.queryCount += 1;
    const direct = await db.collection("contractors").doc(id).get();
    if (direct.exists) addRecords(snapshot.contractors, [toSnapshotRecord("contractors", direct.id, direct.data() ?? {})]);
    queryStatistics.queryCount += 1;
    addRecords(snapshot.contractors, (await db.collection("contractors").where("contractorId", "==", id).get()).docs.map((doc) => toSnapshotRecord("contractors", doc.id, doc.data() ?? {})));
  }
  const contractorIds = idsFromContractors(snapshot.contractors);
  const userIds = userIdsFromContractors(snapshot.contractors);
  const workspaceIds = workspaceIdsFrom(snapshot.contractors);
  for (const source of SOURCE_CONFIGS) {
    const target = snapshot[source.bucket] as SnapshotRecord[];
    for (const field of source.contractorFields ?? []) for (const id of contractorIds) { queryStatistics.queryCount += 1; addRecords(target, await queryCollection(db, source.collection, field, id)); }
    for (const field of source.userFields ?? []) for (const id of userIds) { queryStatistics.queryCount += 1; addRecords(target, await queryCollection(db, source.collection, field, id)); }
    for (const field of source.workspaceFields ?? []) for (const id of workspaceIds) { queryStatistics.queryCount += 1; addRecords(target, await queryCollection(db, source.collection, field, id)); }
  }
  let linkedDealIds = dealIdsFrom([...snapshot.deals, ...snapshot.opportunities, ...snapshot.tenderPacks, ...snapshot.submissionReviews]);
  let linkedOpportunityIds = linkedDealIds;
  for (const source of SOURCE_CONFIGS) {
    const target = snapshot[source.bucket] as SnapshotRecord[];
    for (const field of source.dealFields ?? []) for (const id of linkedDealIds) { queryStatistics.queryCount += 1; addRecords(target, await queryCollection(db, source.collection, field, id)); }
    for (const field of source.opportunityFields ?? []) for (const id of linkedOpportunityIds) { queryStatistics.queryCount += 1; addRecords(target, await queryCollection(db, source.collection, field, id)); }
  }
  linkedDealIds = dealIdsFrom([...snapshot.deals, ...snapshot.opportunities, ...snapshot.tenderPacks, ...snapshot.submissionReviews]);
  linkedOpportunityIds = linkedDealIds;
  for (const source of DOCUMENT_SOURCE_CONFIGS) {
    for (const field of source.contractorFields ?? []) for (const id of contractorIds) { queryStatistics.queryCount += 1; addDocumentRecords(snapshot.contractorDocuments, await queryDocumentCollection(db, source.collection, field, id)); }
    for (const field of source.dealFields ?? []) for (const id of linkedDealIds) { queryStatistics.queryCount += 1; addDocumentRecords(snapshot.contractorDocuments, await queryDocumentCollection(db, source.collection, field, id)); }
  }
  queryStatistics.nPlusOnePatterns.push(VERIFIED_COLLECTION_PATHS.contractorDocumentSubcollection);
  for (const contractor of snapshot.contractors) {
    queryStatistics.subcollectionReads += 1;
    queryStatistics.queryCount += 1;
    const docs = await db.collection("contractors").doc(contractor.id).collection("documents").get();
    addDocumentRecords(snapshot.contractorDocuments, docs.docs.map((doc) => toDocumentRecord("contractors.documents", doc.id, doc.data() ?? {}, `contractors/${contractor.id}/documents`, contractor.id)));
  }
  queryStatistics.nPlusOnePatterns.push(VERIFIED_COLLECTION_PATHS.dealActivitySubcollection, VERIFIED_COLLECTION_PATHS.dealDocumentSubcollection);
  for (const dealId of linkedDealIds) {
    queryStatistics.subcollectionReads += 2;
    queryStatistics.queryCount += 2;
    const activity = await db.collection("deals").doc(dealId).collection("activity").get();
    addRecords(snapshot.activityRecords, activity.docs.map((doc) => toSnapshotRecord("deals.activity", doc.id, doc.data() ?? {}, `deals/${dealId}/activity`)));
    const docs = await db.collection("deals").doc(dealId).collection("documents").get();
    addDocumentRecords(snapshot.contractorDocuments, docs.docs.map((doc) => toDocumentRecord("deals.documents", doc.id, doc.data() ?? {}, `deals/${dealId}/documents`, null)));
  }
}

function finalizeSnapshot(snapshot: MutableSnapshot): void {
  const buckets = ["contractors", "users", "workspaces", "deals", "opportunities", "recommendations", "assignments", "tenderPacks", "submissionReviews", "auditEvents", "activityRecords", "contractorDocuments"] as const;
  snapshot.relationships = [];
  for (const bucket of buckets) for (const record of snapshot[bucket] as SnapshotRecord[]) snapshot.relationships.push(...collectRelationships(record, record.collection));
  for (const bucket of buckets) (snapshot[bucket] as SnapshotRecord[]).sort((left, right) => `${left.collection}:${left.path ?? left.id}`.localeCompare(`${right.collection}:${right.path ?? right.id}`));
  snapshot.relationships.sort((left, right) => `${left.sourceType}:${left.sourceId}:${left.targetId}:${left.relationshipType}`.localeCompare(`${right.sourceType}:${right.sourceId}:${right.targetId}:${right.relationshipType}`));
}
export async function collectReadonlyContractorDecisionSnapshot(options: CliOptions): Promise<ContractorDecisionAuditSnapshot> {
  assertReadonlySnapshotExecutionAllowed(options);
  assertCollectorSourceReadOnly();
  loadEnvConfig(process.cwd());
  const started = Date.now();
  const adminModule = await import("../src/lib/firebase/admin");
  const db = adminModule.getFirebaseAdmin();
  const queryStatistics = { collectionReads: 0, documentReads: 0, queryCount: 0, subcollectionReads: 0, nPlusOnePatterns: [] as string[] };
  const snapshot: MutableSnapshot = {
    metadata: { generatedAt: new Date(0).toISOString(), environment: "production", projectId: process.env.FIREBASE_PROJECT_ID?.trim() || null, collectorLogicVersion: READONLY_CONTRACTOR_DECISION_SNAPSHOT_VERSION, snapshotSchemaVersion: CONTRACTOR_DECISION_SNAPSHOT_SCHEMA_VERSION },
    contractors: [], users: [], workspaces: [], deals: [], opportunities: [], recommendations: [], assignments: [], tenderPacks: [], submissionReviews: [], auditEvents: [], activityRecords: [], contractorDocuments: [], relationships: [], collectionStatistics: {}, queryStatistics,
  };
  await collectScoped(db, snapshot, options, queryStatistics);
  finalizeSnapshot(snapshot);

  snapshot.metadata.generatedAt = new Date().toISOString();
  snapshot.metadata.elapsedMs = Date.now() - started;
  snapshot.queryStatistics.elapsedMs = snapshot.metadata.elapsedMs;
  snapshot.metadata.collectorLogicVersion = `${READONLY_CONTRACTOR_DECISION_SNAPSHOT_VERSION}; audit=${CONTRACTOR_DECISION_AUDIT_LOGIC_VERSION}`;
  return snapshot;
}

async function main() {
  const options = parseReadonlySnapshotArgs();
  if (options.planOnly) {
    const readonlyPlan = createReadonlySnapshotPlan(options);
    if (options.output) writeJsonFile(options.output, readonlyPlan);
    console.log(JSON.stringify({ planOnly: true, productionReadPerformed: false, mode: readonlyPlan.mode, productionExecutionAllowed: readonlyPlan.productionExecutionAllowed, targetedQueries: readonlyPlan.targetedQueries }, null, 2));
    return;
  }
  const snapshot = await collectReadonlyContractorDecisionSnapshot(options);
  writeJsonFile(options.output!, snapshot);
  console.log(JSON.stringify({ output: options.output, totalContractors: snapshot.contractors.length, productionWrites: 0, queryStatistics: snapshot.queryStatistics }, null, 2));
}

if (require.main === module) {
  main().catch((error) => {
    console.error("[readonly-contractor-decision-snapshot] failed", error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}







