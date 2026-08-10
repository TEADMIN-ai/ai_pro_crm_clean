import { buildAuditEvent, updateCanonicalMasterDataEntity, type MasterDataRepository } from "@/lib/master-data/service";
import type {
  CanonicalDocumentReference,
  CanonicalMasterEntity,
  MasterDataActor,
  MasterDataAuditEvent,
  MasterDataEvidencePurpose,
  MasterDataEvidenceReference,
  MasterDataEvidenceStatus,
  MasterDataLinkedBusinessReference,
} from "@/types/masterData";

export type EvidenceAuthorityDecision = {
  allowed: boolean;
  status: "ALLOWED" | "BLOCKED" | "REVIEW_REQUIRED";
  evidenceStatus: MasterDataEvidenceStatus;
  purpose: MasterDataEvidencePurpose;
  reason: string;
  blockers: string[];
};

export type EvidenceReviewAction = "verify" | "reject" | "historical_only" | "review_required";

export type EvidenceReviewResult = {
  document: CanonicalDocumentReference;
  auditEvent: MasterDataAuditEvent;
};

export class EvidenceAuthorityError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly status = 400,
    public readonly details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = "EvidenceAuthorityError";
  }
}

export function deriveEvidenceStatus(document: CanonicalDocumentReference, today = new Date()): MasterDataEvidenceStatus {
  if (document.evidenceStatus === "REJECTED" || document.verificationStatus === "REJECTED") return "REJECTED";
  if (document.evidenceStatus === "HISTORICAL_ONLY") return "HISTORICAL_ONLY";
  if (document.verificationStatus === "VERIFIED" || document.evidenceStatus === "VERIFIED") return "VERIFIED";
  if (isExpired(document.expiryDate, today)) return "EXPIRED";
  if (!hasEvidenceLocation(document)) return "MISSING";
  if (document.verificationStatus === "PENDING_REVIEW" || document.reviewStatus === "REVIEW_REQUIRED") return "PENDING_REVIEW";
  return "PRESENT";
}

export function evaluateEvidencePurposeAuthority(input: {
  document: CanonicalDocumentReference;
  purpose: MasterDataEvidencePurpose;
  today?: Date;
  linkedEntityType?: CanonicalDocumentReference["linkedEntityType"];
  linkedEntityId?: string | null;
}): EvidenceAuthorityDecision {
  const today = input.today ?? new Date();
  const status = deriveEvidenceStatus(input.document, today);
  const blockers: string[] = [];
  if (input.linkedEntityType && input.document.linkedEntityType !== input.linkedEntityType) blockers.push("Evidence linked entity type does not match requested use.");
  if (input.linkedEntityId && input.document.linkedEntityId !== input.linkedEntityId) blockers.push("Evidence linked entity ID does not match requested use.");
  if (!hasEvidenceLocation(input.document)) blockers.push("Evidence storage/source reference is missing.");
  if (input.document.provenance === "BENCHMARK_REFERENCE" && ["SUPPLIER_QUOTE_REVIEW", "CURRENT_QS_PRICING", "SUPPLIER_IDENTITY"].includes(input.purpose)) {
    blockers.push("Benchmark evidence cannot become supplier quote or supplier identity authority.");
  }
  if (input.purpose === "CURRENT_QS_PRICING" && isExpired(input.document.expiryDate, today)) {
    blockers.push("Expired supplier quote cannot drive current QS pricing.");
  }
  if (input.purpose === "HYGIENE_DISPOSAL_PROOF" && !hasLinkedReference(input.document, "disposal_batch")) {
    blockers.push("Collection evidence cannot satisfy disposal evidence without an explicit disposal batch/certificate link.");
  }
  if (status === "REJECTED") blockers.push("Rejected evidence cannot authorize business use.");
  if (status === "MISSING") blockers.push("Missing evidence cannot authorize business use.");

  if (blockers.length) {
    return { allowed: false, status: "BLOCKED", evidenceStatus: status, purpose: input.purpose, reason: blockers[0], blockers };
  }
  if (status === "PENDING_REVIEW" || status === "PRESENT") {
    return { allowed: false, status: "REVIEW_REQUIRED", evidenceStatus: status, purpose: input.purpose, reason: "Evidence requires review before authoritative use.", blockers: ["Evidence requires review."] };
  }
  return { allowed: true, status: "ALLOWED", evidenceStatus: status, purpose: input.purpose, reason: "Evidence purpose is allowed for the current state.", blockers: [] };
}

