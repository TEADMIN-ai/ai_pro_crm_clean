import { randomUUID } from "node:crypto";
import { getFirebaseAdmin } from "@/lib/firebase/admin";
import { assertPrivilegedRole, type AuthorizedUser } from "@/lib/server/authz";
import { FirestoreMasterDataRepository, MASTER_DATA_COLLECTIONS } from "@/lib/master-data/firestoreRepository";
import type { CanonicalDocumentReference, CanonicalItem } from "@/types/masterData";
import type {
  ApprovedSellingRate,
  ClientQuoteLine,
  ClientQuoteRecord,
  CommercialAuthorityCheck,
  CommercialBlocker,
  SupplierQuoteCommercialInput,
  VerifiedSupplierCostLine,
} from "@/types/commercialAuthority";
import type { SupplierQuote, SupplierQuoteLineItem } from "@/types/supplierQuote";

function asString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

function isExpired(value: string | null | undefined, today = new Date()): boolean {
  if (!value) return false;
  const date = new Date(value);
  return Number.isFinite(date.getTime()) && date.getTime() < new Date(today.toDateString()).getTime();
}

export function calculateLandedUnitCost(input: {
  unitCostExcl: number;
  deliveryCost?: number | null;
  otherLandedCost?: number | null;
  quantity?: number | null;
}): number | null {
  if (!Number.isFinite(input.unitCostExcl) || input.unitCostExcl < 0) return null;
  const delivery = input.deliveryCost ?? 0;
  const other = input.otherLandedCost ?? 0;
  if (![delivery, other].every((value) => Number.isFinite(value) && value >= 0)) return null;
  const quantity = input.quantity ?? 1;
  if (!Number.isFinite(quantity) || quantity <= 0) return null;
  return roundMoney(input.unitCostExcl + (delivery + other) / quantity);
}

export function calculateSellingRate(input: {
  landedUnitCost: number;
  method: "MARKUP" | "MARGIN";
  percentage: number;
}): number | null {
  if (!Number.isFinite(input.landedUnitCost) || input.landedUnitCost < 0 || !Number.isFinite(input.percentage) || input.percentage < 0 || input.percentage >= 1) return null;
  if (input.method === "MARKUP") return roundMoney(input.landedUnitCost * (1 + input.percentage));
  if (input.method === "MARGIN") return roundMoney(input.landedUnitCost / (1 - input.percentage));
  return null;
}

