import { randomUUID } from "node:crypto";
import { Timestamp } from "firebase-admin/firestore";
import { getFirebaseAdmin, getFirebaseStorageBucket } from "@/lib/firebase/admin";
import { FirestoreMasterDataRepository, actorFromAuthorizedUser, createCanonicalMasterDataEntity, resolveSupplierForQuote } from "@/lib/master-data";
import { createSupplierProfile, listSupplierProfiles } from "@/lib/qs/supplier-intelligence";
import {
  SUPPLIER_QUOTE_AUDIT_COLLECTION,
  SUPPLIER_QUOTE_COLLECTION,
  TORQUE_EMPIRE_CONTRACTOR_NAME,
  applyManualCorrections,
  buildDuplicateKey,
  buildExecutionStatus,
  buildPricingHandoff,
  compareSupplierQuotes,
  emptyExtraction,
  extractLineItemsFromText,
  extractSupplierQuoteFromText,
  normalizeIdentifier,
  normalizeSupplierName,
  nowIso,
  parseMoney,
} from "@/lib/supplier-quotes/supplierQuoteModel";
import { extractTextFromPdfDetailed } from "@/lib/pdf/extractTextFromPdf";
import type { AuthorizedUser } from "@/lib/server/authz";
import type { CanonicalDocumentReference, MasterDataEvidenceReference, SupplierResolutionResult } from "@/types/masterData";
import type { QSSupplierProfile, QsProvince } from "@/types/qs";
import type {
  SupplierQuote,
  SupplierQuoteComparison,
  SupplierQuoteExecutionStatus,
  SupplierQuoteLineItem,
  SupplierQuotePricingHandoff,
} from "@/types/supplierQuote";

type SupplierIdentityInput = {
  supplierId?: string | null;
  supplierName: string;
  supplierRegistrationNumber?: string | null;
  supplierContactName?: string | null;
  supplierEmail?: string | null;
  supplierPhone?: string | null;
};

type UploadSupplierQuoteInput = SupplierIdentityInput & {
  workspaceId?: string | null;
  opportunityId: string;
  dealId: string;
  contractorId?: string | null;
  contractorName?: string | null;
  quotationNumber?: string | null;
  quotationDate?: string | null;
  validityDate?: string | null;
  currency?: string | null;
  subtotal?: number | string | null;
  vat?: number | string | null;
  total?: number | string | null;
  deliveryCost?: number | string | null;
  deliveryPeriod?: string | null;
  paymentTerms?: string | null;
  uploadedDocumentId?: string | null;
  storagePath?: string | null;
  sourceFileName?: string | null;
  fileBuffer?: Buffer | null;
  contentType?: string | null;
  lineItems?: SupplierQuoteLineItem[];
  createdBy: string;
};

type ApprovalInput = {
  quoteId: string;
  actor: AuthorizedUser;
  action: "approve" | "reject" | "request_clarification";
  note?: string | null;
  rejectionReason?: string | null;
  clarificationRequest?: string | null;
  approvedLineItemIds?: string[];
};

function asString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? value as Record<string, unknown> : {};
}

function supplierMatches(input: SupplierIdentityInput, supplier: QSSupplierProfile): boolean {
  const registration = normalizeIdentifier(input.supplierRegistrationNumber);
  const email = normalizeIdentifier(input.supplierEmail);
  const phone = normalizeIdentifier(input.supplierPhone);
  const name = normalizeSupplierName(input.supplierName);
  return Boolean(
    (registration && normalizeIdentifier(supplier.companyRegistrationNumber) === registration) ||
    (email && normalizeIdentifier(supplier.email) === email) ||
    (phone && normalizeIdentifier(supplier.phone) === phone) ||
    (name && normalizeSupplierName(supplier.supplierName) === name) ||
    (name && normalizeSupplierName(supplier.tradingName) === name),
  );
}

function numberScore() {
  return 70;
}

async function loadDeal(dealId: string): Promise<Record<string, unknown> & { id: string }> {
  const snapshot = await getFirebaseAdmin().collection("deals").doc(dealId).get();
  if (!snapshot.exists) throw Object.assign(new Error("Deal not found"), { status: 404 });
  return { id: snapshot.id, ...(snapshot.data() ?? {}) };
}

