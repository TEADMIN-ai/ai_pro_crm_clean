import { getFirebaseAdmin } from "@/lib/firebase/admin";
import { MASTER_DATA_COLLECTIONS } from "@/lib/master-data/firestoreRepository";
import type { AuthorizedUser } from "@/lib/server/authz";
import type { CanonicalDocumentReference } from "@/types/masterData";

export async function registerTenderPackDocument(input: {
  packId: string;
  opportunityId: string;
  workspaceId: string | null;
  clientQuoteId: string;
  storagePath: string;
  filename: string;
  actor: AuthorizedUser;
}): Promise<string> {
  const documentId = `MDOC-TENDER-PACK-${input.packId}`;
  const now = new Date().toISOString();
  const document: CanonicalDocumentReference = {
    entityType: "document",
    documentId,
    canonicalId: documentId,
    documentType: "TENDER_PACK",
    linkedEntityType: "client",
    linkedEntityId: input.opportunityId,
    displayName: input.filename,
    legalName: null,
    tradingName: null,
    externalIdentifiers: [{ system: "tender_pack", value: input.packId, status: "active" }, { system: "client_quote", value: input.clientQuoteId, status: "active" }],
    workspaceId: input.workspaceId ?? "",
    organisationId: null,
    status: "active",
    provenance: "SYSTEM_CANONICAL",
    verificationStatus: "VERIFIED",
    reviewStatus: "READY_FOR_USE",
    sourceEvidence: [{ documentId, storagePath: input.storagePath, filename: input.filename, provenance: "SYSTEM_CANONICAL", verificationStatus: "VERIFIED", evidenceStatus: "VERIFIED", evidencePurposes: ["GENERAL_REFERENCE"] }],
    notes: "Persisted tender pack generated from an approved Client_Quote_ID.",
    createdAt: now,
    updatedAt: now,
    createdBy: input.actor.uid,
    updatedBy: input.actor.uid,
    storagePath: input.storagePath,
    filename: input.filename,
    contentType: "application/pdf",
    evidenceStatus: "VERIFIED",
    evidencePurposes: ["GENERAL_REFERENCE"],
    uploadedBy: input.actor.uid,
    uploadedAt: now,
    linkedBusinessReferences: [{ referenceType: "Opportunity", referenceId: input.opportunityId, relationship: "tender_pack_for" }, { referenceType: "Client_Quote", referenceId: input.clientQuoteId, relationship: "generated_from" }],
  };
  await getFirebaseAdmin().collection(MASTER_DATA_COLLECTIONS.document).doc(documentId).set(document);
  await getFirebaseAdmin().collection("commercialAuthorityAuditEvents").add({ action: "tender_pack_persisted", entityId: input.opportunityId, actor: input.actor.uid, workspaceId: input.workspaceId, metadata: { documentId, packId: input.packId, clientQuoteId: input.clientQuoteId }, createdAt: new Date() });
  return documentId;
}