export async function reviewEvidenceDocument(input: {
  actor: MasterDataActor;
  repository: MasterDataRepository;
  documentId: string;
  workspaceId: string;
  action: EvidenceReviewAction;
  reason: string;
  purpose: MasterDataEvidencePurpose;
  now?: string;
}): Promise<EvidenceReviewResult> {
  const document = await input.repository.getByCanonicalId("document", input.documentId);
  if (!document || document.entityType !== "document") {
    throw new EvidenceAuthorityError("DOCUMENT_NOT_FOUND", "Evidence document not found.", 404);
  }
  const doc = document as CanonicalDocumentReference;
  if (doc.workspaceId !== input.workspaceId || input.actor.workspaceId !== input.workspaceId) {
    throw new EvidenceAuthorityError("CROSS_WORKSPACE_EVIDENCE_BLOCKED", "Cross-workspace evidence review rejected.", 403);
  }
  if (!input.reason.trim()) {
    throw new EvidenceAuthorityError("EVIDENCE_REVIEW_REASON_REQUIRED", "Evidence review reason is required.", 400);
  }
  assertDocumentRelationship(doc);

  const timestamp = input.now ?? new Date().toISOString();
  const decision = evaluateEvidencePurposeAuthority({ document: doc, purpose: input.purpose });
  if (input.action === "verify" && decision.status === "BLOCKED") {
    throw new EvidenceAuthorityError("EVIDENCE_VERIFY_BLOCKED", decision.reason, 409, { blockers: decision.blockers });
  }

  const patch = reviewPatch(input.action, input.actor.uid, input.reason, input.purpose, timestamp);
  const result = await updateCanonicalMasterDataEntity({
    actor: input.actor,
    repository: input.repository,
    entityType: "document",
    canonicalId: doc.canonicalId,
    patch: patch as Partial<CanonicalMasterEntity>,
    reason: `Evidence ${input.action} for ${input.purpose}: ${input.reason}`,
    now: timestamp,
  });
  const updated = result.entity as CanonicalDocumentReference;
  const auditEvent = buildEvidenceAuditEvent({
    actor: input.actor,
    previous: doc,
    resulting: updated,
    action: input.action,
    purpose: input.purpose,
    reason: input.reason,
    now: timestamp,
  });
  await input.repository.writeAuditEvent(auditEvent);
  return { document: updated, auditEvent };
}

export function assertDocumentRelationship(document: CanonicalDocumentReference): void {
  if (document.entityType !== "document" || document.canonicalId !== document.documentId) {
    throw new EvidenceAuthorityError("DOCUMENT_ID_MISMATCH", "Document_ID must match canonical document identity.", 400);
  }
  if (!document.linkedEntityType || !document.linkedEntityId) {
    throw new EvidenceAuthorityError("DOCUMENT_RELATIONSHIP_MISSING", "Evidence must be linked to an explicit entity.", 400);
  }
  if (document.linkedEntityType === "document") {
    throw new EvidenceAuthorityError("DOCUMENT_SELF_LINK_REJECTED", "Evidence document cannot be linked only to another document.", 400);
  }
}

export function adaptSupplierQuoteEvidence(document: CanonicalDocumentReference, today = new Date()) {
  const identity = evaluateEvidencePurposeAuthority({ document, purpose: "SUPPLIER_IDENTITY", today });
  const currentPricing = evaluateEvidencePurposeAuthority({ document, purpose: "CURRENT_QS_PRICING", today });
  return {
    supplierId: document.linkedEntityType === "supplier" ? document.linkedEntityId : null,
    supplierQuoteId: document.externalIdentifiers.find((item) => item.system === "supplier_quote")?.value ?? null,
    documentId: document.documentId,
    identityAuthority: identity,
    currentPricingAuthority: currentPricing,
  };
}

export function adaptContractorEvidence(document: CanonicalDocumentReference) {
  return {
    documentId: document.documentId,
    contractorId: document.linkedEntityType === "contractor" ? document.linkedEntityId : null,
    authority: "existing_contractor_authority" as const,
    decision: evaluateEvidencePurposeAuthority({ document, purpose: "CONTRACTOR_COMPLIANCE" }),
  };
}