async function getUserWorkspaceId(uid: string): Promise<string | null> {
  const snapshot = await getFirebaseAdmin().collection("users").doc(uid).get();
  return asString((snapshot.data() ?? {}).workspaceId);
}

async function assertWorkspaceAccess(actor: AuthorizedUser, workspaceId: string | null | undefined) {
  const actorWorkspaceId = await getUserWorkspaceId(actor.uid);
  if (actorWorkspaceId && workspaceId && actorWorkspaceId !== workspaceId) {
    throw Object.assign(new Error("Cross-workspace access rejected"), { status: 403 });
  }
}

async function listQuotesByDeal(dealId: string): Promise<SupplierQuote[]> {
  const snapshot = await getFirebaseAdmin()
    .collection(SUPPLIER_QUOTE_COLLECTION)
    .where("dealId", "==", dealId)
    .limit(100)
    .get();
  return snapshot.docs.map((doc) => ({ id: doc.id, ...(doc.data() ?? {}) }) as SupplierQuote);
}

async function listRequiredLineItems(deal: Record<string, unknown>): Promise<string[]> {
  const requirements = asRecord(asRecord(deal.opportunityExecution).requirements);
  const lines = requirements.lineItems;
  if (Array.isArray(lines)) return lines.filter((item): item is string => typeof item === "string" && item.trim().length > 0);
  const docs = Array.isArray(deal.documents) ? deal.documents : [];
  return docs
    .map((item) => asString(asRecord(item).description) ?? asString(asRecord(item).name))
    .filter((item): item is string => Boolean(item));
}

async function writeAuditEvent(input: {
  quoteId: string;
  dealId: string;
  workspaceId: string;
  actorUid: string;
  action: string;
  note?: string | null;
  metadata?: Record<string, unknown>;
}) {
  const id = `${input.quoteId}__${input.action}__${Date.now()}`;
  const payload = {
    id,
    quoteId: input.quoteId,
    dealId: input.dealId,
    workspaceId: input.workspaceId,
    actorUid: input.actorUid,
    action: input.action,
    note: input.note ?? null,
    metadata: input.metadata ?? {},
    createdAt: nowIso(),
  };
  await Promise.all([
    getFirebaseAdmin().collection(SUPPLIER_QUOTE_AUDIT_COLLECTION).doc(id).set(payload),
    getFirebaseAdmin().collection("deals").doc(input.dealId).collection("activity").doc(id).set({
      type: "supplier_quote",
      message: `Supplier quote ${input.action.toLowerCase().replace(/_/g, " ")}`,
      quoteId: input.quoteId,
      performedByEmail: null,
      createdAt: Timestamp.fromDate(new Date()),
    }),
  ]);
}

async function ensureQsSupplierCompatibilityProfile(input: SupplierIdentityInput & { actorUid: string; supplierId: string; status: SupplierResolutionResult["status"] }): Promise<QSSupplierProfile | null> {
  const suppliers = await listSupplierProfiles(500);
  const existing = suppliers.find((supplier) => supplier.supplierId === input.supplierId || supplierMatches(input, supplier));
  if (existing) return existing;

  const timestamp = nowIso();
  const score = numberScore();
  return createSupplierProfile({
    supplierId: input.supplierId,
    supplierName: input.supplierName,
    tradingName: null,
    companyRegistrationNumber: input.supplierRegistrationNumber ?? null,
    vatNumber: null,
    bbbeeLevel: null,
    contactPerson: input.supplierContactName ?? null,
    phone: input.supplierPhone ?? null,
    email: input.supplierEmail ?? null,
    website: null,
    branches: [],
    deliveryAreas: ["National"] as QsProvince[],
    productCategories: [],
    paymentTerms: null,
    warrantyNotes: null,
    qualityScore: score,
    reliabilityScore: score,
    deliveryScore: score,
    priceCompetitivenessScore: score,
    stockAvailabilityScore: score,
    overallSupplierScore: score,
    isPreferredSupplier: false,
    isSponsoredSupplier: false,
    supplierSubscriptionTier: "none",
    leadFeeEnabled: false,
    leadFeeAmount: null,
    referralCommissionEnabled: false,
    referralCommissionPercentage: null,
    featuredPlacementEnabled: false,
    status: input.status === "RESOLVED_VERIFIED" ? "active" : "pendingReview",
    version: 1,
    createdAt: timestamp,
    updatedAt: timestamp,
    createdBy: input.actorUid,
    updatedBy: input.actorUid,
    createdByUid: input.actorUid,
    updatedByUid: input.actorUid,
  });
}

