import { getFirebaseAdmin } from "@/lib/firebase/admin";
import { MASTER_DATA_COLLECTIONS } from "@/lib/master-data/firestoreRepository";
import type { AuthorizedUser } from "@/lib/server/authz";
import type { CanonicalDocumentReference } from "@/types/masterData";
import type { TenderPricingDocumentFillEvidence, TenderPricingWorkspace } from "@/types/tenderPricing";

export const PRICED_TENDER_DOCUMENT_TYPE = "PRICED_TENDER_DOCUMENT";

function asString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function expectedDocumentId(workspace: Pick<TenderPricingWorkspace, "id" | "revision">): string {
  return `MDOC-PRICED-${workspace.id}-r${workspace.revision}`;
}

function expectedStoragePath(workspace: TenderPricingWorkspace): string {
  return `priced-documents/${workspace.workspaceId}/${workspace.dealId}/${workspace.id}/revision-${workspace.revision}/priced-document.json`;
}

export function pricedDocumentIdFromEvidence(evidence?: TenderPricingDocumentFillEvidence | null): string | null {
  return asString(evidence?.governedDocumentId) ?? asString(evidence?.pricedDocumentId);
}

export async function registerPricedDocumentAuthority(input: {
  workspace: TenderPricingWorkspace;
  evidence: TenderPricingDocumentFillEvidence;
  actor: AuthorizedUser;
}): Promise<{ documentId: string; storagePath: string }> {
  const documentId = expectedDocumentId(input.workspace);
  const storagePath = expectedStoragePath(input.workspace);
  const now = new Date().toISOString();
  const document: CanonicalDocumentReference = {
    entityType: "document",
    canonicalId: documentId,
    documentId,
    documentType: PRICED_TENDER_DOCUMENT_TYPE,
    linkedEntityType: "client",
    linkedEntityId: input.workspace.dealId,
    displayName: `Priced tender document ${input.workspace.dealId} revision ${input.workspace.revision}`,
    legalName: null,
    tradingName: null,
    externalIdentifiers: [
      { system: "tender_pricing_workspace", value: input.workspace.id, status: "active" },
      { system: "legacy_priced_document_id", value: input.evidence.pricedDocumentId ?? `priced-${input.workspace.id}`, status: "legacy" },
    ],
    workspaceId: input.workspace.workspaceId,
    organisationId: null,
    status: "active",
    provenance: "SYSTEM_CANONICAL",
    verificationStatus: "VERIFIED",
    reviewStatus: "READY_FOR_USE",
    sourceEvidence: [{
      documentId,
      sourcePath: input.evidence.sourceDocumentPath,
      storagePath,
      filename: "priced-document.json",
      provenance: "SYSTEM_CANONICAL",
      verificationStatus: "VERIFIED",
      evidenceStatus: "VERIFIED",
      evidencePurposes: ["CURRENT_QS_PRICING"],
    }],
    notes: "Persisted priced tender document generated from locked governed tender pricing.",
    createdAt: now,
    updatedAt: now,
    createdBy: input.actor.uid,
    updatedBy: input.actor.uid,
    sourcePath: input.evidence.sourceDocumentPath,
    storagePath,
    filename: "priced-document.json",
    contentType: "application/json",
    evidenceStatus: "VERIFIED",
    evidencePurposes: ["CURRENT_QS_PRICING"],
    uploadedBy: input.actor.uid,
    uploadedAt: now,
    verifiedBy: input.actor.uid,
    verifiedAt: now,
    linkedBusinessReferences: [
      { referenceType: "Opportunity", referenceId: input.workspace.dealId, relationship: "priced_document_for" },
      { referenceType: "TenderPricingWorkspace", referenceId: input.workspace.id, relationship: "generated_from" },
      { referenceType: "TenderPricingRevision", referenceId: String(input.workspace.revision), relationship: "revision" },
    ],
  };
  await getFirebaseAdmin().collection(MASTER_DATA_COLLECTIONS.document).doc(documentId).set(document, { merge: true });
  await getFirebaseAdmin().collection("commercialAuthorityAuditEvents").add({
    action: "priced_tender_document_persisted",
    entityId: input.workspace.dealId,
    actor: input.actor.uid,
    workspaceId: input.workspace.workspaceId,
    metadata: { documentId, pricingId: input.workspace.id, revision: input.workspace.revision },
    createdAt: new Date(),
  });
  return { documentId, storagePath };
}

export async function resolveVerifiedPricedDocumentAuthority(input: {
  workspace: TenderPricingWorkspace;
  documentId?: string | null;
}) {
  const documentId = asString(input.documentId) ?? pricedDocumentIdFromEvidence(input.workspace.documentFillEvidence);
  if (!documentId) {
    throw Object.assign(new Error("Governed priced document is required"), { status: 409, code: "PRICED_DOCUMENT_REQUIRED" });
  }
  const snapshot = await getFirebaseAdmin().collection(MASTER_DATA_COLLECTIONS.document).doc(documentId).get();
  if (!snapshot.exists) {
    throw Object.assign(new Error("Priced document Document_ID is not a governed document"), { status: 409, code: "PRICED_DOCUMENT_NOT_GOVERNED" });
  }
  const document = { id: snapshot.id, ...(snapshot.data() ?? {}) } as Record<string, unknown>;
  if (document.workspaceId && document.workspaceId !== input.workspace.workspaceId) {
    throw Object.assign(new Error("Priced document belongs to a different workspace"), { status: 403, code: "PRICED_DOCUMENT_WORKSPACE_MISMATCH" });
  }
  if (document.linkedEntityId !== input.workspace.dealId) {
    throw Object.assign(new Error("Priced document is linked to a different opportunity"), { status: 409, code: "PRICED_DOCUMENT_LINKAGE_MISMATCH" });
  }
  if (document.documentType !== PRICED_TENDER_DOCUMENT_TYPE) {
    throw Object.assign(new Error("Priced document has an unsupported document type"), { status: 409, code: "PRICED_DOCUMENT_TYPE_INVALID" });
  }
  if (document.status !== "active" || document.verificationStatus !== "VERIFIED" || document.reviewStatus !== "READY_FOR_USE") {
    throw Object.assign(new Error("Priced document is not verified for commercial authority"), { status: 409, code: "PRICED_DOCUMENT_NOT_VERIFIED" });
  }
  if (!asString(document.documentId) || !asString(document.storagePath)) {
    throw Object.assign(new Error("Priced document durable artifact reference is missing"), { status: 409, code: "PRICED_DOCUMENT_ARTIFACT_MISSING" });
  }
  return document;
}
