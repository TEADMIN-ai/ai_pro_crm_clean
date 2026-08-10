import { randomUUID } from "node:crypto";
import {
  assertMasterDataWriteAuthority,
  assertSourceDoesNotBecomeSupplier,
  assertValidMasterDataState,
  detectDuplicateDecision,
  entityCollectionName,
  MASTER_DATA_POLICY_VERSION,
  MasterDataPolicyError,
} from "@/lib/master-data/policy";
import type {
  CanonicalMasterEntity,
  MasterDataActor,
  MasterDataAuditEvent,
  MasterDataEntityType,
  MasterDataEvidenceReference,
} from "@/types/masterData";

export type MasterDataRepository = {
  getByCanonicalId(entityType: MasterDataEntityType, canonicalId: string): Promise<CanonicalMasterEntity | null>;
  listByEntityType(entityType: MasterDataEntityType, workspaceId: string): Promise<CanonicalMasterEntity[]>;
  save(entity: CanonicalMasterEntity): Promise<void>;
  writeAuditEvent(event: MasterDataAuditEvent): Promise<void>;
};

export type MasterDataWriteResult = {
  entity: CanonicalMasterEntity;
  auditEvent: MasterDataAuditEvent;
  policyVersion: string;
};

export async function createCanonicalMasterDataEntity(input: {
  actor: MasterDataActor;
  repository: MasterDataRepository;
  entity: CanonicalMasterEntity;
  reason: string;
  now?: string;
}): Promise<MasterDataWriteResult> {
  const timestamp = input.now ?? new Date().toISOString();
  const entity = {
    ...input.entity,
    createdAt: input.entity.createdAt || timestamp,
    updatedAt: timestamp,
    createdBy: input.entity.createdBy || input.actor.uid,
    updatedBy: input.actor.uid,
  } as CanonicalMasterEntity;

  assertMasterDataWriteAuthority(input.actor, entity.workspaceId);
  assertValidMasterDataState(entity);
  if (entity.entityType === "source") assertSourceDoesNotBecomeSupplier(entity);

  const [existingById, existingRecords] = await Promise.all([
    input.repository.getByCanonicalId(entity.entityType, entity.canonicalId),
    input.repository.listByEntityType(entity.entityType, entity.workspaceId),
  ]);
  if (existingById) {
    throw new MasterDataPolicyError("CANONICAL_ID_DUPLICATE", "Duplicate canonical IDs are rejected.", 409, { canonicalId: entity.canonicalId });
  }

  const duplicateDecision = detectDuplicateDecision({ draft: entity, existing: existingRecords });
  if (duplicateDecision.status === "DUPLICATE") {
    throw new MasterDataPolicyError("DUPLICATE_IDENTITY_BLOCKED", duplicateDecision.reason, 409, duplicateDecision);
  }
  if (duplicateDecision.status === "REVIEW_REQUIRED") {
    throw new MasterDataPolicyError("POSSIBLE_DUPLICATE_REVIEW_REQUIRED", duplicateDecision.reason, 409, duplicateDecision);
  }

  const auditEvent = buildAuditEvent({
    action: "create",
    actor: input.actor,
    entity,
    previousState: null,
    resultingState: entity,
    reason: input.reason,
    evidenceReferences: entity.sourceEvidence,
    now: timestamp,
  });

  await input.repository.save(entity);
  await input.repository.writeAuditEvent(auditEvent);
  return { entity, auditEvent, policyVersion: MASTER_DATA_POLICY_VERSION };
}

export async function updateCanonicalMasterDataEntity(input: {
  actor: MasterDataActor;
  repository: MasterDataRepository;
  entityType: MasterDataEntityType;
  canonicalId: string;
  patch: Partial<CanonicalMasterEntity>;
  reason: string;
  now?: string;
}): Promise<MasterDataWriteResult> {
  const previous = await input.repository.getByCanonicalId(input.entityType, input.canonicalId);
  if (!previous) {
    throw new MasterDataPolicyError("CANONICAL_ENTITY_NOT_FOUND", "Canonical entity cannot be updated because it does not exist.", 404);
  }

  assertMasterDataWriteAuthority(input.actor, previous.workspaceId);
  const timestamp = input.now ?? new Date().toISOString();
  const next = {
    ...previous,
    ...input.patch,
    entityType: previous.entityType,
    canonicalId: previous.canonicalId,
    workspaceId: previous.workspaceId,
    createdAt: previous.createdAt,
    createdBy: previous.createdBy,
    updatedAt: timestamp,
    updatedBy: input.actor.uid,
  } as CanonicalMasterEntity;

  assertValidMasterDataState(next);
  if (next.entityType === "source") assertSourceDoesNotBecomeSupplier(next);

  const auditEvent = buildAuditEvent({
    action: auditActionForPatch(input.patch),
    actor: input.actor,
    entity: next,
    previousState: previous,
    resultingState: next,
    reason: input.reason,
    evidenceReferences: next.sourceEvidence,
    now: timestamp,
  });

  await input.repository.save(next);
  await input.repository.writeAuditEvent(auditEvent);
  return { entity: next, auditEvent, policyVersion: MASTER_DATA_POLICY_VERSION };
}

function auditActionForPatch(patch: Partial<CanonicalMasterEntity>): MasterDataAuditEvent["action"] {
  if (patch.status === "archived" || patch.verificationStatus === "ARCHIVED" || patch.reviewStatus === "ARCHIVED") return "archive";
  if (patch.verificationStatus === "REJECTED") return "rejection";
  if (patch.verificationStatus) return "verification";
  return "update";
}

export function buildAuditEvent(input: {
  action: MasterDataAuditEvent["action"];
  actor: MasterDataActor;
  entity: CanonicalMasterEntity;
  previousState?: CanonicalMasterEntity | null;
  resultingState?: CanonicalMasterEntity | null;
  reason: string;
  evidenceReferences?: MasterDataEvidenceReference[];
  now?: string;
}): MasterDataAuditEvent {
  return {
    eventId: `MDA-${randomUUID()}`,
    action: input.action,
    actorUid: input.actor.uid,
    actorRole: input.actor.role,
    workspaceId: input.entity.workspaceId,
    entityType: input.entity.entityType,
    entityId: input.entity.canonicalId,
    previousState: input.previousState ?? null,
    resultingState: input.resultingState ?? null,
    reason: input.reason,
    evidenceReferences: input.evidenceReferences ?? [],
    createdAt: input.now ?? new Date().toISOString(),
  };
}

export function masterDataCollectionFor(entityType: MasterDataEntityType): string {
  return entityCollectionName(entityType);
}