async function resolveSupplierIdentityForQuote(input: SupplierIdentityInput & {
  actor: AuthorizedUser;
  workspaceId: string;
  quoteId: string;
  evidence: MasterDataEvidenceReference[];
}): Promise<SupplierResolutionResult> {
  const repository = new FirestoreMasterDataRepository();
  const result = await resolveSupplierForQuote({
    actor: actorFromAuthorizedUser(input.actor, input.workspaceId),
    repository,
    supplier: {
      workspaceId: input.workspaceId,
      supplierId: input.supplierId,
      supplierName: input.supplierName,
      legalName: input.supplierName,
      registrationNumber: input.supplierRegistrationNumber,
      contactPerson: input.supplierContactName,
      email: input.supplierEmail,
      phone: input.supplierPhone,
      evidenceReferences: input.evidence,
      quoteId: input.quoteId,
    },
  });
  if (result.supplierId) {
    await ensureQsSupplierCompatibilityProfile({ ...input, actorUid: input.actor.uid, supplierId: result.supplierId, status: result.status });
  }
  return result;
}

async function persistSupplierQuoteDocumentReference(input: {
  actor: AuthorizedUser;
  workspaceId: string;
  quoteId: string;
  supplierId: string | null;
  storagePath: string | null;
  sourceFileName: string | null;
  quotationDate?: string | null;
  validityDate?: string | null;
}): Promise<string | null> {
  if (!input.storagePath && !input.sourceFileName) return null;
  const now = nowIso();
  const documentId = input.quoteId ? `MDOC-${input.quoteId}` : `MDOC-${randomUUID()}`;
  const document: CanonicalDocumentReference = {
    entityType: "document",
    documentId,
    canonicalId: documentId,
    documentType: "SUPPLIER_QUOTE",
    linkedEntityType: input.supplierId ? "supplier" : "source",
    linkedEntityId: input.supplierId ?? input.quoteId,
    displayName: input.sourceFileName ?? documentId,
    legalName: null,
    tradingName: null,
    externalIdentifiers: [{ system: "supplier_quote", value: input.quoteId, status: "active" }],
    workspaceId: input.workspaceId,
    organisationId: null,
    status: "active",
    provenance: "OPERATIONAL_VERIFIED",
    verificationStatus: "PENDING_REVIEW",
    reviewStatus: "REVIEW_REQUIRED",
    sourceEvidence: [{ storagePath: input.storagePath, filename: input.sourceFileName, issueDate: input.quotationDate ?? null, expiryDate: input.validityDate ?? null }],
    notes: "Supplier quote evidence reference created during server-authoritative quote intake.",
    createdAt: now,
    updatedAt: now,
    createdBy: input.actor.uid,
    updatedBy: input.actor.uid,
    sourcePath: null,
    storagePath: input.storagePath,
    filename: input.sourceFileName,
    issueDate: input.quotationDate ?? null,
    expiryDate: input.validityDate ?? null,
    uploadedBy: input.actor.uid,
    uploadedAt: now,
    hash: null,
  };
  await createCanonicalMasterDataEntity({
    actor: actorFromAuthorizedUser(input.actor, input.workspaceId),
    repository: new FirestoreMasterDataRepository(),
    entity: document,
    reason: "Supplier quote intake registered document evidence.",
    now,
  }).catch((error) => {
    if (error && typeof error === "object" && "code" in error && error.code === "CANONICAL_ID_DUPLICATE") return null;
    throw error;
  });
  return documentId;
}

