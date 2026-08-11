import { getFirebaseAdmin } from "@/lib/firebase/admin";
import { assertPrivilegedRole, type AuthorizedUser } from "@/lib/server/authz";
import type { ClientQuoteLine, ClientQuoteRecord, CommercialBlocker, VerifiedSupplierCostLine } from "@/types/commercialAuthority";
import { assertApprovedClientQuote, calculateApprovedSellingRate } from "@/server/services/commercialAuthorityService";

function asString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function assertWorkspace(actor: AuthorizedUser, workspaceId: string | null): void {
  if (actor.workspaceId && workspaceId && actor.workspaceId !== workspaceId) throw Object.assign(new Error("Cross-workspace Client Quote access rejected"), { status: 403 });
}

async function loadDeal(dealId: string): Promise<Record<string, unknown> & { id: string }> {
  const snapshot = await getFirebaseAdmin().collection("deals").doc(dealId).get();
  if (!snapshot.exists) throw Object.assign(new Error("Opportunity not found"), { status: 404 });
  return { id: snapshot.id, ...(snapshot.data() ?? {}) };
}

async function loadCost(costLineId: string): Promise<VerifiedSupplierCostLine> {
  const snapshot = await getFirebaseAdmin().collection("verifiedSupplierCosts").doc(costLineId).get();
  if (!snapshot.exists) throw Object.assign(new Error("Verified supplier cost not found"), { status: 409, code: "ITEM_COST_EVIDENCE_MISSING" });
  return snapshot.data() as VerifiedSupplierCostLine;
}

function audit(actor: AuthorizedUser, action: string, clientQuoteId: string, metadata: Record<string, unknown>) {
  return getFirebaseAdmin().collection("commercialAuthorityAuditEvents").add({ action, entityId: clientQuoteId, actor: actor.uid, workspaceId: actor.workspaceId ?? null, metadata, createdAt: new Date() });
}

export async function createClientQuoteDraft(input: {
  opportunityId: string;
  actor: AuthorizedUser;
  lines: Array<{ costLineId: string; method: "MARKUP" | "MARGIN"; percentage: number; quantity?: number | null; unit: string; description: string }>;
  generatedDocumentId?: string | null;
}): Promise<ClientQuoteRecord> {
  const deal = await loadDeal(input.opportunityId);
  const workspaceId = asString(deal.workspaceId);
  assertWorkspace(input.actor, workspaceId);
  const clientReference = deal.clientMasterDataReference && typeof deal.clientMasterDataReference === "object" ? (deal.clientMasterDataReference as Record<string, unknown>).canonicalId : null;
  const clientId = asString(deal.clientId ?? deal.client_ID ?? clientReference);
  if (!clientId) throw Object.assign(new Error("Canonical Client_ID is required before creating a Client Quote"), { status: 409, code: "CLIENT_ID_REQUIRED" });
  if (!input.lines.length) throw Object.assign(new Error("At least one commercial line is required"), { status: 409, code: "CLIENT_QUOTE_NOT_READY" });
  const lines: ClientQuoteLine[] = [];
  const blockers: CommercialBlocker[] = [];
  for (const inputLine of input.lines) {
    const cost = await loadCost(inputLine.costLineId);
    const rate = calculateApprovedSellingRate({ landedUnitCost: cost.landedUnitCost, method: inputLine.method, percentage: inputLine.percentage });
    if (rate === null) {
      blockers.push({ code: "SELLING_RATE_NOT_APPROVED", message: "Selling rate for " + cost.itemId + " is invalid.", itemId: cost.itemId });
      continue;
    }
    lines.push({ itemId: cost.itemId, landedUnitCost: cost.landedUnitCost, method: inputLine.method, percentage: inputLine.percentage, sellingUnitRate: rate, override: false, overrideReason: null, approvedBy: null as unknown as string, approvedAt: null as unknown as string, supplierQuoteId: cost.supplierQuoteId, supplierQuoteLineId: cost.supplierQuoteLineId, supplierId: cost.supplierId, supplierQuoteDocumentId: cost.supplierQuoteDocumentId, quantity: inputLine.quantity ?? null, unit: inputLine.unit, description: inputLine.description });
  }
  if (blockers.length) throw Object.assign(new Error("Client Quote pricing is not ready"), { status: 409, code: "CLIENT_QUOTE_NOT_READY", blockers });
  const clientQuoteId = "CQ-" + input.opportunityId + "-" + Date.now();
  const now = new Date().toISOString();
  const total = lines.every((line) => line.quantity !== null) ? lines.reduce((sum, line) => sum + line.sellingUnitRate * (line.quantity ?? 0), 0) : null;
  const quote: ClientQuoteRecord = { clientQuoteId, opportunityId: input.opportunityId, clientId, siteId: asString(deal.siteId), workspaceId: workspaceId ?? "", status: "DRAFT", currency: "ZAR", taxTreatment: "EXCLUSIVE", lines, total, generatedDocumentId: input.generatedDocumentId ?? null, previousClientQuoteId: null, createdBy: input.actor.uid, createdAt: now, approvedBy: null, approvedAt: null, updatedAt: now };
  await getFirebaseAdmin().collection("clientQuotes").doc(clientQuoteId).set(quote);
  await audit(input.actor, "client_quote_created", clientQuoteId, { opportunityId: input.opportunityId, lineCount: lines.length });
  return quote;
}

export async function approveClientQuote(input: { clientQuoteId: string; actor: AuthorizedUser; generatedDocumentId?: string | null; overrideReason?: string | null }): Promise<ClientQuoteRecord> {
  assertPrivilegedRole(input.actor);
  const reference = await getFirebaseAdmin().collection("clientQuotes").doc(input.clientQuoteId).get();
  if (!reference.exists) throw Object.assign(new Error("Client Quote not found"), { status: 404 });
  const quote = reference.data() as ClientQuoteRecord;
  assertWorkspace(input.actor, quote.workspaceId);
  const generatedDocumentId = input.generatedDocumentId ?? quote.generatedDocumentId;
  if (!generatedDocumentId) throw Object.assign(new Error("Approved Client Quote requires a persisted Document_ID"), { status: 409, code: "CLIENT_QUOTE_ARTIFACT_REQUIRED" });
  const document = await getFirebaseAdmin().collection("masterDocuments").doc(generatedDocumentId).get();
  if (!document.exists) throw Object.assign(new Error("Client Quote Document_ID is not a governed document"), { status: 409, code: "CLIENT_QUOTE_ARTIFACT_REQUIRED" });
  const approvedAt = new Date().toISOString();
  const approved: ClientQuoteRecord = { ...quote, status: "APPROVED", generatedDocumentId, approvedBy: input.actor.uid, approvedAt, updatedAt: approvedAt, lines: quote.lines.map((line) => ({ ...line, approvedBy: input.actor.uid, approvedAt })) };
  await getFirebaseAdmin().collection("clientQuotes").doc(input.clientQuoteId).set(approved);
  await audit(input.actor, "client_quote_approved", input.clientQuoteId, { generatedDocumentId, overrideReason: input.overrideReason ?? null });
  return approved;
}

export async function getApprovedClientQuote(opportunityId: string, clientQuoteId: string | null | undefined, actor: AuthorizedUser) {
  return assertApprovedClientQuote({ opportunityId, clientQuoteId, actor });
}
