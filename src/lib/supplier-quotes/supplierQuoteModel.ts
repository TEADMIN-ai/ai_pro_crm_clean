import type {
  SupplierQuote,
  SupplierQuoteComparison,
  SupplierQuoteComparisonRow,
  SupplierQuoteExecutionStatus,
  SupplierQuoteExtractedValue,
  SupplierQuoteExtraction,
  SupplierQuoteLineItem,
  SupplierQuotePricingHandoff,
} from "@/types/supplierQuote";

export const SUPPLIER_QUOTE_COLLECTION = "supplierQuotes";
export const SUPPLIER_QUOTE_AUDIT_COLLECTION = "supplierQuoteAuditEvents";
export const TORQUE_EMPIRE_CONTRACTOR_NAME = "Torque Empire (Pty) Ltd";

export function nowIso() {
  return new Date().toISOString();
}

export function normalizeSupplierName(value: string | null | undefined): string {
  return String(value ?? "")
    .toLowerCase()
    .replace(/\(pty\)|pty ltd|proprietary limited|limited|\bltd\b/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function normalizeIdentifier(value: string | null | undefined): string {
  return String(value ?? "").toLowerCase().replace(/[^a-z0-9@.+-]+/g, "").trim();
}

export function parseMoney(value: string | number | null | undefined): number {
  if (typeof value === "number" && Number.isFinite(value)) return Math.round(value * 100) / 100;
  const parsed = Number(String(value ?? "").replace(/[^0-9.-]+/g, ""));
  return Number.isFinite(parsed) ? Math.round(parsed * 100) / 100 : 0;
}

export function confidenceValue<T>(
  value: T | null,
  confidence: number,
  sourceText?: string | null,
  sourcePage = 1,
): SupplierQuoteExtractedValue<T> {
  return {
    value,
    confidence: Math.max(0, Math.min(1, confidence)),
    sourcePage,
    sourceText: sourceText ?? null,
    manual: { overridden: false, overriddenBy: null, overriddenAt: null },
  };
}

export function emptyExtraction(): SupplierQuoteExtraction {
  return {
    supplierName: confidenceValue<string>(null, 0),
    quotationNumber: confidenceValue<string>(null, 0),
    quotationDate: confidenceValue<string>(null, 0),
    validityDate: confidenceValue<string>(null, 0),
    vat: confidenceValue<number>(null, 0),
    deliveryCost: confidenceValue<number>(null, 0),
    deliveryPeriod: confidenceValue<string>(null, 0),
    paymentTerms: confidenceValue<string>(null, 0),
    exclusions: confidenceValue<string[]>([], 0),
    notes: confidenceValue<string[]>([], 0),
    rawTextPreview: null,
    pageCount: null,
  };
}

function firstMatch(text: string, pattern: RegExp): { value: string; source: string } | null {
  const match = text.match(pattern);
  const value = match?.[1]?.trim();
  return value ? { value, source: match[0].trim() } : null;
}

function pageForText(text: string, source: string | null | undefined): number | null {
  if (!source) return null;
  const before = text.slice(0, Math.max(0, text.indexOf(source)));
  const pages = before.match(/\f|page\s+\d+/gi);
  return pages ? pages.length + 1 : 1;
}

export function extractSupplierQuoteFromText(text: string, pageCount?: number | null): SupplierQuoteExtraction {
  const normalized = text.replace(/\r/g, "\n");
  const supplier = firstMatch(normalized, /(?:supplier|from|vendor)\s*[:\-]\s*([^\n]+)/i);
  const quoteNo = firstMatch(normalized, /(?:quote|quotation|estimate)\s*(?:no|number|#)?\s*[:\-]\s*([A-Z0-9/_-]+)/i);
  const quoteDate = firstMatch(normalized, /(?:quote|quotation)?\s*date\s*[:\-]\s*([0-9]{1,4}[\/\-. ][0-9A-Za-z]{1,9}[\/\-. ][0-9]{2,4})/i);
  const validUntil = firstMatch(normalized, /(?:valid until|validity date|expires|expiry)\s*[:\-]\s*([^\n]+)/i);
  const vat = firstMatch(normalized, /\bVAT\b\s*[:\-]?\s*R?\s*([0-9,]+(?:\.\d{1,2})?)/i);
  const deliveryCost = firstMatch(normalized, /delivery(?: cost| fee)?\s*[:\-]?\s*R?\s*([0-9,]+(?:\.\d{1,2})?)/i);
  const deliveryPeriod = firstMatch(normalized, /delivery(?: period| time)?\s*[:\-]\s*([^\n]+)/i);
  const paymentTerms = firstMatch(normalized, /payment terms\s*[:\-]\s*([^\n]+)/i);
  const exclusions = [...normalized.matchAll(/(?:exclusions?|excluded)\s*[:\-]\s*([^\n]+)/gi)].map((match) => match[1].trim());
  const notes = [...normalized.matchAll(/(?:notes?|remarks?)\s*[:\-]\s*([^\n]+)/gi)].map((match) => match[1].trim());

  return {
    supplierName: confidenceValue(supplier?.value ?? null, supplier ? 0.72 : 0, supplier?.source ?? null, pageForText(normalized, supplier?.source) ?? 1),
    quotationNumber: confidenceValue(quoteNo?.value ?? null, quoteNo ? 0.86 : 0, quoteNo?.source ?? null, pageForText(normalized, quoteNo?.source) ?? 1),
    quotationDate: confidenceValue(quoteDate?.value ?? null, quoteDate ? 0.68 : 0, quoteDate?.source ?? null, pageForText(normalized, quoteDate?.source) ?? 1),
    validityDate: confidenceValue(validUntil?.value ?? null, validUntil ? 0.65 : 0, validUntil?.source ?? null, pageForText(normalized, validUntil?.source) ?? 1),
    vat: confidenceValue(vat ? parseMoney(vat.value) : null, vat ? 0.74 : 0, vat?.source ?? null, pageForText(normalized, vat?.source) ?? 1),
    deliveryCost: confidenceValue(deliveryCost ? parseMoney(deliveryCost.value) : null, deliveryCost ? 0.7 : 0, deliveryCost?.source ?? null, pageForText(normalized, deliveryCost?.source) ?? 1),
    deliveryPeriod: confidenceValue(deliveryPeriod?.value ?? null, deliveryPeriod ? 0.67 : 0, deliveryPeriod?.source ?? null, pageForText(normalized, deliveryPeriod?.source) ?? 1),
    paymentTerms: confidenceValue(paymentTerms?.value ?? null, paymentTerms ? 0.7 : 0, paymentTerms?.source ?? null, pageForText(normalized, paymentTerms?.source) ?? 1),
    exclusions: confidenceValue(exclusions, exclusions.length ? 0.62 : 0),
    notes: confidenceValue(notes, notes.length ? 0.55 : 0),
    rawTextPreview: normalized.replace(/\s+/g, " ").trim().slice(0, 800),
    pageCount: pageCount ?? null,
  };
}

export function extractLineItemsFromText(text: string): SupplierQuoteLineItem[] {
  const rows = text.split(/\n+/).map((line) => line.trim()).filter(Boolean);
  const items: SupplierQuoteLineItem[] = [];
  const rowPattern = /^(.{3,}?)\s+(\d+(?:\.\d+)?)\s+([a-zA-Z0-9/]+)\s+R?\s*([0-9,]+(?:\.\d{1,2})?)\s+R?\s*([0-9,]+(?:\.\d{1,2})?)$/;

  rows.forEach((row, index) => {
    const match = row.match(rowPattern);
    if (!match) return;
    const quantity = parseMoney(match[2]);
    const unitPrice = parseMoney(match[4]);
    const lineTotal = parseMoney(match[5]) || parseMoney(quantity * unitPrice);
    const sourceDescription = match[1].trim();
    items.push({
      id: `line-${index + 1}`,
      tenderLineItemId: null,
      boqLineItemId: null,
      pricingScheduleLineItemId: null,
      sourceDescription,
      normalisedDescription: normalizeSupplierName(sourceDescription),
      supplierSku: null,
      quantity,
      unit: match[3].trim(),
      unitPrice,
      lineTotal,
      vatTreatment: "UNKNOWN",
      deliveryAllocation: 0,
      confidence: 0.72,
      sourcePage: 1,
      sourceText: row,
      manualOverride: false,
      approved: false,
      approvedBy: null,
      approvedAt: null,
    });
  });

  return items;
}

export function applyManualCorrections(
  quote: SupplierQuote,
  corrections: Partial<Pick<SupplierQuote, "supplierName" | "quotationNumber" | "quotationDate" | "validityDate" | "subtotal" | "vat" | "total" | "deliveryCost" | "deliveryPeriod" | "paymentTerms" | "lineItems">>,
  actorUid: string,
  timestamp = nowIso(),
): SupplierQuote {
  const markManual = <T>(field: SupplierQuoteExtractedValue<T>, value: T | null): SupplierQuoteExtractedValue<T> => ({
    ...field,
    value,
    confidence: 1,
    manual: { overridden: true, overriddenBy: actorUid, overriddenAt: timestamp },
  });
  const extraction = { ...quote.extraction };

  if (corrections.supplierName !== undefined) extraction.supplierName = markManual(extraction.supplierName, corrections.supplierName);
  if (corrections.quotationNumber !== undefined) extraction.quotationNumber = markManual(extraction.quotationNumber, corrections.quotationNumber);
  if (corrections.quotationDate !== undefined) extraction.quotationDate = markManual(extraction.quotationDate, corrections.quotationDate);
  if (corrections.validityDate !== undefined) extraction.validityDate = markManual(extraction.validityDate, corrections.validityDate);
  if (corrections.vat !== undefined) extraction.vat = markManual(extraction.vat, corrections.vat);
  if (corrections.deliveryCost !== undefined) extraction.deliveryCost = markManual(extraction.deliveryCost, corrections.deliveryCost);
  if (corrections.deliveryPeriod !== undefined) extraction.deliveryPeriod = markManual(extraction.deliveryPeriod, corrections.deliveryPeriod);
  if (corrections.paymentTerms !== undefined) extraction.paymentTerms = markManual(extraction.paymentTerms, corrections.paymentTerms);

  return {
    ...quote,
    ...corrections,
    extraction,
    lineItems: corrections.lineItems ?? quote.lineItems,
    reviewStatus: "REVIEWED",
    workflowStatus: "EXTRACTED",
    updatedAt: timestamp,
  };
}

function dateExpired(value: string | null | undefined, today = new Date()): boolean {
  if (!value) return false;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return false;
  return date.getTime() < new Date(today.toDateString()).getTime();
}

function coverage(quote: SupplierQuote, requiredLineItems: string[]): { coverage: number; missing: string[] } {
  if (!requiredLineItems.length) return { coverage: quote.lineItems.length ? 1 : 0, missing: [] };
  const quoteTokens = quote.lineItems.map((item) => item.normalisedDescription || normalizeSupplierName(item.sourceDescription));
  const missing = requiredLineItems.filter((required) => {
    const token = normalizeSupplierName(required);
    return !quoteTokens.some((candidate) => candidate.includes(token) || token.includes(candidate));
  });
  return { coverage: (requiredLineItems.length - missing.length) / requiredLineItems.length, missing };
}

export function compareSupplierQuotes(
  quotes: SupplierQuote[],
  requiredLineItems: string[] = [],
  today = new Date(),
): SupplierQuoteComparison {
  const activeQuotes = quotes.filter((quote) => quote.approvalStatus !== "REJECTED" && quote.workflowStatus !== "SUPERSEDED");
  const lowestTotal = Math.min(...activeQuotes.map((quote) => quote.total || Number.MAX_SAFE_INTEGER), Number.MAX_SAFE_INTEGER);
  const rows: SupplierQuoteComparisonRow[] = activeQuotes.map((quote) => {
    const itemCoverage = coverage(quote, requiredLineItems);
    const expired = dateExpired(quote.validityDate, today);
    const deliveryRisk = /week|month|tbc|unknown/i.test(String(quote.deliveryPeriod ?? "")) ? 18 : 0;
    const validityPenalty = expired ? 30 : quote.validityDate ? 0 : 10;
    const completenessScore = itemCoverage.coverage * 35;
    const priceScore = lowestTotal > 0 && Number.isFinite(lowestTotal) ? Math.max(0, 25 - (((quote.total - lowestTotal) / lowestTotal) * 25)) : 10;
    const termsScore = quote.paymentTerms ? 10 : 4;
    const confidenceScore = quote.lineItems.length
      ? quote.lineItems.reduce((sum, item) => sum + item.confidence, 0) / quote.lineItems.length * 20
      : 0;
    const score = Math.round(Math.max(0, completenessScore + priceScore + termsScore + confidenceScore - validityPenalty - deliveryRisk));
    const risk: SupplierQuoteComparisonRow["commercialRisk"] = score >= 72 ? "LOW" : score >= 48 ? "MEDIUM" : "HIGH";
    const exclusions = quote.extraction.exclusions.value ?? [];
    const deviations = [
      ...(expired ? ["Quote validity has expired"] : []),
      ...(!quote.paymentTerms ? ["Payment terms missing"] : []),
      ...(!quote.validityDate ? ["Validity date missing"] : []),
      ...(itemCoverage.missing.length ? ["Incomplete line-item coverage"] : []),
    ];

    return {
      quoteId: quote.id,
      supplierId: quote.supplierId,
      supplierName: quote.supplierName,
      quoteTotal: quote.total,
      vat: quote.vat,
      deliveryCost: quote.deliveryCost,
      validityDate: quote.validityDate ?? null,
      deliveryTime: quote.deliveryPeriod ?? null,
      paymentTerms: quote.paymentTerms ?? null,
      lineItemCoverage: Math.round(itemCoverage.coverage * 100),
      missingItems: itemCoverage.missing,
      deviations,
      exclusions,
      commercialRisk: risk,
      score,
      recommendationReason: `Balanced score ${score}/100 across price, completeness, validity, delivery, terms, and confidence.`,
    };
  }).sort((left, right) => right.score - left.score);
  const winner = rows[0] ?? null;
  const first = quotes[0];

  return {
    opportunityId: first?.opportunityId ?? "",
    dealId: first?.dealId ?? "",
    contractorId: first?.contractorId ?? "",
    contractorName: first?.contractorName ?? "",
    rows,
    recommendedSupplier: winner
      ? {
          quoteId: winner.quoteId,
          supplierId: winner.supplierId,
          supplierName: winner.supplierName,
          reason: winner.recommendationReason,
        }
      : null,
  };
}

export function buildExecutionStatus(quotes: SupplierQuote[], requiredLineItems: string[] = []): SupplierQuoteExecutionStatus {
  const approved = quotes.find((quote) => quote.approvalStatus === "APPROVED" || quote.approvalStatus === "LOCKED") ?? null;
  const latestComparison = compareSupplierQuotes(quotes, requiredLineItems);
  const bestCoverage = latestComparison.rows.reduce((max, row) => Math.max(max, row.lineItemCoverage), 0);
  const hasReview = quotes.some((quote) => quote.workflowStatus === "REVIEW_REQUIRED" || quote.reviewStatus === "PENDING");
  const missing = bestCoverage < 100 && requiredLineItems.length > 0;

  if (!quotes.length) {
    return {
      supplierQuotesStatus: "NOT_STARTED",
      approvedSupplierQuoteId: null,
      pricingSourceStatus: "NO_QUOTES",
      lineItemCoverage: 0,
      commercialReviewStatus: "NOT_STARTED",
      nextAction: "Upload another quote",
    };
  }

  if (approved) {
    return {
      supplierQuotesStatus: missing ? "MISSING_LINE_ITEMS" : "APPROVED",
      approvedSupplierQuoteId: approved.id,
      pricingSourceStatus: missing ? "QUOTE_APPROVED" : "READY_FOR_PRICING",
      lineItemCoverage: bestCoverage,
      commercialReviewStatus: "APPROVED",
      nextAction: missing ? "Resolve missing line items" : "Send approved prices to Pricing Schedule",
    };
  }

  return {
    supplierQuotesStatus: hasReview ? "REVIEW_REQUIRED" : "UPLOADED",
    approvedSupplierQuoteId: null,
    pricingSourceStatus: "QUOTE_UPLOADED",
    lineItemCoverage: bestCoverage,
    commercialReviewStatus: "REVIEW_REQUIRED",
    nextAction: hasReview ? "Review extracted quote" : "Approve supplier quote",
  };
}

export function buildPricingHandoff(quote: SupplierQuote): SupplierQuotePricingHandoff {
  if (quote.approvalStatus !== "APPROVED" && quote.approvalStatus !== "LOCKED") {
    throw Object.assign(new Error("Rejected or unapproved quotes cannot populate pricing."), { status: 409 });
  }

  return {
    quoteId: quote.id,
    opportunityId: quote.opportunityId,
    dealId: quote.dealId,
    contractorId: quote.contractorId,
    contractorName: quote.contractorName,
    supplierId: quote.supplierId,
    supplierName: quote.supplierName,
    currency: quote.currency,
    subtotal: quote.subtotal,
    vat: quote.vat,
    total: quote.total,
    deliveryCost: quote.deliveryCost,
    lineItems: quote.lineItems.filter((item) => item.approved || quote.approvalStatus === "APPROVED" || quote.approvalStatus === "LOCKED"),
    pricingSourceStatus: "READY_FOR_PRICING",
  };
}

export function buildDuplicateKey(input: {
  workspaceId: string;
  dealId: string;
  supplierId: string;
  quotationNumber?: string | null;
  sourceFileName?: string | null;
  total?: number | null;
}): string {
  return [
    normalizeIdentifier(input.workspaceId),
    normalizeIdentifier(input.dealId),
    normalizeIdentifier(input.supplierId),
    normalizeIdentifier(input.quotationNumber),
    normalizeIdentifier(input.sourceFileName),
    String(parseMoney(input.total ?? 0)),
  ].join("__");
}