async function persistUpload(input: UploadSupplierQuoteInput, quoteId: string): Promise<{ storagePath: string | null; sourceFileName: string | null }> {
  if (!input.fileBuffer) {
    return { storagePath: input.storagePath ?? null, sourceFileName: input.sourceFileName ?? null };
  }
  const safeName = (input.sourceFileName ?? "supplier-quote.pdf").replace(/[^a-zA-Z0-9._-]+/g, "_");
  const storagePath = `supplier-quotes/${input.workspaceId ?? "workspace"}/${input.dealId}/${quoteId}/${safeName}`;
  await getFirebaseStorageBucket().file(storagePath).save(input.fileBuffer, {
    contentType: input.contentType ?? "application/pdf",
    metadata: { metadata: { documentClassification: "SUPPLIER_QUOTE", dealId: input.dealId, opportunityId: input.opportunityId } },
  });
  return { storagePath, sourceFileName: input.sourceFileName ?? safeName };
}

async function runExtraction(input: UploadSupplierQuoteInput, storagePath: string | null): Promise<{
  extraction: SupplierQuote["extraction"];
  lineItems: SupplierQuoteLineItem[];
}> {
  if (!input.fileBuffer) {
    return { extraction: emptyExtraction(), lineItems: input.lineItems ?? [] };
  }

  const result = await extractTextFromPdfDetailed(input.fileBuffer, {
    filename: input.sourceFileName ?? "supplier-quote.pdf",
    documentType: "SUPPLIER_QUOTE",
    storagePath,
    skipOcrFallback: true,
  });
  const extraction = extractSupplierQuoteFromText(result.text, result.pageCount);
  const extractedLineItems = extractLineItemsFromText(result.text);
  return { extraction, lineItems: input.lineItems?.length ? input.lineItems : extractedLineItems };
}

async function updateExecutionWorkspaceStatus(deal: Record<string, unknown> & { id: string }, status: SupplierQuoteExecutionStatus) {
  const now = new Date();
  const existingExecution = asRecord(deal.opportunityExecution);
  const supplierQuotePatch = {
    supplierQuotesStatus: status.supplierQuotesStatus,
    approvedSupplierQuoteId: status.approvedSupplierQuoteId ?? null,
    pricingSourceStatus: status.pricingSourceStatus,
    lineItemCoverage: status.lineItemCoverage,
    commercialReviewStatus: status.commercialReviewStatus,
    nextAction: status.nextAction,
  };
  await Promise.all([
    getFirebaseAdmin().collection("deals").doc(deal.id).set({
      updatedAt: now,
      opportunityExecution: {
        ...existingExecution,
        ...supplierQuotePatch,
        supplierQuoteWorkflowUpdatedAt: nowIso(),
      },
    }, { merge: true }),
    getFirebaseAdmin().collection("opportunityExecutionWorkspaces").doc(deal.id).set({
      dealId: deal.id,
      opportunityId: deal.id,
      workspaceId: deal.workspaceId ?? null,
      ...supplierQuotePatch,
      updatedAt: Timestamp.fromDate(now),
    }, { merge: true }),
  ]);
}

