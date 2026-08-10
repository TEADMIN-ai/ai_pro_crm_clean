import { buildAuditEvent, updateCanonicalMasterDataEntity, type MasterDataRepository } from "@/lib/master-data/service";
import { detectDuplicateDecision, normalizeDisplayNameKey, normalizeIdentityKey } from "@/lib/master-data/policy";
import type {
  CanonicalDocumentReference,
  CanonicalItem,
  CanonicalMasterEntity,
  CanonicalSupplier,
  MasterDataActor,
  MasterDataAuditEvent,
  MasterDataEntityType,
  MasterDataEvidenceReference,
} from "@/types/masterData";

export type MasterDataReviewQueueKey =
  | "pendingSuppliers"
  | "duplicateCandidates"
  | "pendingItems"
  | "pendingClientsSites"
  | "evidenceReview"
  | "rejectedArchived";

export type MasterDataEvidenceStatus = "present" | "missing" | "expired" | "rejected" | "historical_only";

export type MasterDataReviewRecord = {
  entity: CanonicalMasterEntity;
  queue: MasterDataReviewQueueKey;
  evidenceStatus: MasterDataEvidenceStatus;
  evidenceReferences: MasterDataEvidenceReference[];
  duplicateWarnings: MasterDataDuplicateCandidate[];
  linkedQuoteIds: string[];
  linkedDocumentIds: string[];
  linkedSourceId: string | null;
  currentPricingEligibility: "ELIGIBLE" | "NO_UPDATED_QUOTE_REQUIRED" | "UNKNOWN";
};

export type MasterDataDuplicateCandidate = {
  candidateAId: string;
  candidateBId: string;
  entityType: MasterDataEntityType;
  matchingAttributes: string[];
  conflictingFields: string[];
  evidenceA: MasterDataEvidenceReference[];
  evidenceB: MasterDataEvidenceReference[];
  provenanceA: string;
  provenanceB: string;
  verificationStatusA: string;
  verificationStatusB: string;
};

export type MasterDataReviewQueueSummary = {
  workspaceId: string;
  counts: Record<MasterDataReviewQueueKey, number>;
  records: MasterDataReviewRecord[];
  duplicateCandidates: MasterDataDuplicateCandidate[];
};

export type DuplicateResolutionOutcome = "same_entity" | "different_entities" | "review_required";

export type DuplicateResolutionInput = {
  workspaceId: string;
  entityType: MasterDataEntityType;
  candidateAId: string;
  candidateBId: string;
  outcome: DuplicateResolutionOutcome;
  canonicalSurvivorId?: string | null;
  reason: string;
};

const REVIEW_ENTITY_TYPES: MasterDataEntityType[] = ["supplier", "item", "client", "site", "document", "source"];

export async function buildMasterDataReviewQueues(input: {
  repository: MasterDataRepository;
  workspaceId: string;
  today?: Date;
}): Promise<MasterDataReviewQueueSummary> {
  const records = (await Promise.all(REVIEW_ENTITY_TYPES.map((entityType) => input.repository.listByEntityType(entityType, input.workspaceId)))).flat();
  const documents = records.filter((record): record is CanonicalDocumentReference => record.entityType === "document");
  const duplicates = findDuplicateCandidates(records);
  const reviewRecords = records.map((entity) => projectReviewRecord(entity, documents, duplicates, input.today ?? new Date()));

  return {
    workspaceId: input.workspaceId,
    counts: {
      pendingSuppliers: reviewRecords.filter((record) => record.queue === "pendingSuppliers").length,
      duplicateCandidates: duplicates.length,
      pendingItems: reviewRecords.filter((record) => record.queue === "pendingItems").length,
      pendingClientsSites: reviewRecords.filter((record) => record.queue === "pendingClientsSites").length,
      evidenceReview: reviewRecords.filter((record) => record.queue === "evidenceReview").length,
      rejectedArchived: reviewRecords.filter((record) => record.queue === "rejectedArchived").length,
    },
    records: reviewRecords,
    duplicateCandidates: duplicates,
  };
}