export function evaluateSupplierQuoteLine(input: SupplierQuoteCommercialInput): CommercialAuthorityCheck {
  const blockers: CommercialBlocker[] = [];
  const quote = input.quote;
  const line = input.line;
  if (!quote.supplierId || quote.supplierResolutionStatus !== "RESOLVED_VERIFIED") blockers.push({ code: "SUPPLIER_ID_REQUIRED", message: "A verified canonical Supplier_ID is required.", supplierQuoteId: quote.id, supplierQuoteLineId: line.id });
  const documentId = quote.masterDocumentId;
  if (!documentId) blockers.push({ code: "SUPPLIER_QUOTE_DOCUMENT_REQUIRED", message: "A governed supplier quote Document_ID is required.", supplierQuoteId: quote.id, supplierQuoteLineId: line.id });
  if (input.documentVerificationStatus !== "VERIFIED") blockers.push({ code: "SUPPLIER_QUOTE_EVIDENCE_NOT_ACCEPTED", message: "Supplier quote evidence is not verified.", supplierQuoteId: quote.id, supplierQuoteLineId: line.id });
  if (!["PRESENT", "VERIFIED"].includes(input.documentEvidenceStatus ?? "")) blockers.push({ code: "SUPPLIER_QUOTE_EVIDENCE_NOT_ACCEPTED", message: "Supplier quote evidence is not present for current pricing.", supplierQuoteId: quote.id, supplierQuoteLineId: line.id });
  if (quote.approvalStatus !== "APPROVED" && quote.approvalStatus !== "LOCKED") blockers.push({ code: "SUPPLIER_QUOTE_NOT_APPROVED", message: "Supplier quote review approval is required.", supplierQuoteId: quote.id, supplierQuoteLineId: line.id });
  if (["REJECTED", "SUPERSEDED", "EXPIRED"].includes(quote.workflowStatus) || quote.supersedesQuoteId) blockers.push({ code: "SUPPLIER_QUOTE_SUPERSEDED", message: "Rejected, expired, or superseded supplier quotes cannot provide current cost authority.", supplierQuoteId: quote.id, supplierQuoteLineId: line.id });
  if (isExpired(quote.validityDate, input.today)) blockers.push({ code: "SUPPLIER_QUOTE_EXPIRED", message: "Expired supplier quotes cannot provide current cost authority.", supplierQuoteId: quote.id, supplierQuoteLineId: line.id });
  if (!quote.currency || quote.currency === "UNKNOWN") blockers.push({ code: "SUPPLIER_QUOTE_CURRENCY_UNKNOWN", message: "Supplier quote currency must be known.", supplierQuoteId: quote.id, supplierQuoteLineId: line.id });
  if (line.vatTreatment === "UNKNOWN") blockers.push({ code: "SUPPLIER_QUOTE_TAX_UNKNOWN", message: "Supplier quote tax treatment must be known.", supplierQuoteId: quote.id, supplierQuoteLineId: line.id });
  if (!input.itemId) blockers.push({ code: "ITEM_ID_REQUIRED", message: "The supplier quote line must resolve to a canonical Item_ID.", supplierQuoteId: quote.id, supplierQuoteLineId: line.id });
  if (input.itemUnit && line.unit && input.itemUnit.trim().toLowerCase() !== line.unit.trim().toLowerCase()) blockers.push({ code: "UNIT_MISMATCH", message: "Supplier quote unit is incompatible with the canonical item unit.", supplierQuoteId: quote.id, supplierQuoteLineId: line.id, itemId: input.itemId });
  const landedUnitCost = calculateLandedUnitCost({ unitCostExcl: line.unitPrice, deliveryCost: quote.deliveryCost, quantity: line.quantity });
  if (landedUnitCost === null) blockers.push({ code: "LANDED_COST_INCOMPLETE", message: "Supplier cost and explicit landed-cost inputs are incomplete.", supplierQuoteId: quote.id, supplierQuoteLineId: line.id, itemId: input.itemId });
  if (blockers.length || !documentId || !input.itemId || landedUnitCost === null || !quote.supplierId) return { allowed: false, blockers };
  return {
    allowed: true,
    blockers: [],
    costLine: {
      supplierQuoteId: quote.id,
      supplierId: quote.supplierId,
      supplierQuoteDocumentId: documentId,
      supplierQuoteLineId: line.id,
      itemId: input.itemId,
      supplierItemDescription: line.sourceDescription,
      unitOfMeasure: line.unit,
      unitCostExcl: line.unitPrice,
      unitCostIncl: line.vatTreatment === "INCLUSIVE" ? line.unitPrice : null,
      vatRate: quote.vat > 0 && quote.subtotal > 0 ? roundMoney(quote.vat / quote.subtotal) : null,
      deliveryCost: quote.deliveryCost,
      otherLandedCost: 0,
      landedUnitCost,
      currency: quote.currency,
      quoteDate: quote.quotationDate ?? null,
      validUntil: quote.validityDate ?? null,
      opportunityId: quote.opportunityId,
      verifiedAt: new Date().toISOString(),
      verifiedBy: "server",
    },
  };
}

async function loadQuote(quoteId: string): Promise<SupplierQuote> {
  const snapshot = await getFirebaseAdmin().collection("supplierQuotes").doc(quoteId).get();
  if (!snapshot.exists) throw Object.assign(new Error("Supplier quote not found"), { status: 404 });
  return { id: snapshot.id, ...(snapshot.data() ?? {}) } as SupplierQuote;
}

async function loadDocument(documentId: string): Promise<CanonicalDocumentReference | null> {
  const snapshot = await getFirebaseAdmin().collection(MASTER_DATA_COLLECTIONS.document).doc(documentId).get();
  return snapshot.exists ? snapshot.data() as CanonicalDocumentReference : null;
}

async function loadItem(itemId: string): Promise<CanonicalItem | null> {
  const repository = new FirestoreMasterDataRepository();
  const item = await repository.getByCanonicalId("item", itemId);
  return item?.entityType === "item" ? item : null;
}

async function audit(actor: AuthorizedUser, action: string, entityId: string, metadata: Record<string, unknown>) {
  await getFirebaseAdmin().collection("commercialAuthorityAuditEvents").doc(randomUUID()).set({ action, entityId, actor: actor.uid, workspaceId: actor.workspaceId ?? null, metadata, createdAt: new Date() });
}

export async function verifySupplierQuoteLine(input: { quoteId: string; lineId: string; itemId: string; actor: AuthorizedUser }): Promise<VerifiedSupplierCostLine> {
  assertPrivilegedRole(input.actor);
  const quote = await loadQuote(input.quoteId);
  const line: SupplierQuoteLineItem | undefined = quote.lineItems.find((candidate) => candidate.id === input.lineId);
  if (!line) throw Object.assign(new Error("Supplier quote line not found"), { status: 404 });
  const documentId = quote.masterDocumentId;
  const document = documentId ? await loadDocument(documentId) : null;
  const item = await loadItem(input.itemId);
  const check = evaluateSupplierQuoteLine({ quote, line, itemId: item?.itemId ?? null, itemUnit: item?.unit, documentVerificationStatus: document?.verificationStatus ?? "MISSING", documentEvidenceStatus: document?.evidenceStatus ?? "MISSING" });
  if (!check.allowed || !check.costLine) {
    await audit(input.actor, "supplier_cost_verification_blocked", input.quoteId, { blockers: check.blockers, itemId: input.itemId });
    throw Object.assign(new Error("Supplier cost is not verified"), { status: 409, code: "SUPPLIER_COST_NOT_READY", blockers: check.blockers });
  }
  const costLine = { ...check.costLine, verifiedBy: input.actor.uid };
  await getFirebaseAdmin().collection("verifiedSupplierCosts").doc(`${input.quoteId}__${input.lineId}__${input.itemId}`).set(costLine);
  await audit(input.actor, "supplier_quote_line_item_resolved", input.quoteId, { costLine, documentId });
  return costLine;
}

