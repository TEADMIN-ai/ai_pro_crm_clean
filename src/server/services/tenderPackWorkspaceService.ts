import { getFirebaseAdmin } from "@/lib/firebase/admin";
import { assertDealWorkspaceAccess } from "@/lib/procurement/procurementStateAuthority";
import type { AuthorizedUser } from "@/lib/server/authz";
import { assertPrivilegedRole } from "@/lib/server/authz";
import { resolveApprovedClientQuote } from "@/server/services/commercialAuthorityService";
import { resolveVerifiedTenderPackDocument } from "@/server/services/tenderPackCommercialAuthorityService";

type AnyRecord = Record<string, unknown>;

export type TenderPackWorkspacePrerequisite = {
  key: string;
  label: string;
  status: "READY" | "BLOCKED";
  detail: string;
};

export type TenderPackWorkspaceState = {
  dealId: string;
  opportunityId: string;
  workspaceId: string | null;
  dealTitle: string | null;
  contractor: {
    contractorId: string | null;
    name: string | null;
    complianceApproved: boolean | null;
    tenderLockStatus: string | null;
    docsMissing: number | null;
    expiredDocumentCount: number | null;
  };
  clientQuote: {
    clientQuoteId: string;
    status: string;
    generatedDocumentId: string | null;
  } | null;
  tenderPacks: Array<{
    packId: string;
    dealId: string | null;
    opportunityId: string | null;
    workspaceId: string | null;
    clientQuoteId: string | null;
    governanceMode: string | null;
    storagePath: string | null;
    createdAt: unknown;
  }>;
  tenderPackDocument: {
    documentId: string;
    documentType: string | null;
    linkedEntityId: string | null;
    workspaceId: string | null;
    status: string | null;
    verificationStatus: string | null;
    reviewStatus: string | null;
    storagePath: string | null;
  } | null;
  durableReady: boolean;
  canGenerate: boolean;
  generationEndpoint: "/api/tender-pack/generate";
  generationPayload: { dealId: string; clientQuoteId: string } | null;
  prerequisites: TenderPackWorkspacePrerequisite[];
  blockers: string[];
};

function asRecord(value: unknown): AnyRecord {
  return value && typeof value === "object" && !Array.isArray(value) ? value as AnyRecord : {};
}

function asString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function asNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function getAssignedContractorId(deal: AnyRecord): string | null {
  const assignment = asRecord(deal.contractorAssignment);
  return asString(assignment.contractorId) ?? asString(deal.contractorId);
}

function displayName(record: AnyRecord): string | null {
  return asString(record.companyName) ?? asString(record.tradingName) ?? asString(record.name);
}

function prerequisite(key: string, label: string, ready: boolean, detail: string): TenderPackWorkspacePrerequisite {
  return { key, label, status: ready ? "READY" : "BLOCKED", detail };
}

async function queryByDeal(collection: string, dealId: string) {
  const db = getFirebaseAdmin();
  const byDeal = await db.collection(collection).where("dealId", "==", dealId).get();
  const byOpportunity = await db.collection(collection).where("opportunityId", "==", dealId).get();
  const deduped = new Map<string, FirebaseFirestore.QueryDocumentSnapshot>();
  for (const doc of [...byDeal.docs, ...byOpportunity.docs]) deduped.set(doc.id, doc);
  return Array.from(deduped.values());
}

