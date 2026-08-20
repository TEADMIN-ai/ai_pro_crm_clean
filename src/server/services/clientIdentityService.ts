import { randomUUID, createHash } from "node:crypto";
import { getFirebaseAdmin } from "@/lib/firebase/admin";
import { assertPrivilegedRole, type AuthorizedUser } from "@/lib/server/authz";
import { FirestoreMasterDataRepository, actorFromAuthorizedUser, createCanonicalMasterDataEntity, MASTER_DATA_COLLECTIONS } from "@/lib/master-data";
import { normalizeDisplayNameKey, normalizeIdentityKey } from "@/lib/master-data/policy";
import type { CanonicalClient, CanonicalMasterEntity, CanonicalReferenceResolution } from "@/types/masterData";

type AnyRecord = Record<string, unknown>;

export type ClientIdentityStatus =
  | "RESOLVED_VERIFIED"
  | "CLIENT_REVIEW_REQUIRED"
  | "CLIENT_VERIFICATION_REQUIRED"
  | "AMBIGUOUS_CLIENT_MATCH"
  | "UNRESOLVED";

export type ClientIdentityResolution = {
  status: ClientIdentityStatus;
  dealId: string;
  workspaceId: string | null;
  sourceReference: string | null;
  canonicalId: string | null;
  candidates: Array<{ canonicalId: string; displayName: string; verificationStatus: string; reviewStatus: string; status: string }>;
  reason: string;
  nextAction: string;
};

export type DealClientMasterDataReference = CanonicalReferenceResolution & {
  verifiedAt?: string | null;
  verifiedBy?: string | null;
  linkedAt?: string | null;
  linkedBy?: string | null;
  source: "masterClients";
};

function rec(value: unknown): AnyRecord {
  return value && typeof value === "object" && !Array.isArray(value) ? value as AnyRecord : {};
}