export function adaptHygieneEvidence(input: {
  document: CanonicalDocumentReference;
  collectionId?: string | null;
  disposalBatchId?: string | null;
  purpose: Extract<MasterDataEvidencePurpose, "HYGIENE_COLLECTION_ACKNOWLEDGEMENT" | "HYGIENE_DISPOSAL_PROOF">;
}) {
  const referenceType = input.purpose === "HYGIENE_DISPOSAL_PROOF" ? "disposal_batch" : "hygiene_collection";
  const expectedId = input.purpose === "HYGIENE_DISPOSAL_PROOF" ? input.disposalBatchId : input.collectionId;
  const matches = expectedId ? hasLinkedReference(input.document, referenceType, expectedId) : false;
  if (!matches) {
    return {
      documentId: input.document.documentId,
      decision: {
        allowed: false,
        status: "BLOCKED" as const,
        evidenceStatus: deriveEvidenceStatus(input.document),
        purpose: input.purpose,
        reason: "Hygiene evidence relationship does not match the requested operational record.",
        blockers: ["Hygiene evidence relationship mismatch."],
      },
    };
  }
  return { documentId: input.document.documentId, decision: evaluateEvidencePurposeAuthority({ document: input.document, purpose: input.purpose }) };
}

export function adaptFinanceEvidence(document: CanonicalDocumentReference) {
  return {
    documentId: document.documentId,
    linkedReferences: document.linkedBusinessReferences ?? [],
    decision: evaluateEvidencePurposeAuthority({ document, purpose: "FINANCE_TRANSACTION_SUPPORT" }),
  };
}

export function evidenceReferenceFromDocument(document: CanonicalDocumentReference): MasterDataEvidenceReference {
  return {
    documentId: document.documentId,
    sourcePath: document.sourcePath,
    storagePath: document.storagePath,
    filename: document.filename,
    hash: document.hash,
    issueDate: document.issueDate,
    expiryDate: document.expiryDate,
    verificationStatus: document.verificationStatus,
    provenance: document.provenance,
    evidenceStatus: deriveEvidenceStatus(document),
    evidencePurposes: document.evidencePurposes,
  };
}

function reviewPatch(
  action: EvidenceReviewAction,
  actorUid: string,
  reason: string,
  purpose: MasterDataEvidencePurpose,
  timestamp: string,
): Partial<CanonicalDocumentReference> {
  if (action === "verify") {
    return {
      verificationStatus: "VERIFIED",
      reviewStatus: "READY_FOR_USE",
      evidenceStatus: "VERIFIED",
      evidencePurposes: [purpose],
      verifiedBy: actorUid,
      verifiedAt: timestamp,
      rejectedBy: null,
      rejectedAt: null,
      rejectionReason: null,
    };
  }
  if (action === "reject") {
    return {
      verificationStatus: "REJECTED",
      reviewStatus: "BLOCKED",
      evidenceStatus: "REJECTED",
      rejectedBy: actorUid,
      rejectedAt: timestamp,
      rejectionReason: reason,
    };
  }
  if (action === "historical_only") {
    return {
      verificationStatus: "PENDING_REVIEW",
      reviewStatus: "REVIEW_REQUIRED",
      evidenceStatus: "HISTORICAL_ONLY",
      evidencePurposes: [purpose],
      notes: `Historical-only evidence: ${reason}`,
    };
  }
  return {
    verificationStatus: "PENDING_REVIEW",
    reviewStatus: "REVIEW_REQUIRED",
    evidenceStatus: "PENDING_REVIEW",
    evidencePurposes: [purpose],
  };
}

function buildEvidenceAuditEvent(input: {
  actor: MasterDataActor;
  previous: CanonicalDocumentReference;
  resulting: CanonicalDocumentReference;
  action: EvidenceReviewAction;
  purpose: MasterDataEvidencePurpose;
  reason: string;
  now: string;
}): MasterDataAuditEvent {
  return buildAuditEvent({
    action: input.action === "historical_only" ? "evidence_historical_only" : "evidence_review",
    actor: input.actor,
    entity: input.resulting,
    previousState: input.previous,
    resultingState: input.resulting,
    reason: `${input.action}: ${input.purpose}; ${input.reason}`,
    evidenceReferences: [evidenceReferenceFromDocument(input.resulting)],
    now: input.now,
  });
}

function hasEvidenceLocation(document: CanonicalDocumentReference): boolean {
  return Boolean(document.storagePath?.trim() || document.sourcePath?.trim() || document.filename?.trim() || document.hash?.trim());
}

function isExpired(expiryDate: string | null | undefined, today: Date): boolean {
  if (!expiryDate || Number.isNaN(Date.parse(expiryDate))) return false;
  return new Date(expiryDate).getTime() < startOfDay(today).getTime();
}

function hasLinkedReference(document: CanonicalDocumentReference, referenceType: string, referenceId?: string | null): boolean {
  return (document.linkedBusinessReferences ?? []).some((reference: MasterDataLinkedBusinessReference) =>
    reference.referenceType === referenceType &&
    (!referenceId || reference.referenceId === referenceId),
  );
}

function startOfDay(date: Date): Date {
  return new Date(date.toDateString());
}