export async function uploadSupplierQuote(input: UploadSupplierQuoteInput, actor: AuthorizedUser): Promise<{ quote: SupplierQuote; duplicate: boolean }> {
  const deal = await loadDeal(input.dealId);
  const workspaceId = input.workspaceId ?? asString(deal.workspaceId) ?? "";
  await assertWorkspaceAccess(actor, workspaceId);

  const assignment = asRecord(deal.contractorAssignment);
  const execution = asRecord(deal.opportunityExecution);
  const contractorId = input.contractorId ?? asString(assignment.contractorId) ?? asString(execution.contractorId) ?? asString(deal.contractorId);
  const contractorName = input.contractorName ?? asString(assignment.contractorName) ?? asString(deal.contractorName) ?? TORQUE_EMPIRE_CONTRACTOR_NAME;
  if (!contractorId) throw Object.assign(new Error("Assigned contractor is required before supplier quote upload."), { status: 400 });

  const quoteId = randomUUID();
  const uploaded = await persistUpload({ ...input, workspaceId }, quoteId);
  const extracted = await runExtraction(input, uploaded.storagePath);
  const evidence: MasterDataEvidenceReference[] = [{
    storagePath: uploaded.storagePath,
    filename: uploaded.sourceFileName,
    issueDate: input.quotationDate ?? extracted.extraction.quotationDate.value,
    expiryDate: input.validityDate ?? extracted.extraction.validityDate.value,
    provenance: "OPERATIONAL_VERIFIED",
    verificationStatus: "PENDING_REVIEW",
  }];
  const supplier = await resolveSupplierIdentityForQuote({ ...input, actor, workspaceId, quoteId, evidence });
  if (supplier.status === "REVIEW_REQUIRED" && !supplier.supplierId && /ambiguous|name-only/i.test(supplier.reason)) {
    throw Object.assign(new Error(supplier.reason), { status: 409 });
  }
  const masterDocumentId = await persistSupplierQuoteDocumentReference({
    actor,
    workspaceId,
    quoteId,
    supplierId: supplier.supplierId,
    storagePath: uploaded.storagePath,
    sourceFileName: uploaded.sourceFileName,
    quotationDate: input.quotationDate ?? extracted.extraction.quotationDate.value,
    validityDate: input.validityDate ?? extracted.extraction.validityDate.value,
  });
  const subtotal = parseMoney(input.subtotal);
  const vat = parseMoney(input.vat ?? extracted.extraction.vat.value);
  const deliveryCost = parseMoney(input.deliveryCost ?? extracted.extraction.deliveryCost.value);
  const lineItems = extracted.lineItems;
  const lineTotal = lineItems.reduce((sum, item) => sum + item.lineTotal, 0);
  const total = parseMoney(input.total) || parseMoney(subtotal + vat + deliveryCost) || lineTotal + vat + deliveryCost;
  const duplicateKey = buildDuplicateKey({
    workspaceId,
    dealId: input.dealId,
    supplierId: supplier.supplierId ?? supplier.sourceId ?? "UNRESOLVED_SUPPLIER_SOURCE",
    quotationNumber: input.quotationNumber ?? extracted.extraction.quotationNumber.value,
    sourceFileName: uploaded.sourceFileName,
    total,
  });
  const duplicateSnapshot = await getFirebaseAdmin()
    .collection(SUPPLIER_QUOTE_COLLECTION)
    .where("duplicateKey", "==", duplicateKey)
    .limit(1)
    .get();
  if (!duplicateSnapshot.empty) {
    return { quote: { id: duplicateSnapshot.docs[0].id, ...(duplicateSnapshot.docs[0].data() ?? {}) } as SupplierQuote, duplicate: true };
  }

  const timestamp = nowIso();
  let quote: SupplierQuote = {
    id: quoteId,
    workspaceId,
    opportunityId: input.opportunityId,
    dealId: input.dealId,
    contractorId,
    contractorName,
    supplierId: supplier.supplierId,
    sourceId: supplier.sourceId,
    supplierName: input.supplierName || supplier.supplierName || "Unresolved supplier source",
    supplierResolutionStatus: supplier.status,
    supplierResolutionReason: supplier.reason,
    masterDocumentId,
    supplierRegistrationNumber: input.supplierRegistrationNumber ?? null,
    supplierContactName: input.supplierContactName ?? null,
    supplierEmail: input.supplierEmail ?? null,
    supplierPhone: input.supplierPhone ?? null,
    quotationNumber: input.quotationNumber ?? extracted.extraction.quotationNumber.value,
    quotationDate: input.quotationDate ?? extracted.extraction.quotationDate.value,
    validityDate: input.validityDate ?? extracted.extraction.validityDate.value,
    currency: input.currency ?? "ZAR",
    subtotal: subtotal || Math.max(0, total - vat - deliveryCost),
    vat,
    total,
    deliveryCost,
    deliveryPeriod: input.deliveryPeriod ?? extracted.extraction.deliveryPeriod.value,
    paymentTerms: input.paymentTerms ?? extracted.extraction.paymentTerms.value,
    uploadedDocumentId: input.uploadedDocumentId ?? quoteId,
    storagePath: uploaded.storagePath,
    sourceFileName: uploaded.sourceFileName,
    documentClassification: "SUPPLIER_QUOTE",
    extractionStatus: input.fileBuffer ? "EXTRACTED" : "UPLOADED",
    reviewStatus: input.fileBuffer ? "IN_REVIEW" : "PENDING",
    approvalStatus: "PENDING",
    workflowStatus: input.fileBuffer ? "REVIEW_REQUIRED" : "UPLOADED",
    approvedBy: null,
    approvedAt: null,
    approvalNote: null,
    rejectionReason: null,
    clarificationRequest: null,
    lineItems,
    extraction: extracted.extraction,
    duplicateKey,
    supersedesQuoteId: null,
    createdBy: input.createdBy,
    createdAt: timestamp,
    updatedAt: timestamp,
  };

  quote = applyManualCorrections(quote, {
    supplierName: input.supplierName,
    quotationNumber: input.quotationNumber ?? undefined,
    quotationDate: input.quotationDate ?? undefined,
    validityDate: input.validityDate ?? undefined,
    subtotal: subtotal || undefined,
    vat: input.vat !== undefined ? vat : undefined,
    total: input.total !== undefined ? total : undefined,
    deliveryCost: input.deliveryCost !== undefined ? deliveryCost : undefined,
    deliveryPeriod: input.deliveryPeriod ?? undefined,
    paymentTerms: input.paymentTerms ?? undefined,
    lineItems: input.lineItems?.length ? input.lineItems : undefined,
  }, actor.uid, timestamp);
  quote.workflowStatus = input.fileBuffer ? "REVIEW_REQUIRED" : "UPLOADED";
  quote.reviewStatus = input.fileBuffer ? "IN_REVIEW" : "PENDING";

  await getFirebaseAdmin().collection(SUPPLIER_QUOTE_COLLECTION).doc(quote.id).set(quote);
  await writeAuditEvent({ quoteId: quote.id, dealId: quote.dealId, workspaceId, actorUid: actor.uid, action: "SUPPLIER_QUOTE_UPLOADED", metadata: { supplierId: supplier.supplierId, sourceId: supplier.sourceId, supplierResolutionStatus: supplier.status, masterDocumentId } });
  const quotes = await listQuotesByDeal(input.dealId);
  const required = await listRequiredLineItems(deal);
  await updateExecutionWorkspaceStatus(deal, buildExecutionStatus([...quotes, quote], required));
  return { quote, duplicate: false };
}