function str(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function assertWorkspace(actor: AuthorizedUser, workspaceId: string | null | undefined): void {
  if (actor.workspaceId && workspaceId && actor.workspaceId !== workspaceId) {
    throw Object.assign(new Error("Cross-workspace client identity access rejected"), { status: 403, code: "CLIENT_WORKSPACE_MISMATCH" });
  }
}

export function canonicalClientIdFromDeal(deal: AnyRecord): string | null {
  const reference = rec(deal.clientMasterDataReference);
  return str(deal.clientId) ?? str(reference.canonicalId) ?? str(deal.client_ID) ?? str(deal.Client_ID) ?? str(rec(deal.masterData).clientId);
}

export function clientSourceTextFromDeal(deal: AnyRecord): string | null {
  const execution = rec(deal.opportunityExecution);
  const requirements = rec(execution.requirements);
  const intake = rec(deal.opportunityIntake);
  const draft = rec(intake.draft);
  const raw = str(requirements.clientIssuer) ?? str(deal.clientName) ?? str(deal.issuingAuthority) ?? str(rec(deal.tenderAnalysis).issuingAuthority) ?? str(draft.clientName);
  return cleanClientDisplayName(raw);
}

export function cleanClientDisplayName(value: string | null): string | null {
  if (!value) return null;
  const cleaned = value.replace(/^[/\s-]*(issuer|client|issuing authority)\s*/i, "").trim();
  return cleaned || value.trim();
}

function clientMatchKey(client: CanonicalClient): string {
  return normalizeDisplayNameKey(client.legalName ?? client.tradingName ?? client.displayName);
}

function candidateSummary(client: CanonicalClient) {
  return {
    canonicalId: client.canonicalId,
    displayName: client.displayName,
    verificationStatus: client.verificationStatus,
    reviewStatus: client.reviewStatus,
    status: client.status,
  };
}

function asCanonicalClient(entity: CanonicalMasterEntity | null): CanonicalClient | null {
  return entity?.entityType === "client" ? entity : null;
}

async function loadDeal(dealId: string): Promise<AnyRecord & { id: string }> {
  const snapshot = await getFirebaseAdmin().collection("deals").doc(dealId).get();
  if (!snapshot.exists) throw Object.assign(new Error("Deal not found"), { status: 404, code: "DEAL_NOT_FOUND" });
  return { id: snapshot.id, ...(snapshot.data() ?? {}) };
}

export async function resolveDealClientIdentity(input: { dealId: string; actor: AuthorizedUser }): Promise<ClientIdentityResolution> {
  const deal = await loadDeal(input.dealId);
  const workspaceId = str(deal.workspaceId);
  assertWorkspace(input.actor, workspaceId);
  const sourceReference = clientSourceTextFromDeal(deal);
  const repository = new FirestoreMasterDataRepository();
  const explicitId = canonicalClientIdFromDeal(deal);
  if (explicitId) {
    const client = asCanonicalClient(await repository.getByCanonicalId("client", explicitId));
    if (!client) {
      return { status: "UNRESOLVED", dealId: input.dealId, workspaceId, sourceReference, canonicalId: explicitId, candidates: [], reason: "Deal clientId does not resolve to a canonical client.", nextAction: "Verify Client Identity" };
    }
    if (client.workspaceId !== workspaceId) {
      return { status: "UNRESOLVED", dealId: input.dealId, workspaceId, sourceReference, canonicalId: explicitId, candidates: [candidateSummary(client)], reason: "Deal clientId belongs to a different workspace.", nextAction: "Verify Client Identity" };
    }
    if (client.status !== "active" || client.verificationStatus !== "VERIFIED" || client.reviewStatus !== "READY_FOR_USE") {
      return { status: "CLIENT_VERIFICATION_REQUIRED", dealId: input.dealId, workspaceId, sourceReference, canonicalId: explicitId, candidates: [candidateSummary(client)], reason: "Canonical client is not verified for commercial authority.", nextAction: "Verify Client Identity" };
    }
    return { status: "RESOLVED_VERIFIED", dealId: input.dealId, workspaceId, sourceReference, canonicalId: client.canonicalId, candidates: [candidateSummary(client)], reason: "Deal carries a verified canonical client identity.", nextAction: "Continue pricing handoff" };
  }

  if (!workspaceId || !sourceReference) {
    return { status: "UNRESOLVED", dealId: input.dealId, workspaceId, sourceReference, canonicalId: null, candidates: [], reason: "Deal has no client text that can be resolved.", nextAction: "Verify Client Identity" };
  }
  const sourceKey = normalizeDisplayNameKey(sourceReference);
  const clients = (await repository.listByEntityType("client", workspaceId)).filter((entity): entity is CanonicalClient => entity.entityType === "client");
  const candidates = clients.filter((client) => clientMatchKey(client) === sourceKey);
  if (candidates.length > 1) {
    return { status: "AMBIGUOUS_CLIENT_MATCH", dealId: input.dealId, workspaceId, sourceReference, canonicalId: null, candidates: candidates.map(candidateSummary), reason: "Multiple canonical clients match this opportunity client text.", nextAction: "Verify Client Identity" };
  }
  if (candidates.length === 1) {
    const client = candidates[0];
    if (client.status === "active" && client.verificationStatus === "VERIFIED" && client.reviewStatus === "READY_FOR_USE") {
      return { status: "CLIENT_REVIEW_REQUIRED", dealId: input.dealId, workspaceId, sourceReference, canonicalId: client.canonicalId, candidates: [candidateSummary(client)], reason: "Verified client match exists and must be linked to the deal.", nextAction: "Verify Client Identity" };
    }
    return { status: "CLIENT_VERIFICATION_REQUIRED", dealId: input.dealId, workspaceId, sourceReference, canonicalId: client.canonicalId, candidates: [candidateSummary(client)], reason: "Matching canonical client exists but is not verified.", nextAction: "Verify Client Identity" };
  }
  return { status: "CLIENT_REVIEW_REQUIRED", dealId: input.dealId, workspaceId, sourceReference, canonicalId: null, candidates: [], reason: "No canonical client matches this opportunity client text.", nextAction: "Verify Client Identity" };
}

export async function createClientCandidateForDeal(input: { dealId: string; actor: AuthorizedUser }): Promise<{ entity: CanonicalClient; resolution: ClientIdentityResolution }> {
  assertPrivilegedRole(input.actor);
  const resolution = await resolveDealClientIdentity(input);
  if (resolution.status === "AMBIGUOUS_CLIENT_MATCH") throw Object.assign(new Error(resolution.reason), { status: 409, code: "AMBIGUOUS_CLIENT_MATCH" });
  if (resolution.canonicalId) throw Object.assign(new Error("A canonical client candidate already exists for this deal."), { status: 409, code: "CLIENT_CANDIDATE_EXISTS" });
  if (!resolution.workspaceId || !resolution.sourceReference) throw Object.assign(new Error("Client source text and workspace are required."), { status: 409, code: "CLIENT_SOURCE_REQUIRED" });
  const now = new Date().toISOString();
  const key = normalizeIdentityKey(resolution.sourceReference);
  const suffix = createHash("sha256").update(`${resolution.workspaceId}:${key}`).digest("hex").slice(0, 10).toUpperCase();
  const canonicalId = `TE-CLI-${suffix}`;
  const entity: CanonicalClient = {
    entityType: "client",
    canonicalId,
    displayName: resolution.sourceReference,
    legalName: resolution.sourceReference,
    tradingName: null,
    externalIdentifiers: [],
    workspaceId: resolution.workspaceId,
    organisationId: null,
    status: "active",
    provenance: "USER_CONFIRMED",
    verificationStatus: "PENDING_REVIEW",
    reviewStatus: "REVIEW_REQUIRED",
    sourceEvidence: [{ sourcePath: `deals/${input.dealId}`, evidenceStatus: "PENDING_REVIEW", provenance: "USER_CONFIRMED", evidencePurposes: ["GENERAL_REFERENCE"] }],
    notes: "Created from opportunity client text. Verification is required before commercial use.",
    createdAt: now,
    updatedAt: now,
    createdBy: input.actor.uid,
    updatedBy: input.actor.uid,
    registrationNumber: null,
    contactDetails: {},
    billingDetails: {},
    industrySector: null,
    relatedSiteIds: [],
    relatedOpportunityIds: [input.dealId],
    relatedProjectIds: [],
    documentIds: [],
  };
  const result = await createCanonicalMasterDataEntity({
    actor: actorFromAuthorizedUser(input.actor, resolution.workspaceId),
    repository: new FirestoreMasterDataRepository(),
    entity,
    reason: "Opportunity client identity candidate created for master-data review.",
  });
  return { entity: result.entity as CanonicalClient, resolution };
}

export async function linkVerifiedClientToDeal(input: { dealId: string; canonicalId: string; actor: AuthorizedUser; reason?: string | null }): Promise<{ clientId: string; reference: DealClientMasterDataReference }> {
  assertPrivilegedRole(input.actor);
  const deal = await loadDeal(input.dealId);
  const workspaceId = str(deal.workspaceId);
  assertWorkspace(input.actor, workspaceId);
  if (!workspaceId) throw Object.assign(new Error("Deal workspace is required before client linkage."), { status: 409, code: "WORKSPACE_REQUIRED" });
  const repository = new FirestoreMasterDataRepository();
  const client = asCanonicalClient(await repository.getByCanonicalId("client", input.canonicalId));
  if (!client) throw Object.assign(new Error("Canonical client not found."), { status: 404, code: "CLIENT_NOT_FOUND" });
  if (client.workspaceId !== workspaceId) throw Object.assign(new Error("Client belongs to a different workspace."), { status: 403, code: "CLIENT_WORKSPACE_MISMATCH" });
  if (client.status !== "active" || client.verificationStatus !== "VERIFIED" || client.reviewStatus !== "READY_FOR_USE") {
    throw Object.assign(new Error("Only VERIFIED canonical clients can be linked as commercial authority."), { status: 409, code: "CLIENT_NOT_VERIFIED" });
  }
  const previousClientId = canonicalClientIdFromDeal(deal);
  const now = new Date().toISOString();
  const reference: DealClientMasterDataReference = {
    status: "RESOLVED",
    entityType: "client",
    canonicalId: client.canonicalId,
    sourceReference: client.displayName,
    reason: "Verified canonical client linked to opportunity.",
    provenance: "OPERATIONAL_VERIFIED",
    verificationStatus: "VERIFIED",
    verifiedAt: str((client as AnyRecord).verifiedAt) ?? now,
    verifiedBy: str((client as AnyRecord).verifiedBy) ?? client.updatedBy,
    linkedAt: now,
    linkedBy: input.actor.uid,
    source: "masterClients",
  };
  await getFirebaseAdmin().collection("deals").doc(input.dealId).set({
    clientId: client.canonicalId,
    clientMasterDataReference: reference,
    updatedAt: new Date(),
  }, { merge: true });
  const auditId = `DCL-${randomUUID()}`;
  await getFirebaseAdmin().collection("dealClientIdentityAuditEvents").doc(auditId).set({
    id: auditId,
    action: "verified_client_linked",
    dealId: input.dealId,
    workspaceId,
    actorUid: input.actor.uid,
    actorRole: input.actor.role,
    previousClientId,
    newClientId: client.canonicalId,
    previousClientMasterDataReference: rec(deal.clientMasterDataReference),
    newClientMasterDataReference: reference,
    reason: input.reason ?? "Verified client linked to opportunity.",
    createdAt: now,
  });
  await getFirebaseAdmin().collection(MASTER_DATA_COLLECTIONS.client).doc(client.canonicalId).set({
    relatedOpportunityIds: Array.from(new Set([...(Array.isArray(client.relatedOpportunityIds) ? client.relatedOpportunityIds : []), input.dealId])),
    updatedAt: now,
    updatedBy: input.actor.uid,
  }, { merge: true });
  return { clientId: client.canonicalId, reference };
}

export async function assertDealHasVerifiedCanonicalClient(input: { deal: AnyRecord; actor: AuthorizedUser }): Promise<string> {
  const workspaceId = str(input.deal.workspaceId);
  assertWorkspace(input.actor, workspaceId);
  const clientId = canonicalClientIdFromDeal(input.deal);
  if (!clientId) throw Object.assign(new Error("Canonical Client_ID is required before creating a Client Quote"), { status: 409, code: "CLIENT_ID_REQUIRED" });
  const client = asCanonicalClient(await new FirestoreMasterDataRepository().getByCanonicalId("client", clientId));
  if (!client) throw Object.assign(new Error("Canonical Client_ID does not resolve to a client authority"), { status: 409, code: "CLIENT_ID_NOT_FOUND" });
  if (client.workspaceId !== workspaceId) throw Object.assign(new Error("Canonical Client_ID belongs to a different workspace"), { status: 403, code: "CLIENT_WORKSPACE_MISMATCH" });
  if (client.status !== "active" || client.verificationStatus !== "VERIFIED" || client.reviewStatus !== "READY_FOR_USE") {
    throw Object.assign(new Error("Canonical Client_ID is not verified for Client Quote authority"), { status: 409, code: "CLIENT_NOT_VERIFIED" });
  }
  return client.canonicalId;
}