export async function getTenderPackWorkspaceState(input: {
  dealId: string;
  actor: AuthorizedUser;
}): Promise<TenderPackWorkspaceState> {
  assertPrivilegedRole(input.actor);
  const dealId = input.dealId.trim();
  if (!dealId) throw Object.assign(new Error("Missing dealId"), { status: 400 });

  const db = getFirebaseAdmin();
  const dealSnapshot = await db.collection("deals").doc(dealId).get();
  if (!dealSnapshot.exists) throw Object.assign(new Error("Deal not found"), { status: 404 });

  const deal = { id: dealSnapshot.id, ...(dealSnapshot.data() ?? {}) } as AnyRecord & { id: string };
  await assertDealWorkspaceAccess(input.actor, deal);

  const workspaceId = asString(deal.workspaceId);
  const contractorId = getAssignedContractorId(deal);
  const contractorSnapshot = contractorId ? await db.collection("contractors").doc(contractorId).get() : null;
  const contractor = contractorSnapshot?.exists ? contractorSnapshot.data() ?? {} : {};

  let clientQuote: TenderPackWorkspaceState["clientQuote"] = null;
  const blockers: string[] = [];
  try {
    const resolved = await resolveApprovedClientQuote({ opportunityId: deal.id, workspaceId, actor: input.actor });
    clientQuote = {
      clientQuoteId: resolved.clientQuoteId,
      status: resolved.status,
      generatedDocumentId: resolved.generatedDocumentId,
    };
  } catch {
    blockers.push("Approved Client Quote must be generated");
  }

  let tenderPackDocument: TenderPackWorkspaceState["tenderPackDocument"] = null;
  try {
    const document = await resolveVerifiedTenderPackDocument({ opportunityId: deal.id, workspaceId });
    tenderPackDocument = {
      documentId: asString(document.documentId) ?? document.id as string,
      documentType: asString(document.documentType),
      linkedEntityId: asString(document.linkedEntityId),
      workspaceId: asString(document.workspaceId),
      status: asString(document.status),
      verificationStatus: asString(document.verificationStatus),
      reviewStatus: asString(document.reviewStatus),
      storagePath: asString(document.storagePath),
    };
  } catch {
    blockers.push("Durable Tender Pack must be generated");
  }

  const tenderPackDocs = await queryByDeal("tenderPacks", deal.id);
  const tenderPacks = tenderPackDocs.map((doc) => {
    const data = doc.data() ?? {};
    return {
      packId: doc.id,
      dealId: asString(data.dealId),
      opportunityId: asString(data.opportunityId),
      workspaceId: asString(data.workspaceId),
      clientQuoteId: asString(data.clientQuoteId),
      governanceMode: asString(data.governanceMode),
      storagePath: asString(data.storagePath),
      createdAt: data.createdAt ?? null,
    };
  });

  const complianceApproved = typeof contractor.complianceApproved === "boolean" ? contractor.complianceApproved : null;
  const docsMissing = asNumber(contractor.docsMissing);
  const expiredDocumentCount = asNumber(contractor.expiredDocumentCount);
  const tenderLockStatus = asString(contractor.tenderLockStatus);
  const contractorReady = Boolean(contractorId && contractorSnapshot?.exists);
  const complianceReady = complianceApproved === true && (docsMissing ?? 0) === 0 && (expiredDocumentCount ?? 0) === 0 && tenderLockStatus === "READY";
  if (!workspaceId) blockers.push("Deal workspaceId is required");
  if (!contractorReady) blockers.push("Authoritative contractor assignment is required");
  if (!complianceReady) blockers.push("Contractor compliance must be READY");

  const prerequisites = [
    prerequisite("deal", "Deal connected", true, deal.id),
    prerequisite("workspace", "Workspace connected", Boolean(workspaceId), workspaceId ?? "Missing workspaceId"),
    prerequisite("client_quote", "Approved Client Quote", Boolean(clientQuote), clientQuote?.clientQuoteId ?? "Missing approved canonical Client Quote"),
    prerequisite("contractor", "Assigned contractor", contractorReady, contractorId ?? "Missing authoritative contractor assignment"),
    prerequisite("compliance", "Contractor compliance", complianceReady, tenderLockStatus ?? "Compliance state unavailable"),
    prerequisite("tender_pack_document", "Durable Tender Pack authority", Boolean(tenderPackDocument), tenderPackDocument?.documentId ?? "No active VERIFIED TENDER_PACK document"),
  ];

  const durableReady = Boolean(tenderPackDocument);
  const canGenerate = Boolean(workspaceId && clientQuote && contractorReady && complianceReady);

  return {
    dealId: deal.id,
    opportunityId: deal.id,
    workspaceId,
    dealTitle: asString(deal.title) ?? asString(deal.rfqNumber),
    contractor: {
      contractorId,
      name: displayName(contractor),
      complianceApproved,
      tenderLockStatus,
      docsMissing,
      expiredDocumentCount,
    },
    clientQuote,
    tenderPacks,
    tenderPackDocument,
    durableReady,
    canGenerate,
    generationEndpoint: "/api/tender-pack/generate",
    generationPayload: clientQuote ? { dealId: deal.id, clientQuoteId: clientQuote.clientQuoteId } : null,
    prerequisites,
    blockers: Array.from(new Set(blockers)),
  };
}