export async function listSupplierQuotesForDeal(dealId: string, actor: AuthorizedUser): Promise<SupplierQuote[]> {
  const deal = await loadDeal(dealId);
  await assertWorkspaceAccess(actor, asString(deal.workspaceId));
  return listQuotesByDeal(dealId);
}

export async function getSupplierQuote(quoteId: string, actor?: AuthorizedUser): Promise<SupplierQuote> {
  const snapshot = await getFirebaseAdmin().collection(SUPPLIER_QUOTE_COLLECTION).doc(quoteId).get();
  if (!snapshot.exists) throw Object.assign(new Error("Supplier quote not found"), { status: 404 });
  const quote = { id: snapshot.id, ...(snapshot.data() ?? {}) } as SupplierQuote;
  if (actor) await assertWorkspaceAccess(actor, quote.workspaceId);
  return quote;
}

export async function compareSupplierQuotesForDeal(dealId: string, actor: AuthorizedUser): Promise<SupplierQuoteComparison> {
  const deal = await loadDeal(dealId);
  await assertWorkspaceAccess(actor, asString(deal.workspaceId));
  const [quotes, required] = await Promise.all([listQuotesByDeal(dealId), listRequiredLineItems(deal)]);
  return compareSupplierQuotes(quotes, required);
}

export async function reviewSupplierQuote(
  quoteId: string,
  corrections: Parameters<typeof applyManualCorrections>[1],
  actor: AuthorizedUser,
): Promise<SupplierQuote> {
  const quote = await getSupplierQuote(quoteId, actor);
  const updated = applyManualCorrections(quote, corrections, actor.uid);
  await getFirebaseAdmin().collection(SUPPLIER_QUOTE_COLLECTION).doc(quoteId).set(updated, { merge: true });
  await writeAuditEvent({ quoteId, dealId: quote.dealId, workspaceId: quote.workspaceId, actorUid: actor.uid, action: "SUPPLIER_QUOTE_REVIEWED" });
  return updated;
}