export async function resolveMasterDataDuplicate(input: {
  actor: MasterDataActor;
  repository: MasterDataRepository;
  resolution: DuplicateResolutionInput;
  now?: string;
}): Promise<{ auditEvent: MasterDataAuditEvent; survivor?: CanonicalMasterEntity | null; reviewed?: CanonicalMasterEntity[] }> {
  const timestamp = input.now ?? new Date().toISOString();
  const { resolution, repository, actor } = input;
  const [candidateA, candidateB] = await Promise.all([
    repository.getByCanonicalId(resolution.entityType, resolution.candidateAId),
    repository.getByCanonicalId(resolution.entityType, resolution.candidateBId),
  ]);
  if (!candidateA || !candidateB) throw Object.assign(new Error("Duplicate candidates must both exist."), { status: 404 });
  if (candidateA.workspaceId !== resolution.workspaceId || candidateB.workspaceId !== resolution.workspaceId) {
    throw Object.assign(new Error("Cross-workspace duplicate resolution rejected."), { status: 403 });
  }
  if (!resolution.reason.trim()) throw Object.assign(new Error("Duplicate resolution reason is required."), { status: 400 });

  const duplicateDecision = detectDuplicateDecision({ draft: candidateA, existing: [candidateB] });
  if (resolution.outcome === "same_entity") {
    const survivorId = resolution.canonicalSurvivorId?.trim();
    if (!survivorId || (survivorId !== candidateA.canonicalId && survivorId !== candidateB.canonicalId)) {
      throw Object.assign(new Error("Canonical survivor must be one of the duplicate candidates."), { status: 400 });
    }
    const survivor = survivorId === candidateA.canonicalId ? candidateA : candidateB;
    const alias = survivorId === candidateA.canonicalId ? candidateB : candidateA;
    const updated = await updateCanonicalMasterDataEntity({
      actor,
      repository,
      entityType: resolution.entityType,
      canonicalId: survivor.canonicalId,
      patch: {
        externalIdentifiers: mergeAlias(survivor, alias),
        notes: appendNote(survivor.notes, `Duplicate reviewed: ${alias.canonicalId} retained as alias/reference. ${resolution.reason}`),
      } as Partial<CanonicalMasterEntity>,
      reason: "Master Data duplicate survivor recorded.",
      now: timestamp,
    });
    const reviewedAlias = await updateCanonicalMasterDataEntity({
      actor,
      repository,
      entityType: resolution.entityType,
      canonicalId: alias.canonicalId,
      patch: {
        reviewStatus: "REVIEW_REQUIRED",
        notes: appendNote(alias.notes, `Duplicate reviewed against survivor ${survivor.canonicalId}; record preserved. ${resolution.reason}`),
      } as Partial<CanonicalMasterEntity>,
      reason: "Master Data duplicate alias preserved.",
      now: timestamp,
    });
    const auditEvent = duplicateAudit({ actor, entity: updated.entity, candidateA, candidateB, resolution, now: timestamp });
    await repository.writeAuditEvent(auditEvent);
    return { auditEvent, survivor: updated.entity, reviewed: [updated.entity, reviewedAlias.entity] };
  }

  const patchNote = resolution.outcome === "different_entities"
    ? `Duplicate reviewed: ${candidateA.canonicalId} and ${candidateB.canonicalId} are different entities. ${resolution.reason}`
    : `Duplicate review remains REVIEW_REQUIRED for ${candidateA.canonicalId} and ${candidateB.canonicalId}. ${resolution.reason}`;
  const reviewStatus = resolution.outcome === "different_entities" && duplicateDecision.status === "CLEAR" ? "READY_FOR_USE" : "REVIEW_REQUIRED";
  const updated = await Promise.all([candidateA, candidateB].map((candidate) => updateCanonicalMasterDataEntity({
    actor,
    repository,
    entityType: resolution.entityType,
    canonicalId: candidate.canonicalId,
    patch: {
      reviewStatus,
      notes: appendNote(candidate.notes, patchNote),
    } as Partial<CanonicalMasterEntity>,
    reason: "Master Data duplicate review recorded.",
    now: timestamp,
  })));
  const auditEvent = duplicateAudit({ actor, entity: updated[0].entity, candidateA, candidateB, resolution, now: timestamp });
  await repository.writeAuditEvent(auditEvent);
  return { auditEvent, survivor: null, reviewed: updated.map((result) => result.entity) };
}