export async function assertApprovedClientQuote(input: { opportunityId: string; clientQuoteId?: string | null; actor: AuthorizedUser }): Promise<ClientQuoteRecord> {
  const clientQuoteId = asString(input.clientQuoteId);
  if (!clientQuoteId) throw Object.assign(new Error("An approved Client_Quote_ID is required"), { status: 409, code: "CLIENT_QUOTE_NOT_APPROVED" });
  const snapshot = await getFirebaseAdmin().collection("clientQuotes").doc(clientQuoteId).get();
  const quote = snapshot.exists ? snapshot.data() as ClientQuoteRecord : null;
  if (!quote || quote.opportunityId !== input.opportunityId || quote.status !== "APPROVED") throw Object.assign(new Error("Approved Client Quote is required for this opportunity"), { status: 409, code: "CLIENT_QUOTE_NOT_APPROVED" });
  if (quote.workspaceId && input.actor.workspaceId && quote.workspaceId !== input.actor.workspaceId) throw Object.assign(new Error("Cross-workspace Client Quote access rejected"), { status: 403 });
  if (!quote.generatedDocumentId) throw Object.assign(new Error("Approved Client Quote artifact is required"), { status: 409, code: "CLIENT_QUOTE_ARTIFACT_REQUIRED" });
  if (!quote.lines.length || quote.lines.some((line) => !line.approvedBy || !line.approvedAt)) throw Object.assign(new Error("Approved selling rates are required for every Client Quote line"), { status: 409, code: "SELLING_RATE_NOT_APPROVED" });
  return quote;
}

export async function resolveApprovedClientQuote(input: { opportunityId: string; workspaceId?: string | null; clientQuoteId?: string | null; actor: AuthorizedUser }): Promise<ClientQuoteRecord> {
  const db = getFirebaseAdmin(); const requestedId = asString(input.clientQuoteId);
  const snapshots = requestedId ? [await db.collection("clientQuotes").doc(requestedId).get()] : (await db.collection("clientQuotes").where("opportunityId", "==", input.opportunityId).get()).docs;
  const candidates: ClientQuoteRecord[] = [];
  for (const snapshot of snapshots) {
    if (!snapshot.exists) continue;
    const quote = { clientQuoteId: snapshot.id, ...(snapshot.data() ?? {}) } as ClientQuoteRecord;
    if (quote.opportunityId !== input.opportunityId || quote.status !== "APPROVED" || (input.workspaceId && quote.workspaceId !== input.workspaceId) || !quote.generatedDocumentId || !quote.lines?.length || quote.lines.some((line) => !line.approvedBy || !line.approvedAt)) continue;
    const document = await loadDocument(quote.generatedDocumentId);
    if (document?.verificationStatus === "VERIFIED") candidates.push(quote);
  }
  if (candidates.length === 0) throw Object.assign(new Error("No eligible approved Client Quote exists for this opportunity"), { status: 409, code: "CLIENT_QUOTE_NOT_APPROVED" });
  if (candidates.length > 1) throw Object.assign(new Error("Multiple eligible approved Client Quotes require explicit governance resolution"), { status: 409, code: "CLIENT_QUOTE_AMBIGUOUS" });
  if (input.actor.workspaceId && candidates[0].workspaceId !== input.actor.workspaceId) throw Object.assign(new Error("Cross-workspace Client Quote access rejected"), { status: 403 });
  return candidates[0];
}

export function buildClientQuoteLine(input: { costLine: VerifiedSupplierCostLine; sellingRate: ApprovedSellingRate; quantity: number | null; unit: string; description: string }): ClientQuoteLine {
  return { ...input.sellingRate, supplierQuoteId: input.costLine.supplierQuoteId, supplierQuoteLineId: input.costLine.supplierQuoteLineId, supplierId: input.costLine.supplierId, supplierQuoteDocumentId: input.costLine.supplierQuoteDocumentId, quantity: input.quantity, unit: input.unit, description: input.description };
}

export function assertNoUnapprovedSellingRate(lines: ClientQuoteLine[]): CommercialBlocker[] {
  return lines.filter((line) => !line.approvedBy || !line.approvedAt || !Number.isFinite(line.sellingUnitRate)).map((line) => ({ code: "SELLING_RATE_NOT_APPROVED", message: `Selling rate for ${line.itemId} is not approved.`, itemId: line.itemId }));
}

export { calculateSellingRate as calculateApprovedSellingRate };