export async function decideSupplierQuote(input: ApprovalInput): Promise<SupplierQuote> {
  const quote = await getSupplierQuote(input.quoteId, input.actor);
  const timestamp = nowIso();
  let next: SupplierQuote = { ...quote, updatedAt: timestamp };
  const lineIds = new Set(input.approvedLineItemIds ?? []);

  if (input.action === "approve") {
    next = {
      ...next,
      approvalStatus: "APPROVED",
      workflowStatus: "APPROVED",
      reviewStatus: "REVIEWED",
      approvedBy: input.actor.uid,
      approvedAt: timestamp,
      approvalNote: input.note ?? null,
      rejectionReason: null,
      clarificationRequest: null,
      lineItems: quote.lineItems.map((line) => ({
        ...line,
        approved: lineIds.size === 0 || lineIds.has(line.id),
        approvedBy: lineIds.size === 0 || lineIds.has(line.id) ? input.actor.uid : line.approvedBy ?? null,
        approvedAt: lineIds.size === 0 || lineIds.has(line.id) ? timestamp : line.approvedAt ?? null,
      })),
    };
  } else if (input.action === "reject") {
    next = {
      ...next,
      approvalStatus: "REJECTED",
      workflowStatus: "REJECTED",
      reviewStatus: "REVIEWED",
      rejectionReason: input.rejectionReason ?? input.note ?? "Rejected by staff review",
    };
  } else {
    next = {
      ...next,
      reviewStatus: "CLARIFICATION_REQUESTED",
      workflowStatus: "REVIEW_REQUIRED",
      clarificationRequest: input.clarificationRequest ?? input.note ?? "Clarification requested",
    };
  }

  await getFirebaseAdmin().collection(SUPPLIER_QUOTE_COLLECTION).doc(quote.id).set(next, { merge: true });
  await writeAuditEvent({
    quoteId: quote.id,
    dealId: quote.dealId,
    workspaceId: quote.workspaceId,
    actorUid: input.actor.uid,
    action: input.action === "approve" ? "SUPPLIER_QUOTE_APPROVED" : input.action === "reject" ? "SUPPLIER_QUOTE_REJECTED" : "SUPPLIER_QUOTE_CLARIFICATION_REQUESTED",
    note: input.note ?? input.rejectionReason ?? input.clarificationRequest ?? null,
    metadata: { approvedLineItemIds: input.approvedLineItemIds ?? [] },
  });
  const deal = await loadDeal(quote.dealId);
  const [quotes, required] = await Promise.all([listQuotesByDeal(quote.dealId), listRequiredLineItems(deal)]);
  await updateExecutionWorkspaceStatus(deal, buildExecutionStatus(quotes.map((candidate) => candidate.id === next.id ? next : candidate), required));
  return next;
}

export async function getApprovedSupplierQuotePricing(quoteId: string, actor: AuthorizedUser): Promise<SupplierQuotePricingHandoff> {
  const quote = await getSupplierQuote(quoteId, actor);
  return buildPricingHandoff(quote);
}

export async function sendApprovedSupplierQuoteToPricing(quoteId: string, actor: AuthorizedUser): Promise<SupplierQuotePricingHandoff> {
  const quote = await getSupplierQuote(quoteId, actor);
  const handoff = buildPricingHandoff(quote);
  const timestamp = nowIso();
  await getFirebaseAdmin().collection("deals").doc(handoff.dealId).collection("pricingSources").doc(quoteId).set({
    ...handoff,
    sourceType: "PROVISIONAL_REVIEW_ONLY",
    authorityStatus: "REQUIRES_VERIFIED_COST_LINE",
    locked: false,
    createdBy: actor.uid,
    createdAt: timestamp,
    updatedAt: timestamp,
  });
  await writeAuditEvent({ quoteId, dealId: handoff.dealId, workspaceId: quote.workspaceId, actorUid: actor.uid, action: "SUPPLIER_QUOTE_SENT_TO_PRICING" });
  return handoff;
}

export async function flagExpiredSupplierQuotes(dealId: string, actor: AuthorizedUser): Promise<SupplierQuote[]> {
  const quotes = await listSupplierQuotesForDeal(dealId, actor);
  const expired = quotes.filter((quote) => quote.validityDate && new Date(quote.validityDate).getTime() < Date.now() && quote.approvalStatus !== "APPROVED");
  await Promise.all(expired.map((quote) => getFirebaseAdmin().collection(SUPPLIER_QUOTE_COLLECTION).doc(quote.id).set({
    workflowStatus: "EXPIRED",
    updatedAt: nowIso(),
  }, { merge: true })));
  return expired.map((quote) => ({ ...quote, workflowStatus: "EXPIRED" }));
}