export function evidenceStatusFor(entity: CanonicalMasterEntity, today = new Date()): MasterDataEvidenceStatus {
  const evidence = entity.sourceEvidence ?? [];
  if (!evidence.length) return "missing";
  if (evidence.some((item) => item.verificationStatus === "REJECTED")) return "rejected";
  if (evidence.some((item) => item.expiryDate && !Number.isNaN(Date.parse(item.expiryDate)) && new Date(item.expiryDate).getTime() < startOfDay(today).getTime())) {
    return "expired";
  }
  if (entity.entityType === "document" && (entity as CanonicalDocumentReference).expiryDate && new Date((entity as CanonicalDocumentReference).expiryDate as string).getTime() < startOfDay(today).getTime()) {
    return "historical_only";
  }
  return "present";
}

function projectReviewRecord(
  entity: CanonicalMasterEntity,
  documents: CanonicalDocumentReference[],
  duplicates: MasterDataDuplicateCandidate[],
  today: Date,
): MasterDataReviewRecord {
  const evidence = [...(entity.sourceEvidence ?? []), ...documents.filter((doc) => doc.linkedEntityId === entity.canonicalId).map(documentEvidence)];
  const duplicateWarnings = duplicates.filter((duplicate) => duplicate.candidateAId === entity.canonicalId || duplicate.candidateBId === entity.canonicalId);
  const linkedDocuments = documents.filter((doc) => doc.linkedEntityId === entity.canonicalId || entity.entityType === "supplier" && doc.linkedEntityId === (entity as CanonicalSupplier).supplierId);
  return {
    entity,
    queue: queueFor(entity),
    evidenceStatus: evidenceStatusFor({ ...entity, sourceEvidence: evidence } as CanonicalMasterEntity, today),
    evidenceReferences: evidence,
    duplicateWarnings,
    linkedQuoteIds: linkedDocuments.map((doc) => doc.externalIdentifiers.find((id) => id.system === "supplier_quote")?.value).filter((value): value is string => Boolean(value)),
    linkedDocumentIds: linkedDocuments.map((doc) => doc.documentId),
    linkedSourceId: entity.entityType === "supplier" ? (entity as CanonicalSupplier).linkedSourceId ?? null : entity.entityType === "source" ? entity.canonicalId : null,
    currentPricingEligibility: currentPricingEligibility(evidence, today),
  };
}

function queueFor(entity: CanonicalMasterEntity): MasterDataReviewQueueKey {
  if (entity.status === "archived" || entity.verificationStatus === "ARCHIVED" || entity.verificationStatus === "REJECTED") return "rejectedArchived";
  if (entity.entityType === "supplier" && (entity.verificationStatus === "PENDING_REVIEW" || entity.reviewStatus === "REVIEW_REQUIRED")) return "pendingSuppliers";
  if (entity.entityType === "item" && (entity.verificationStatus === "PENDING_REVIEW" || entity.reviewStatus === "REVIEW_REQUIRED")) return "pendingItems";
  if ((entity.entityType === "client" || entity.entityType === "site") && (entity.verificationStatus === "PENDING_REVIEW" || entity.reviewStatus === "REVIEW_REQUIRED")) return "pendingClientsSites";
  if (entity.entityType === "document" || evidenceStatusFor(entity) !== "present") return "evidenceReview";
  return "evidenceReview";
}

function findDuplicateCandidates(records: CanonicalMasterEntity[]): MasterDataDuplicateCandidate[] {
  const candidates: MasterDataDuplicateCandidate[] = [];
  for (let i = 0; i < records.length; i += 1) {
    for (let j = i + 1; j < records.length; j += 1) {
      const left = records[i];
      const right = records[j];
      if (left.entityType !== right.entityType || left.workspaceId !== right.workspaceId) continue;
      const matching = matchingAttributes(left, right);
      if (!matching.length) continue;
      candidates.push({
        candidateAId: left.canonicalId,
        candidateBId: right.canonicalId,
        entityType: left.entityType,
        matchingAttributes: matching,
        conflictingFields: conflictingFields(left, right),
        evidenceA: left.sourceEvidence,
        evidenceB: right.sourceEvidence,
        provenanceA: left.provenance,
        provenanceB: right.provenance,
        verificationStatusA: left.verificationStatus,
        verificationStatusB: right.verificationStatus,
      });
    }
  }
  return candidates;
}

function matchingAttributes(left: CanonicalMasterEntity, right: CanonicalMasterEntity): string[] {
  const matches: string[] = [];
  if (normalizeIdentityKey(left.canonicalId) === normalizeIdentityKey(right.canonicalId)) matches.push("canonicalId");
  if (left.entityType === "supplier" && right.entityType === "supplier") {
    const a = left as CanonicalSupplier;
    const b = right as CanonicalSupplier;
    if (normalizeIdentityKey(a.registrationNumber) && normalizeIdentityKey(a.registrationNumber) === normalizeIdentityKey(b.registrationNumber)) matches.push("registrationNumber");
    if (normalizeIdentityKey(a.email) && normalizeIdentityKey(a.email) === normalizeIdentityKey(b.email)) matches.push("email");
    if (normalizeIdentityKey(a.phone) && normalizeIdentityKey(a.phone) === normalizeIdentityKey(b.phone)) matches.push("phone");
  }
  if (left.entityType === "item" && right.entityType === "item" && normalizeIdentityKey((left as CanonicalItem).itemCode) === normalizeIdentityKey((right as CanonicalItem).itemCode)) matches.push("itemCode");
  if (normalizeDisplayNameKey(left.legalName ?? left.tradingName ?? left.displayName) && normalizeDisplayNameKey(left.legalName ?? left.tradingName ?? left.displayName) === normalizeDisplayNameKey(right.legalName ?? right.tradingName ?? right.displayName)) matches.push("name");
  return matches;
}

function conflictingFields(left: CanonicalMasterEntity, right: CanonicalMasterEntity): string[] {
  const fields: Array<keyof CanonicalMasterEntity> = ["displayName", "legalName", "tradingName", "provenance", "verificationStatus"];
  return fields.filter((field) => normalizeIdentityKey(left[field]) !== normalizeIdentityKey(right[field]));
}

function documentEvidence(document: CanonicalDocumentReference): MasterDataEvidenceReference {
  return {
    documentId: document.documentId,
    sourcePath: document.sourcePath,
    storagePath: document.storagePath,
    filename: document.filename,
    issueDate: document.issueDate,
    expiryDate: document.expiryDate,
    hash: document.hash,
    verificationStatus: document.verificationStatus,
    provenance: document.provenance,
  };
}

function currentPricingEligibility(evidence: MasterDataEvidenceReference[], today: Date): MasterDataReviewRecord["currentPricingEligibility"] {
  if (!evidence.length) return "UNKNOWN";
  const hasExpired = evidence.some((item) => item.expiryDate && !Number.isNaN(Date.parse(item.expiryDate)) && new Date(item.expiryDate).getTime() < startOfDay(today).getTime());
  return hasExpired ? "NO_UPDATED_QUOTE_REQUIRED" : "ELIGIBLE";
}

function mergeAlias(survivor: CanonicalMasterEntity, alias: CanonicalMasterEntity) {
  const exists = survivor.externalIdentifiers.some((identifier) => identifier.system === "master_data_alias" && identifier.value === alias.canonicalId);
  return exists ? survivor.externalIdentifiers : [...survivor.externalIdentifiers, { system: "master_data_alias", value: alias.canonicalId, status: "alias" as const }];
}

function appendNote(existing: string | null | undefined, addition: string): string {
  return [existing, addition].filter(Boolean).join("\n");
}

function duplicateAudit(input: {
  actor: MasterDataActor;
  entity: CanonicalMasterEntity;
  candidateA: CanonicalMasterEntity;
  candidateB: CanonicalMasterEntity;
  resolution: DuplicateResolutionInput;
  now: string;
}) {
  return buildAuditEvent({
    action: "duplicate_resolution",
    actor: input.actor,
    entity: input.entity,
    previousState: input.candidateA,
    resultingState: input.entity,
    reason: `${input.resolution.outcome}: ${input.resolution.reason}; candidates=${input.candidateA.canonicalId},${input.candidateB.canonicalId}; survivor=${input.resolution.canonicalSurvivorId ?? "none"}`,
    evidenceReferences: [...input.candidateA.sourceEvidence, ...input.candidateB.sourceEvidence],
    now: input.now,
  });
}

function startOfDay(date: Date): Date {
  return new Date(date.toDateString());
}
